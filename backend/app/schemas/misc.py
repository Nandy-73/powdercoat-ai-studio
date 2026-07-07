from datetime import datetime

from pydantic import BaseModel

from app.models.batch import BatchStatus


class SupplierProductOut(BaseModel):
    id: int
    product_name: str
    category: str
    price_per_kg: float
    currency: str
    moq_kg: float

    class Config:
        from_attributes = True


class SupplierOut(BaseModel):
    id: int
    company: str
    country: str
    website: str
    contact_email: str
    contact_phone: str
    certifications: str
    distributor_info: str
    rating: float
    lead_time_days: int
    products: list[SupplierProductOut] = []

    class Config:
        from_attributes = True


class SupplierCreate(BaseModel):
    company: str
    country: str
    website: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    certifications: str = ""
    distributor_info: str = ""
    rating: float = 4.0
    lead_time_days: int = 30


class MachineOut(BaseModel):
    id: int
    name: str
    machine_type: str
    manufacturer: str
    country: str
    capacity: str
    estimated_price_usd: float
    energy_kw: float
    warranty_years: int
    specs: str

    class Config:
        from_attributes = True


class MarketInsightOut(BaseModel):
    id: int
    category: str
    title: str
    summary: str
    impact: str
    region: str
    published_at: datetime

    class Config:
        from_attributes = True


class BatchCreate(BaseModel):
    formulation_id: int
    size_kg: float = 100.0
    scale: str = "production"


class BatchUpdate(BaseModel):
    status: BatchStatus | None = None
    size_kg: float | None = None


class QCRecordCreate(BaseModel):
    test_name: str
    value: float | None = None
    unit: str = ""
    result: str = "pass"
    notes: str = ""


class QCRecordOut(QCRecordCreate):
    id: int
    batch_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BatchOut(BaseModel):
    id: int
    batch_number: str
    formulation_id: int
    size_kg: float
    scale: str
    status: BatchStatus
    cost_total: float
    created_at: datetime
    qc_records: list[QCRecordOut] = []

    class Config:
        from_attributes = True


class PriceBenchmarkOut(BaseModel):
    id: int
    material_name: str
    category: str
    country: str
    price_per_kg: float
    currency: str
    quality_score: float
    delivery_days: int
    supplier_rating: float
    import_available: int

    class Config:
        from_attributes = True
