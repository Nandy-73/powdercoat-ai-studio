from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Machine(Base):
    __tablename__ = "machines"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    machine_type: Mapped[str] = mapped_column(String(64), index=True)
    manufacturer: Mapped[str] = mapped_column(String(255))
    country: Mapped[str] = mapped_column(String(128), default="")
    capacity: Mapped[str] = mapped_column(String(128), default="")
    estimated_price_usd: Mapped[float] = mapped_column(Float, default=0.0)
    energy_kw: Mapped[float] = mapped_column(Float, default=0.0)
    warranty_years: Mapped[int] = mapped_column(Integer, default=1)
    specs: Mapped[str] = mapped_column(Text, default="{}")
