from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.machinery import Machine
from app.models.market import MarketInsight
from app.models.user import User
from app.schemas.misc import MachineOut, MarketInsightOut

router = APIRouter(prefix="/machinery", tags=["machinery"])
market_router = APIRouter(prefix="/market", tags=["market-intelligence"])


@router.get("", response_model=list[MachineOut])
def list_machines(
    machine_type: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Machine)
    if machine_type:
        q = q.filter(Machine.machine_type == machine_type)
    if search:
        q = q.filter(Machine.name.ilike(f"%{search}%") | Machine.manufacturer.ilike(f"%{search}%"))
    return q.order_by(Machine.machine_type, Machine.name).all()


@router.get("/types")
def machine_types(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(Machine.machine_type).distinct().order_by(Machine.machine_type).all()
    return [r[0] for r in rows]


@market_router.get("", response_model=list[MarketInsightOut])
def list_insights(
    category: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MarketInsight)
    if category:
        q = q.filter(MarketInsight.category == category)
    return q.order_by(MarketInsight.published_at.desc()).all()


@market_router.get("/categories")
def insight_categories(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(MarketInsight.category).distinct().all()
    return [r[0] for r in rows]
