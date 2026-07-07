"""AI endpoints: prediction, optimization, cost intelligence and the assistant."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.ai.assistant import answer as assistant_answer
from app.ai.cost_intelligence import cost_breakdown, suggest_alternatives
from app.ai.optimizer import OptimizationTargets, optimize
from app.ai.prediction import predict_finish, predict_manufacturing, predict_mechanical
from app.api.deps import get_current_user
from app.api.routes.formulations import _get_or_404, items_as_dicts
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/ai", tags=["ai"])


class OptimizeRequest(BaseModel):
    formulation_id: int
    target_gloss: float | None = None
    target_hardness: float | None = None
    target_flexibility: float | None = None
    target_texture: str | None = None  # smooth | fine_texture | sand_texture | wrinkle | orange_peel
    target_weather_resistance: float | None = None
    max_cost_per_kg: float | None = None


class AssistantRequest(BaseModel):
    question: str
    formulation_id: int | None = None


class CostRequest(BaseModel):
    formulation_id: int
    batch_kg: float | None = None
    selling_price_per_kg: float | None = None
    overhead_pct: float = 18.0


@router.get("/predict/finish/{formulation_id}")
def finish(formulation_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = _get_or_404(db, formulation_id)
    items = items_as_dicts(f)
    if not items:
        raise HTTPException(status_code=400, detail="Formulation has no materials")
    return predict_finish(items, f.system.value, f.cure_temp_c, f.cure_time_min)


@router.get("/predict/mechanical/{formulation_id}")
def mechanical(formulation_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = _get_or_404(db, formulation_id)
    items = items_as_dicts(f)
    if not items:
        raise HTTPException(status_code=400, detail="Formulation has no materials")
    return predict_mechanical(items, f.system.value, f.cure_temp_c, f.cure_time_min)


@router.get("/predict/manufacturing/{formulation_id}")
def manufacturing(
    formulation_id: int,
    batch_kg: float = 500.0,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    f = _get_or_404(db, formulation_id)
    items = items_as_dicts(f)
    if not items:
        raise HTTPException(status_code=400, detail="Formulation has no materials")
    return predict_manufacturing(items, f.system.value, f.cure_temp_c, f.cure_time_min, batch_kg)


@router.post("/optimize")
def run_optimize(payload: OptimizeRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = _get_or_404(db, payload.formulation_id)
    items = items_as_dicts(f)
    if not items:
        raise HTTPException(status_code=400, detail="Formulation has no materials")
    targets = OptimizationTargets(
        gloss=payload.target_gloss,
        hardness=payload.target_hardness,
        flexibility=payload.target_flexibility,
        texture=payload.target_texture,
        weather_resistance=payload.target_weather_resistance,
        max_cost_per_kg=payload.max_cost_per_kg,
    )
    return optimize(items, f.system.value, f.cure_temp_c, f.cure_time_min, targets)


@router.post("/cost")
def cost(payload: CostRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = _get_or_404(db, payload.formulation_id)
    items = items_as_dicts(f)
    if not items:
        raise HTTPException(status_code=400, detail="Formulation has no materials")
    breakdown = cost_breakdown(items, payload.batch_kg, payload.selling_price_per_kg, payload.overhead_pct)
    breakdown["alternatives"] = suggest_alternatives(db, items)
    return breakdown


@router.post("/assistant")
def assistant(payload: AssistantRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return assistant_answer(db, payload.question, payload.formulation_id)
