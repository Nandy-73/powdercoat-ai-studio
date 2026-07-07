from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    company: Mapped[str] = mapped_column(String(255), index=True)
    country: Mapped[str] = mapped_column(String(128), index=True)
    website: Mapped[str] = mapped_column(String(512), default="")
    contact_email: Mapped[str] = mapped_column(String(255), default="")
    contact_phone: Mapped[str] = mapped_column(String(64), default="")
    certifications: Mapped[str] = mapped_column(Text, default="")
    distributor_info: Mapped[str] = mapped_column(Text, default="")
    rating: Mapped[float] = mapped_column(Float, default=4.0)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=30)

    products: Mapped[list["SupplierProduct"]] = relationship(
        back_populates="supplier", cascade="all, delete-orphan"
    )


class SupplierProduct(Base):
    __tablename__ = "supplier_products"

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"))
    product_name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(64), default="")
    price_per_kg: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    moq_kg: Mapped[float] = mapped_column(Float, default=25.0)

    supplier: Mapped[Supplier] = relationship(back_populates="products")


class MaterialPrice(Base):
    """Country-level price benchmarks for global price intelligence."""

    __tablename__ = "material_prices"

    id: Mapped[int] = mapped_column(primary_key=True)
    material_name: Mapped[str] = mapped_column(String(255), index=True)
    category: Mapped[str] = mapped_column(String(64), index=True)
    country: Mapped[str] = mapped_column(String(128), index=True)
    price_per_kg: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    quality_score: Mapped[float] = mapped_column(Float, default=4.0)  # 1-5
    delivery_days: Mapped[int] = mapped_column(Integer, default=30)
    supplier_rating: Mapped[float] = mapped_column(Float, default=4.0)
    import_available: Mapped[int] = mapped_column(Integer, default=1)
