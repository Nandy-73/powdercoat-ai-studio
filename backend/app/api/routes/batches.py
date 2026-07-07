from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.ai.cost_intelligence import cost_breakdown
from app.api.deps import get_current_user, require_roles
from app.api.routes.formulations import _get_or_404 as get_formulation_or_404
from app.api.routes.formulations import items_as_dicts
from app.db.session import get_db
from app.models.batch import ProductionBatch, QCRecord
from app.models.user import User, UserRole
from app.schemas.misc import BatchCreate, BatchOut, BatchUpdate, QCRecordCreate, QCRecordOut

router = APIRouter(prefix="/batches", tags=["production"])

_PROD_ROLES = (UserRole.ADMIN, UserRole.SENIOR_RD_MANAGER, UserRole.PRODUCTION_MANAGER)


@router.get("", response_model=list[BatchOut])
def list_batches(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(ProductionBatch).order_by(ProductionBatch.created_at.desc()).all()


@router.post("", response_model=BatchOut, status_code=201)
def create_batch(
    payload: BatchCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PROD_ROLES)),
):
    f = get_formulation_or_404(db, payload.formulation_id)
    items = items_as_dicts(f)
    cost = cost_breakdown(items, batch_kg=payload.size_kg)["material_cost"] if items else 0.0
    number = f"B{datetime.now(timezone.utc):%Y%m%d}-{(db.query(ProductionBatch).count() + 1):04d}"
    batch = ProductionBatch(
        batch_number=number,
        formulation_id=payload.formulation_id,
        size_kg=payload.size_kg,
        scale=payload.scale,
        cost_total=cost,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.patch("/{batch_id}", response_model=BatchOut)
def update_batch(
    batch_id: int,
    payload: BatchUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PROD_ROLES)),
):
    batch = db.get(ProductionBatch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(batch, field, value)
    db.commit()
    db.refresh(batch)
    return batch


@router.post("/{batch_id}/qc", response_model=QCRecordOut, status_code=201)
def add_qc_record(
    batch_id: int,
    payload: QCRecordCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_PROD_ROLES, UserRole.QC_ENGINEER)),
):
    if not db.get(ProductionBatch, batch_id):
        raise HTTPException(status_code=404, detail="Batch not found")
    record = QCRecord(batch_id=batch_id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
