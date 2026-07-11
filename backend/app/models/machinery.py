from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
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


class IngestionSource(Base):
    """A web page the AI scan reads to discover new machines / offers."""

    __tablename__ = "ingestion_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(1024))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_status: Mapped[str] = mapped_column(String(255), default="never run")


class MachineSuggestion(Base):
    """A machine proposed by the AI scan, awaiting human approval."""

    __tablename__ = "machine_suggestions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    machine_type: Mapped[str] = mapped_column(String(64), default="other")
    manufacturer: Mapped[str] = mapped_column(String(255), default="")
    country: Mapped[str] = mapped_column(String(128), default="")
    capacity: Mapped[str] = mapped_column(String(128), default="")
    estimated_price_usd: Mapped[float] = mapped_column(Float, default=0.0)
    energy_kw: Mapped[float] = mapped_column(Float, default=0.0)
    source_name: Mapped[str] = mapped_column(String(255), default="")
    source_url: Mapped[str] = mapped_column(String(1024), default="")
    excerpt: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)  # 0-1
    method: Mapped[str] = mapped_column(String(32), default="heuristic")  # heuristic | ai
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|approved|rejected
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
