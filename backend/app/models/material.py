import enum

from sqlalchemy import Enum, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class MaterialCategory(str, enum.Enum):
    RESIN = "resin"
    HARDENER = "hardener"
    PIGMENT = "pigment"
    FILLER = "filler"
    FLOW_AGENT = "flow_agent"
    BENZOIN = "benzoin"
    DEGASSING_AGENT = "degassing_agent"
    TEXTURE_ADDITIVE = "texture_additive"
    SPECIAL_ADDITIVE = "special_additive"
    WAX = "wax"


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    category: Mapped[MaterialCategory] = mapped_column(
        Enum(MaterialCategory, values_callable=lambda e: [m.value for m in e])
    )
    chemical_family: Mapped[str] = mapped_column(String(255), default="")
    function: Mapped[str] = mapped_column(Text, default="")
    density_g_cm3: Mapped[float] = mapped_column(Float, default=1.0)
    cost_per_kg: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    supplier_name: Mapped[str] = mapped_column(String(255), default="")
    country: Mapped[str] = mapped_column(String(128), default="")
    safety_info: Mapped[str] = mapped_column(Text, default="")
    tds_url: Mapped[str] = mapped_column(String(512), default="")
    sds_url: Mapped[str] = mapped_column(String(512), default="")
    specs: Mapped[str] = mapped_column(Text, default="{}")  # JSON blob of technical specs
