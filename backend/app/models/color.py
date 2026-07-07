from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class RalColor(Base):
    __tablename__ = "ral_colors"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    hex: Mapped[str] = mapped_column(String(8))
    r: Mapped[int] = mapped_column(Integer)
    g: Mapped[int] = mapped_column(Integer)
    b: Mapped[int] = mapped_column(Integer)


class ColorMatchRecord(Base):
    __tablename__ = "color_match_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    target_hex: Mapped[str] = mapped_column(String(8))
    actual_hex: Mapped[str] = mapped_column(String(8))
    delta_e: Mapped[float] = mapped_column(Float)
    ral_estimate: Mapped[str] = mapped_column(String(16), default="")
    analysis: Mapped[str] = mapped_column(Text, default="{}")  # JSON analysis payload
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
