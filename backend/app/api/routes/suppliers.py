from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.supplier import MaterialPrice, Supplier, SupplierProduct
from app.models.user import User, UserRole
from app.schemas.misc import PriceBenchmarkOut, SupplierCreate, SupplierOut

router = APIRouter(prefix="/suppliers", tags=["suppliers"])
prices_router = APIRouter(prefix="/prices", tags=["price-intelligence"])


@router.get("", response_model=list[SupplierOut])
def list_suppliers(
    country: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Supplier)
    if country:
        q = q.filter(Supplier.country == country)
    if search:
        q = q.filter(Supplier.company.ilike(f"%{search}%"))
    return q.order_by(Supplier.rating.desc()).all()


@router.post("", response_model=SupplierOut, status_code=201)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.PROCUREMENT_MANAGER)),
):
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("/{supplier_id}", response_model=SupplierOut)
def get_supplier(supplier_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@prices_router.get("", response_model=list[PriceBenchmarkOut])
def list_prices(
    material: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MaterialPrice)
    if material:
        q = q.filter(MaterialPrice.material_name.ilike(f"%{material}%"))
    if category:
        q = q.filter(MaterialPrice.category == category)
    return q.order_by(MaterialPrice.material_name, MaterialPrice.price_per_kg).all()


@prices_router.get("/materials")
def price_materials(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(MaterialPrice.material_name).distinct().order_by(MaterialPrice.material_name).all()
    return [r[0] for r in rows]


@prices_router.get("/rank")
def rank_countries(
    material: str,
    criterion: str = "price",  # price | quality | delivery | rating | overall
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Rank sourcing countries for a raw material."""
    rows = (
        db.query(MaterialPrice)
        .filter(MaterialPrice.material_name.ilike(f"%{material}%"))
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="No price data for that material")

    def overall(r: MaterialPrice) -> float:
        prices = [x.price_per_kg for x in rows]
        lo, hi = min(prices), max(prices)
        price_score = 1.0 if hi == lo else 1 - (r.price_per_kg - lo) / (hi - lo)
        return round(
            price_score * 40 + r.quality_score / 5 * 25 + (1 - min(r.delivery_days, 90) / 90) * 15
            + r.supplier_rating / 5 * 15 + r.import_available * 5,
            1,
        )

    keys = {
        "price": lambda r: (r.price_per_kg, -r.quality_score),
        "quality": lambda r: (-r.quality_score, r.price_per_kg),
        "delivery": lambda r: (r.delivery_days, r.price_per_kg),
        "rating": lambda r: (-r.supplier_rating, r.price_per_kg),
        "overall": lambda r: -overall(r),
    }
    ranked = sorted(rows, key=keys.get(criterion, keys["overall"]))
    return [
        {
            "rank": i + 1,
            "country": r.country,
            "material": r.material_name,
            "price_per_kg": r.price_per_kg,
            "currency": r.currency,
            "quality_score": r.quality_score,
            "delivery_days": r.delivery_days,
            "supplier_rating": r.supplier_rating,
            "import_available": bool(r.import_available),
            "overall_score": overall(r),
        }
        for i, r in enumerate(ranked)
    ]


@prices_router.get("/compare")
def compare_countries(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Average price level per country across all benchmarked materials."""
    rows = (
        db.query(
            MaterialPrice.country,
            func.avg(MaterialPrice.price_per_kg).label("avg_price"),
            func.avg(MaterialPrice.quality_score).label("avg_quality"),
            func.avg(MaterialPrice.delivery_days).label("avg_delivery"),
            func.count(MaterialPrice.id).label("n"),
        )
        .group_by(MaterialPrice.country)
        .all()
    )
    return [
        {
            "country": r.country,
            "avg_price_per_kg": round(float(r.avg_price), 2),
            "avg_quality": round(float(r.avg_quality), 2),
            "avg_delivery_days": round(float(r.avg_delivery), 1),
            "materials_tracked": r.n,
        }
        for r in sorted(rows, key=lambda x: float(x.avg_price))
    ]
