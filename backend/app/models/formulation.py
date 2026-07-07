import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ChemistrySystem(str, enum.Enum):
    EPOXY = "epoxy"
    POLYESTER = "polyester"
    HYBRID = "hybrid"
    POLYURETHANE = "polyurethane"
    ACRYLIC = "acrylic"
    CUSTOM = "custom"


class FormulationStatus(str, enum.Enum):
    DRAFT = "draft"
    TRIAL = "trial"
    APPROVED = "approved"
    PRODUCTION = "production"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class Formulation(Base):
    __tablename__ = "formulations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    system: Mapped[ChemistrySystem] = mapped_column(
        Enum(ChemistrySystem, values_callable=lambda e: [m.value for m in e])
    )
    status: Mapped[FormulationStatus] = mapped_column(
        Enum(FormulationStatus, values_callable=lambda e: [m.value for m in e]),
        default=FormulationStatus.DRAFT,
    )
    description: Mapped[str] = mapped_column(Text, default="")
    target_finish: Mapped[str] = mapped_column(String(64), default="smooth")
    target_gloss: Mapped[float] = mapped_column(Float, default=90.0)
    cure_temp_c: Mapped[float] = mapped_column(Float, default=180.0)
    cure_time_min: Mapped[float] = mapped_column(Float, default=10.0)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    items: Mapped[list["FormulationItem"]] = relationship(
        back_populates="formulation", cascade="all, delete-orphan"
    )
    versions: Mapped[list["FormulationVersion"]] = relationship(
        back_populates="formulation", cascade="all, delete-orphan"
    )
    trials: Mapped[list["Trial"]] = relationship(
        back_populates="formulation", cascade="all, delete-orphan"
    )


class FormulationItem(Base):
    __tablename__ = "formulation_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    formulation_id: Mapped[int] = mapped_column(ForeignKey("formulations.id"))
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"))
    weight_kg: Mapped[float] = mapped_column(Float, default=0.0)

    formulation: Mapped[Formulation] = relationship(back_populates="items")
    material = relationship("Material", lazy="joined")


class FormulationVersion(Base):
    __tablename__ = "formulation_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    formulation_id: Mapped[int] = mapped_column(ForeignKey("formulations.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    snapshot: Mapped[str] = mapped_column(Text)  # JSON snapshot of items
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    formulation: Mapped[Formulation] = relationship(back_populates="versions")


class Trial(Base):
    __tablename__ = "trials"

    id: Mapped[int] = mapped_column(primary_key=True)
    formulation_id: Mapped[int] = mapped_column(ForeignKey("formulations.id"))
    result: Mapped[str] = mapped_column(String(32), default="pending")  # pass | fail | pending
    gloss_measured: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    formulation: Mapped[Formulation] = relationship(back_populates="trials")
