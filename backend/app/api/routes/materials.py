from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.material import Material, MaterialCategory
from app.models.user import User, UserRole
from app.schemas.material import MaterialCreate, MaterialOut, MaterialUpdate

router = APIRouter(prefix="/materials", tags=["materials"])

_EDIT_ROLES = (UserRole.ADMIN, UserRole.SENIOR_RD_MANAGER, UserRole.RD_ENGINEER, UserRole.PROCUREMENT_MANAGER)


@router.get("", response_model=list[MaterialOut])
def list_materials(
    category: MaterialCategory | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Material)
    if category:
        q = q.filter(Material.category == category)
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(Material.name.ilike(like), Material.code.ilike(like), Material.chemical_family.ilike(like))
        )
    return q.order_by(Material.category, Material.name).all()


@router.get("/{material_id}", response_model=MaterialOut)
def get_material(material_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    material = db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return material


@router.post("", response_model=MaterialOut, status_code=201)
def create_material(
    payload: MaterialCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_EDIT_ROLES)),
):
    if db.query(Material).filter(Material.code == payload.code).first():
        raise HTTPException(status_code=409, detail="Material code already exists")
    material = Material(**payload.model_dump())
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.patch("/{material_id}", response_model=MaterialOut)
def update_material(
    material_id: int,
    payload: MaterialUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*_EDIT_ROLES)),
):
    material = db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(material, field, value)
    db.commit()
    db.refresh(material)
    return material


@router.delete("/{material_id}", status_code=204)
def delete_material(
    material_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.SENIOR_RD_MANAGER)),
):
    material = db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    db.delete(material)
    db.commit()
