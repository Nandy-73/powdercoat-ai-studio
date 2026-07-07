"""Report generation: CSV (Excel-compatible) and structured JSON report payloads."""

import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.ai.cost_intelligence import cost_breakdown
from app.api.deps import get_current_user
from app.api.routes.formulations import _get_or_404, items_as_dicts
from app.db.session import get_db
from app.models.batch import ProductionBatch
from app.models.formulation import Formulation
from app.models.material import Material
from app.models.supplier import Supplier
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


def _csv_response(filename: str, header: list[str], rows: list[list]) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/materials.csv")
def materials_report(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = [
        [m.code, m.name, m.category.value, m.chemical_family, m.density_g_cm3,
         m.cost_per_kg, m.currency, m.supplier_name, m.country]
        for m in db.query(Material).order_by(Material.category, Material.name).all()
    ]
    return _csv_response(
        "materials_report.csv",
        ["Code", "Name", "Category", "Chemical Family", "Density g/cm3", "Cost/kg", "Currency", "Supplier", "Country"],
        rows,
    )


@router.get("/formulations.csv")
def formulations_report(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = []
    for f in db.query(Formulation).all():
        breakdown = cost_breakdown(items_as_dicts(f)) if f.items else None
        rows.append(
            [f.code, f.name, f.system.value, f.status.value, f.target_finish,
             f.target_gloss, f.cure_temp_c, f.cure_time_min,
             breakdown["material_cost_per_kg"] if breakdown else "", len(f.items)]
        )
    return _csv_response(
        "formulations_report.csv",
        ["Code", "Name", "System", "Status", "Target Finish", "Target Gloss",
         "Cure Temp C", "Cure Time min", "Cost/kg", "Components"],
        rows,
    )


@router.get("/production.csv")
def production_report(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = [
        [b.batch_number, b.formulation.code if b.formulation else "", b.size_kg,
         b.scale, b.status.value, b.cost_total, b.created_at.date().isoformat()]
        for b in db.query(ProductionBatch).order_by(ProductionBatch.created_at.desc()).all()
    ]
    return _csv_response(
        "production_report.csv",
        ["Batch", "Formulation", "Size kg", "Scale", "Status", "Cost", "Date"],
        rows,
    )


@router.get("/suppliers.csv")
def suppliers_report(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = [
        [s.company, s.country, s.rating, s.lead_time_days, s.certifications, s.website]
        for s in db.query(Supplier).order_by(Supplier.company).all()
    ]
    return _csv_response(
        "suppliers_report.csv",
        ["Company", "Country", "Rating", "Lead Time (days)", "Certifications", "Website"],
        rows,
    )


@router.get("/formulation/{formulation_id}")
def formulation_report(formulation_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Structured report payload (rendered as printable PDF view by the frontend)."""
    from app.ai.formulation_engine import validate_formulation
    from app.ai.prediction import predict_finish, predict_manufacturing, predict_mechanical

    f = _get_or_404(db, formulation_id)
    items = items_as_dicts(f)
    if not items:
        raise HTTPException(status_code=400, detail="Formulation has no materials")
    return {
        "formulation": {
            "name": f.name, "code": f.code, "system": f.system.value,
            "status": f.status.value, "description": f.description,
            "cure": f"{f.cure_time_min:.0f} min @ {f.cure_temp_c:.0f}°C",
        },
        "cost": cost_breakdown(items),
        "validation": validate_formulation(items, f.system.value, f.cure_temp_c, f.cure_time_min),
        "finish_prediction": predict_finish(items, f.system.value, f.cure_temp_c, f.cure_time_min),
        "mechanical_prediction": predict_mechanical(items, f.system.value, f.cure_temp_c, f.cure_time_min),
        "manufacturing": predict_manufacturing(items, f.system.value, f.cure_temp_c, f.cure_time_min),
        "trials": [
            {"result": t.result, "gloss": t.gloss_measured, "notes": t.notes,
             "date": t.created_at.isoformat()}
            for t in f.trials
        ],
    }
