import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.ai.formulation_engine import compute_metrics, scale_formulation, validate_formulation
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.formulation import Formulation, FormulationItem, FormulationVersion, Trial
from app.models.material import Material
from app.models.user import User, UserRole
from app.schemas.formulation import (
    FormulationCreate,
    FormulationMetrics,
    FormulationOut,
    FormulationUpdate,
    TrialCreate,
    TrialOut,
    VersionOut,
)

router = APIRouter(prefix="/formulations", tags=["formulations"])

_EDIT_ROLES = (UserRole.ADMIN, UserRole.SENIOR_RD_MANAGER, UserRole.RD_ENGINEER, UserRole.COLOR_ENGINEER)


def items_as_dicts(f: Formulation) -> list[dict]:
    return [
        {
            "material_id": it.material_id,
            "name": it.material.name,
            "category": it.material.category.value,
            "chemical_family": it.material.chemical_family,
            "weight_kg": it.weight_kg,
            "density_g_cm3": it.material.density_g_cm3,
            "cost_per_kg": it.material.cost_per_kg,
        }
        for it in f.items
    ]


def _get_or_404(db: Session, formulation_id: int) -> Formulation:
    f = db.get(Formulation, formulation_id)
    if not f:
        raise HTTPException(status_code=404, detail="Formulation not found")
    return f


def _snapshot(db: Session, f: Formulation, note: str) -> None:
    version = FormulationVersion(
        formulation_id=f.id,
        version=len(f.versions) + 1,
        snapshot=json.dumps(
            [{"material_id": it.material_id, "weight_kg": it.weight_kg} for it in f.items]
        ),
        note=note,
    )
    db.add(version)


@router.get("", response_model=list[FormulationOut])
def list_formulations(
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Formulation)
    if search:
        q = q.filter(Formulation.name.ilike(f"%{search}%") | Formulation.code.ilike(f"%{search}%"))
    return q.order_by(Formulation.updated_at.desc()).all()


@router.post("", response_model=FormulationOut, status_code=201)
def create_formulation(
    payload: FormulationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*_EDIT_ROLES)),
):
    if db.query(Formulation).filter(Formulation.code == payload.code).first():
        raise HTTPException(status_code=409, detail="Formulation code already exists")
    f = Formulation(
        name=payload.name,
        code=payload.code,
        system=payload.system,
        description=payload.description,
        target_finish=payload.target_finish,
        target_gloss=payload.target_gloss,
        cure_temp_c=payload.cure_temp_c,
        cure_time_min=payload.cure_time_min,
        created_by=user.id,
    )
    db.add(f)
    db.flush()
    for item in payload.items:
        if not db.get(Material, item.material_id):
            raise HTTPException(status_code=400, detail=f"Material {item.material_id} not found")
        db.add(FormulationItem(formulation_id=f.id, material_id=item.material_id, weight_kg=item.weight_kg))
    db.flush()
    db.refresh(f)
    _snapshot(db, f, "Initial version")
    db.commit()
    db.refresh(f)
    return f


@router.get("/{formulation_id}", response_model=FormulationOut)
def get_formulation(formulation_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return _get_or_404(db, formulation_id)


@router.patch("/{formulation_id}", response_model=FormulationOut)
def update_formulation(
    formulation_id: int,
    payload: FormulationUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_EDIT_ROLES)),
):
    f = _get_or_404(db, formulation_id)
    data = payload.model_dump(exclude_unset=True)
    items = data.pop("items", None)
    note = data.pop("version_note", "")
    for field, value in data.items():
        setattr(f, field, value)
    if items is not None:
        for it in list(f.items):
            db.delete(it)
        db.flush()
        for item in items:
            db.add(
                FormulationItem(
                    formulation_id=f.id,
                    material_id=item["material_id"],
                    weight_kg=item["weight_kg"],
                )
            )
        db.flush()
        db.refresh(f)
        _snapshot(db, f, note or "Composition updated")
    db.commit()
    db.refresh(f)
    return f


@router.delete("/{formulation_id}", status_code=204)
def delete_formulation(
    formulation_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.SENIOR_RD_MANAGER)),
):
    f = _get_or_404(db, formulation_id)
    db.delete(f)
    db.commit()


@router.get("/{formulation_id}/metrics", response_model=FormulationMetrics)
def formulation_metrics(formulation_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = _get_or_404(db, formulation_id)
    return compute_metrics(items_as_dicts(f))


@router.get("/{formulation_id}/validate")
def validate(formulation_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = _get_or_404(db, formulation_id)
    return validate_formulation(items_as_dicts(f), f.system.value, f.cure_temp_c, f.cure_time_min)


@router.get("/{formulation_id}/scale")
def scale(
    formulation_id: int,
    target_kg: float,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Batch calculator: scale to lab / pilot / production / factory sizes."""
    f = _get_or_404(db, formulation_id)
    items = items_as_dicts(f)
    scaled = scale_formulation(items, target_kg)
    return {
        "formulation": f.name,
        "target_kg": target_kg,
        "metrics": compute_metrics(scaled),
        "items": [
            {"name": i["name"], "category": i["category"], "weight_kg": i["weight_kg"],
             "pct": round(i["weight_kg"] / target_kg * 100, 3)}
            for i in scaled
        ],
    }


@router.get("/{formulation_id}/versions", response_model=list[VersionOut])
def versions(formulation_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = _get_or_404(db, formulation_id)
    return sorted(f.versions, key=lambda v: -v.version)


@router.post("/{formulation_id}/trials", response_model=TrialOut, status_code=201)
def add_trial(
    formulation_id: int,
    payload: TrialCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_EDIT_ROLES, UserRole.QC_ENGINEER)),
):
    _get_or_404(db, formulation_id)
    trial = Trial(formulation_id=formulation_id, **payload.model_dump())
    db.add(trial)
    db.commit()
    db.refresh(trial)
    return trial


@router.get("/{formulation_id}/trials", response_model=list[TrialOut])
def list_trials(formulation_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    _get_or_404(db, formulation_id)
    return db.query(Trial).filter(Trial.formulation_id == formulation_id).order_by(Trial.created_at.desc()).all()


@router.get("/{formulation_id}/similar")
def similar(formulation_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Knowledge base: closest previous formulations by composition profile."""
    f = _get_or_404(db, formulation_id)
    ref = compute_metrics(items_as_dicts(f))
    results = []
    for other in db.query(Formulation).filter(Formulation.id != f.id).all():
        om = compute_metrics(items_as_dicts(other))
        if om["total_weight_kg"] <= 0:
            continue
        distance = (
            abs(ref["resin_pct"] - om["resin_pct"])
            + abs(ref["hardener_pct"] - om["hardener_pct"])
            + abs(ref["pigment_pct"] - om["pigment_pct"])
            + abs(ref["filler_pct"] - om["filler_pct"])
            + abs(ref["pvc_pct"] - om["pvc_pct"]) * 0.5
            + (0 if other.system == f.system else 25)
        )
        results.append(
            {
                "id": other.id,
                "name": other.name,
                "code": other.code,
                "system": other.system.value,
                "status": other.status.value,
                "similarity_pct": round(max(0.0, 100 - distance), 1),
                "cost_per_kg": om["cost_per_kg"],
            }
        )
    return sorted(results, key=lambda r: -r["similarity_pct"])[:10]
