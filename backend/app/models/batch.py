import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class BatchStatus(str, enum.Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"
    FAILED = "failed"


class ProductionBatch(Base):
    __tablename__ = "production_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    formulation_id: Mapped[int] = mapped_column(ForeignKey("formulations.id"))
    size_kg: Mapped[float] = mapped_column(Float, default=100.0)
    scale: Mapped[str] = mapped_column(String(32), default="production")
    status: Mapped[BatchStatus] = mapped_column(
        Enum(BatchStatus, values_callable=lambda e: [m.value for m in e]),
        default=BatchStatus.PLANNED,
    )
    cost_total: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    formulation = relationship("Formulation", lazy="joined")
    qc_records: Mapped[list["QCRecord"]] = relationship(
        back_populates="batch", cascade="all, delete-orphan"
    )


class QCRecord(Base):
    __tablename__ = "qc_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("production_batches.id"))
    test_name: Mapped[str] = mapped_column(String(128))
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(32), default="")
    result: Mapped[str] = mapped_column(String(16), default="pass")  # pass | fail
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    batch: Mapped[ProductionBatch] = relationship(back_populates="qc_records")
