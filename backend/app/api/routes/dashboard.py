from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ai.formulation_engine import compute_metrics
from app.api.deps import get_current_user
from app.api.routes.formulations import items_as_dicts
from app.db.session import get_db
from app.models.batch import BatchStatus, ProductionBatch, QCRecord
from app.models.color import ColorMatchRecord
from app.models.formulation import Formulation, FormulationStatus, Trial
from app.models.material import Material
from app.models.supplier import Supplier
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    formulations = db.query(Formulation).all()
    active = sum(1 for f in formulations if f.status in (FormulationStatus.DRAFT, FormulationStatus.TRIAL))
    approved = sum(1 for f in formulations if f.status in (FormulationStatus.APPROVED, FormulationStatus.PRODUCTION))
    trials = db.query(Trial).all()
    failed_trials = sum(1 for t in trials if t.result == "fail")
    passed_trials = sum(1 for t in trials if t.result == "pass")
    batches = db.query(ProductionBatch).all()

    costs = []
    for f in formulations:
        m = compute_metrics(items_as_dicts(f))
        if m["cost_per_kg"] > 0:
            costs.append({"name": f.code, "cost_per_kg": m["cost_per_kg"], "system": f.system.value})

    qc = db.query(QCRecord).all()
    qc_pass_rate = round(sum(1 for r in qc if r.result == "pass") / len(qc) * 100, 1) if qc else None

    recent_matches = (
        db.query(ColorMatchRecord).order_by(ColorMatchRecord.created_at.desc()).limit(12).all()
    )

    return {
        "kpis": {
            "active_formulations": active,
            "approved_formulations": approved,
            "total_formulations": len(formulations),
            "production_batches": len(batches),
            "batches_in_progress": sum(1 for b in batches if b.status == BatchStatus.IN_PROGRESS),
            "failed_trials": failed_trials,
            "passed_trials": passed_trials,
            "trial_success_rate": round(passed_trials / max(passed_trials + failed_trials, 1) * 100, 1),
            "materials": db.query(func.count(Material.id)).scalar(),
            "suppliers": db.query(func.count(Supplier.id)).scalar(),
            "qc_pass_rate": qc_pass_rate,
            "avg_cost_per_kg": round(sum(c["cost_per_kg"] for c in costs) / len(costs), 2) if costs else 0,
        },
        "cost_by_formulation": sorted(costs, key=lambda c: c["cost_per_kg"])[:15],
        "systems_distribution": _count_by(formulations, lambda f: f.system.value),
        "status_distribution": _count_by(formulations, lambda f: f.status.value),
        "batch_status_distribution": _count_by(batches, lambda b: b.status.value),
        "color_trend": [
            {"id": r.id, "delta_e": r.delta_e, "target_hex": r.target_hex,
             "actual_hex": r.actual_hex, "date": r.created_at.isoformat()}
            for r in reversed(recent_matches)
        ],
        "material_consumption": _material_consumption(db, batches),
    }


def _count_by(rows, key) -> list[dict]:
    counts: dict[str, int] = {}
    for r in rows:
        counts[key(r)] = counts.get(key(r), 0) + 1
    return [{"name": k, "value": v} for k, v in sorted(counts.items())]


def _material_consumption(db: Session, batches) -> list[dict]:
    """Total kg of each material category consumed across production batches."""
    usage: dict[str, float] = {}
    for b in batches:
        f = b.formulation
        if not f:
            continue
        items = items_as_dicts(f)
        total = sum(i["weight_kg"] for i in items)
        if total <= 0:
            continue
        for i in items:
            kg = i["weight_kg"] / total * b.size_kg
            usage[i["category"]] = usage.get(i["category"], 0.0) + kg
    return [{"category": k, "kg": round(v, 1)} for k, v in sorted(usage.items(), key=lambda x: -x[1])]
