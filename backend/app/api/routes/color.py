import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.ai import color_science
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.color import ColorMatchRecord, RalColor
from app.models.user import User

router = APIRouter(prefix="/color", tags=["color"])


class HexPair(BaseModel):
    target_hex: str
    actual_hex: str


class HexOne(BaseModel):
    hex: str


def _analyze_and_store(db: Session, target_rgb, actual_rgb) -> dict:
    analysis = color_science.analyze_color_pair(target_rgb, actual_rgb)
    rals = db.query(RalColor).all()
    ral_target = color_science.nearest_ral(target_rgb, rals)
    ral_actual = color_science.nearest_ral(actual_rgb, rals)
    analysis["ral_estimate_target"] = ral_target
    analysis["ral_estimate_actual"] = ral_actual

    record = ColorMatchRecord(
        target_hex=analysis["target"]["hex"],
        actual_hex=analysis["actual"]["hex"],
        delta_e=analysis["delta_e_2000"],
        ral_estimate=ral_target["code"] if ral_target else "",
        analysis=json.dumps(analysis),
    )
    db.add(record)
    db.commit()
    analysis["record_id"] = record.id
    return analysis


@router.post("/match")
def match_by_hex(payload: HexPair, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Compare a target (customer) color against a lab sample by hex value."""
    try:
        target = color_science.hex_to_rgb(payload.target_hex)
        actual = color_science.hex_to_rgb(payload.actual_hex)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid hex color value")
    return _analyze_and_store(db, target, actual)


@router.post("/match/upload")
async def match_by_upload(
    customer_sample: UploadFile = File(...),
    lab_sample: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Upload customer and laboratory sample photos; dominant panel colors are
    extracted and compared."""
    try:
        target = color_science.extract_dominant_color(await customer_sample.read())
        actual = color_science.extract_dominant_color(await lab_sample.read())
    except Exception:
        raise HTTPException(status_code=422, detail="Could not read one of the uploaded images")
    return _analyze_and_store(db, target, actual)


@router.post("/convert")
def convert(payload: HexOne, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """RGB / LAB / HEX conversions and RAL estimate for a single color."""
    try:
        rgb = color_science.hex_to_rgb(payload.hex)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid hex color value")
    lab = color_science.rgb_to_lab(*rgb)
    rals = db.query(RalColor).all()
    return {
        "hex": color_science.rgb_to_hex(*rgb),
        "rgb": {"r": rgb[0], "g": rgb[1], "b": rgb[2]},
        "lab": {"l": round(lab[0], 2), "a": round(lab[1], 2), "b": round(lab[2], 2)},
        "ral_estimate": color_science.nearest_ral(rgb, rals),
    }


@router.get("/ral")
def list_ral(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [
        {"code": c.code, "name": c.name, "hex": c.hex}
        for c in db.query(RalColor).order_by(RalColor.code).all()
    ]


@router.get("/history")
def history(limit: int = 25, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    records = (
        db.query(ColorMatchRecord).order_by(ColorMatchRecord.created_at.desc()).limit(limit).all()
    )
    return [
        {
            "id": r.id,
            "target_hex": r.target_hex,
            "actual_hex": r.actual_hex,
            "delta_e": r.delta_e,
            "ral_estimate": r.ral_estimate,
            "created_at": r.created_at,
        }
        for r in records
    ]
