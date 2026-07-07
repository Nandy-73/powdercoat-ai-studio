import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class UserRole(str, enum.Enum):
    ADMIN = "administrator"
    SENIOR_RD_MANAGER = "senior_rd_manager"
    RD_ENGINEER = "rd_engineer"
    COLOR_ENGINEER = "color_matching_engineer"
    PRODUCTION_MANAGER = "production_manager"
    QC_ENGINEER = "qc_engineer"
    PROCUREMENT_MANAGER = "procurement_manager"
    SALES_MANAGER = "sales_manager"
    VIEWER = "viewer"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, values_callable=lambda e: [m.value for m in e]),
        default=UserRole.VIEWER,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
