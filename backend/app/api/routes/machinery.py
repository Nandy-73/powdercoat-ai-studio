from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.ai.machinery_intel import run_ingestion
from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.machinery import IngestionSource, Machine, MachineSuggestion
from app.models.market import MarketInsight
from app.models.user import User, UserRole
from app.schemas.misc import (
    IngestionSourceCreate,
    IngestionSourceOut,
    IngestionSourceUpdate,
    IngestRunResult,
    MachineCreate,
    MachineOut,
    MachineSuggestionOut,
    MachineUpdate,
    MarketInsightOut,
)

router = APIRouter(prefix="/machinery", tags=["machinery"])
market_router = APIRouter(prefix="/market", tags=["market-intelligence"])

_MACHINE_ROLES = (UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER, UserRole.PRODUCTION_MANAGER)


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


# ---------- Option A: manual CRUD ----------
@router.post("", response_model=MachineOut, status_code=201)
def create_machine(
    payload: MachineCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_MACHINE_ROLES)),
):
    machine = Machine(**payload.model_dump())
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine


@router.patch("/{machine_id}", response_model=MachineOut)
def update_machine(
    machine_id: int,
    payload: MachineUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_MACHINE_ROLES)),
):
    machine = db.get(Machine, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(machine, field, value)
    db.commit()
    db.refresh(machine)
    return machine


@router.delete("/{machine_id}", status_code=204)
def delete_machine(
    machine_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_MACHINE_ROLES)),
):
    machine = db.get(Machine, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    db.delete(machine)
    db.commit()


# ---------- Option B: AI ingestion sources ----------
@router.get("/sources", response_model=list[IngestionSourceOut])
def list_sources(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_MACHINE_ROLES)),
):
    return db.query(IngestionSource).order_by(IngestionSource.id).all()


@router.post("/sources", response_model=IngestionSourceOut, status_code=201)
def create_source(
    payload: IngestionSourceCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_MACHINE_ROLES)),
):
    source = IngestionSource(**payload.model_dump())
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@router.patch("/sources/{source_id}", response_model=IngestionSourceOut)
def update_source(
    source_id: int,
    payload: IngestionSourceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_MACHINE_ROLES)),
):
    source = db.get(IngestionSource, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(source, field, value)
    db.commit()
    db.refresh(source)
    return source


@router.delete("/sources/{source_id}", status_code=204)
def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_MACHINE_ROLES)),
):
    source = db.get(IngestionSource, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()


@router.post("/ingest/run", response_model=IngestRunResult)
def run_scan(
    source_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_MACHINE_ROLES)),
):
    """Scan active sources now and create suggestions for approval."""
    return run_ingestion(db, source_id)


# ---------- Option B: suggestion review ----------
@router.get("/suggestions", response_model=list[MachineSuggestionOut])
def list_suggestions(
    status: str = "pending",
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_MACHINE_ROLES)),
):
    return (
        db.query(MachineSuggestion)
        .filter(MachineSuggestion.status == status)
        .order_by(MachineSuggestion.confidence.desc(), MachineSuggestion.created_at.desc())
        .all()
    )


@router.post("/suggestions/{suggestion_id}/approve", response_model=MachineOut)
def approve_suggestion(
    suggestion_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_MACHINE_ROLES)),
):
    s = db.get(MachineSuggestion, suggestion_id)
    if not s:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    machine = Machine(
        name=s.name,
        machine_type=s.machine_type,
        manufacturer=s.manufacturer,
        country=s.country,
        capacity=s.capacity,
        estimated_price_usd=s.estimated_price_usd,
        energy_kw=s.energy_kw,
        warranty_years=1,
        specs=f'{{"source": "{s.source_name}", "auto_added": true}}',
    )
    db.add(machine)
    s.status = "approved"
    db.commit()
    db.refresh(machine)
    return machine


@router.post("/suggestions/{suggestion_id}/reject", status_code=204)
def reject_suggestion(
    suggestion_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_MACHINE_ROLES)),
):
    s = db.get(MachineSuggestion, suggestion_id)
    if not s:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    s.status = "rejected"
    db.commit()


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
