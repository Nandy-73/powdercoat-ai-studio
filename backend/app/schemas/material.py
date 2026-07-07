from pydantic import BaseModel

from app.models.material import MaterialCategory


class MaterialBase(BaseModel):
    name: str
    code: str
    category: MaterialCategory
    chemical_family: str = ""
    function: str = ""
    density_g_cm3: float = 1.0
    cost_per_kg: float = 0.0
    currency: str = "USD"
    supplier_name: str = ""
    country: str = ""
    safety_info: str = ""
    tds_url: str = ""
    sds_url: str = ""
    specs: str = "{}"


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    name: str | None = None
    category: MaterialCategory | None = None
    chemical_family: str | None = None
    function: str | None = None
    density_g_cm3: float | None = None
    cost_per_kg: float | None = None
    currency: str | None = None
    supplier_name: str | None = None
    country: str | None = None
    safety_info: str | None = None
    tds_url: str | None = None
    sds_url: str | None = None
    specs: str | None = None


class MaterialOut(MaterialBase):
    id: int

    class Config:
        from_attributes = True
