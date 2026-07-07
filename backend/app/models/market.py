from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class MarketInsight(Base):
    __tablename__ = "market_insights"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(64), index=True)
    # technology | trend | shortage | price | alternative | sustainability | regulation
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str] = mapped_column(Text)
    impact: Mapped[str] = mapped_column(String(16), default="medium")  # low | medium | high
    region: Mapped[str] = mapped_column(String(128), default="Global")
    published_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
