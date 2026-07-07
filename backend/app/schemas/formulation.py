from datetime import datetime

from pydantic import BaseModel

from app.models.formulation import ChemistrySystem, FormulationStatus
from app.schemas.material import MaterialOut


class FormulationItemIn(BaseModel):
    material_id: int
    weight_kg: float


class FormulationItemOut(BaseModel):
    id: int
    material_id: int
    weight_kg: float
    material: MaterialOut

    class Config:
        from_attributes = True


class FormulationCreate(BaseModel):
    name: str
    code: str
    system: ChemistrySystem
    description: str = ""
    target_finish: str = "smooth"
    target_gloss: float = 90.0
    cure_temp_c: float = 180.0
    cure_time_min: float = 10.0
    items: list[FormulationItemIn] = []


class FormulationUpdate(BaseModel):
    name: str | None = None
    system: ChemistrySystem | None = None
    status: FormulationStatus | None = None
    description: str | None = None
    target_finish: str | None = None
    target_gloss: float | None = None
    cure_temp_c: float | None = None
    cure_time_min: float | None = None
    items: list[FormulationItemIn] | None = None
    version_note: str = ""


class FormulationOut(BaseModel):
    id: int
    name: str
    code: str
    system: ChemistrySystem
    status: FormulationStatus
    description: str
    target_finish: str
    target_gloss: float
    cure_temp_c: float
    cure_time_min: float
    created_at: datetime
    updated_at: datetime
    items: list[FormulationItemOut] = []

    class Config:
        from_attributes = True


class FormulationMetrics(BaseModel):
    total_weight_kg: float
    cost_per_kg: float
    total_cost: float
    resin_pct: float
    hardener_pct: float
    pigment_pct: float
    filler_pct: float
    additive_pct: float
    binder_content_pct: float
    resin_to_hardener_ratio: float | None
    pigment_loading_pct: float
    pvc_pct: float
    composition: list[dict]


class TrialCreate(BaseModel):
    result: str = "pending"
    gloss_measured: float | None = None
    notes: str = ""


class TrialOut(TrialCreate):
    id: int
    formulation_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class VersionOut(BaseModel):
    id: int
    version: int
    snapshot: str
    note: str
    created_at: datetime

    class Config:
        from_attributes = True
