"""Color science engine: sRGB <-> CIELAB conversions, CIEDE2000 Delta E,
RAL estimation, hue-direction diagnosis and pigment correction advice.

All math implemented with NumPy against the D65/2-degree standard illuminant.
"""

from __future__ import annotations

import io
import math

import numpy as np

# D65 reference white
_XN, _YN, _ZN = 95.047, 100.0, 108.883

_RGB_TO_XYZ = np.array(
    [
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ]
)


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return "#{:02X}{:02X}{:02X}".format(
        int(round(max(0, min(255, r)))),
        int(round(max(0, min(255, g)))),
        int(round(max(0, min(255, b)))),
    )


def rgb_to_xyz(r: int, g: int, b: int) -> tuple[float, float, float]:
    srgb = np.array([r, g, b], dtype=float) / 255.0
    linear = np.where(srgb > 0.04045, ((srgb + 0.055) / 1.055) ** 2.4, srgb / 12.92)
    xyz = _RGB_TO_XYZ @ linear * 100.0
    return float(xyz[0]), float(xyz[1]), float(xyz[2])


def xyz_to_lab(x: float, y: float, z: float) -> tuple[float, float, float]:
    def f(t: float) -> float:
        return t ** (1 / 3) if t > 0.008856 else (7.787 * t) + (16 / 116)

    fx, fy, fz = f(x / _XN), f(y / _YN), f(z / _ZN)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def rgb_to_lab(r: int, g: int, b: int) -> tuple[float, float, float]:
    return xyz_to_lab(*rgb_to_xyz(r, g, b))


def delta_e_2000(lab1: tuple[float, float, float], lab2: tuple[float, float, float]) -> float:
    """CIEDE2000 color difference."""
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2

    avg_L = (L1 + L2) / 2.0
    C1 = math.hypot(a1, b1)
    C2 = math.hypot(a2, b2)
    avg_C = (C1 + C2) / 2.0

    G = 0.5 * (1 - math.sqrt(avg_C**7 / (avg_C**7 + 25**7))) if avg_C > 0 else 0.0
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    avg_Cp = (C1p + C2p) / 2.0

    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if C1p > 0 else 0.0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if C2p > 0 else 0.0

    if C1p * C2p == 0:
        dhp = 0.0
        avg_Hp = h1p + h2p
    else:
        diff = h2p - h1p
        if abs(diff) <= 180:
            dhp = diff
        elif diff > 180:
            dhp = diff - 360
        else:
            dhp = diff + 360
        if abs(h1p - h2p) <= 180:
            avg_Hp = (h1p + h2p) / 2.0
        elif h1p + h2p < 360:
            avg_Hp = (h1p + h2p + 360) / 2.0
        else:
            avg_Hp = (h1p + h2p - 360) / 2.0

    dLp = L2 - L1
    dCp = C2p - C1p
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2.0))

    T = (
        1
        - 0.17 * math.cos(math.radians(avg_Hp - 30))
        + 0.24 * math.cos(math.radians(2 * avg_Hp))
        + 0.32 * math.cos(math.radians(3 * avg_Hp + 6))
        - 0.20 * math.cos(math.radians(4 * avg_Hp - 63))
    )
    SL = 1 + (0.015 * (avg_L - 50) ** 2) / math.sqrt(20 + (avg_L - 50) ** 2)
    SC = 1 + 0.045 * avg_Cp
    SH = 1 + 0.015 * avg_Cp * T
    d_theta = 30 * math.exp(-(((avg_Hp - 275) / 25) ** 2))
    RC = 2 * math.sqrt(avg_Cp**7 / (avg_Cp**7 + 25**7)) if avg_Cp > 0 else 0.0
    RT = -RC * math.sin(math.radians(2 * d_theta))

    return math.sqrt(
        (dLp / SL) ** 2
        + (dCp / SC) ** 2
        + (dHp / SH) ** 2
        + RT * (dCp / SC) * (dHp / SH)
    )


def extract_dominant_color(image_bytes: bytes) -> tuple[int, int, int]:
    """Average color of the central region of an uploaded sample image."""
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img.thumbnail((200, 200))
    arr = np.asarray(img, dtype=float)
    h, w = arr.shape[:2]
    # central 60% crop avoids background edges on panel photos
    crop = arr[int(h * 0.2) : int(h * 0.8) or h, int(w * 0.2) : int(w * 0.8) or w]
    if crop.size == 0:
        crop = arr
    mean = crop.reshape(-1, 3).mean(axis=0)
    return int(round(mean[0])), int(round(mean[1])), int(round(mean[2]))


# Direction thresholds on LAB deltas (actual - target)
_L_TOL, _AB_TOL = 2.0, 2.0

# Pigment guidance per direction of error
_PIGMENT_ADVICE = {
    "too_dark": {
        "diagnosis": "The sample is darker than the target (lower L*).",
        "cause": "Excess black pigment (carbon black) or under-dosed white/opacifying pigment (TiO2).",
        "action": "Reduce carbon black or increase titanium dioxide (TiO2) loading.",
    },
    "too_light": {
        "diagnosis": "The sample is lighter than the target (higher L*).",
        "cause": "Excess TiO2 or insufficient chromatic/black pigment.",
        "action": "Reduce TiO2 or increase the main chromatic pigment.",
    },
    "too_red": {
        "diagnosis": "The sample has a red cast (higher a*).",
        "cause": "Excess red pigment (iron oxide red, quinacridone) relative to target.",
        "action": "Reduce red pigment or add a small amount of green shading pigment.",
    },
    "too_green": {
        "diagnosis": "The sample has a green cast (lower a*).",
        "cause": "Excess green/phthalo pigment or insufficient red component.",
        "action": "Reduce green pigment or increase the red pigment component.",
    },
    "too_yellow": {
        "diagnosis": "The sample has a yellow cast (higher b*).",
        "cause": "Excess yellow pigment (iron oxide yellow, bismuth vanadate) or resin yellowing from over-cure.",
        "action": "Reduce yellow pigment, verify cure schedule, or add a trace of violet/blue shading pigment.",
    },
    "too_blue": {
        "diagnosis": "The sample has a blue cast (lower b*).",
        "cause": "Excess blue pigment (ultramarine, phthalo blue).",
        "action": "Reduce blue pigment or increase yellow component slightly.",
    },
    "too_gray": {
        "diagnosis": "The sample is desaturated / grayish (low chroma vs target).",
        "cause": "Pigment dilution by fillers, low pigment loading, or contamination by black.",
        "action": "Increase chromatic pigment loading and check filler ratio and dispersion quality.",
    },
}


def analyze_color_pair(target_rgb: tuple[int, int, int], actual_rgb: tuple[int, int, int]) -> dict:
    """Full comparison of a target vs. lab sample: conversions, Delta E, diagnosis,
    and quantified pigment correction recommendations."""
    t_lab = rgb_to_lab(*target_rgb)
    a_lab = rgb_to_lab(*actual_rgb)
    de = delta_e_2000(t_lab, a_lab)

    dL = a_lab[0] - t_lab[0]
    da = a_lab[1] - t_lab[1]
    db = a_lab[2] - t_lab[2]
    t_chroma = math.hypot(t_lab[1], t_lab[2])
    a_chroma = math.hypot(a_lab[1], a_lab[2])
    d_chroma = a_chroma - t_chroma

    directions: list[str] = []
    if dL < -_L_TOL:
        directions.append("too_dark")
    elif dL > _L_TOL:
        directions.append("too_light")
    if da > _AB_TOL:
        directions.append("too_red")
    elif da < -_AB_TOL:
        directions.append("too_green")
    if db > _AB_TOL:
        directions.append("too_yellow")
    elif db < -_AB_TOL:
        directions.append("too_blue")
    if d_chroma < -4.0 and t_chroma > 10:
        directions.append("too_gray")

    issues = []
    for d in directions:
        advice = _PIGMENT_ADVICE[d]
        issues.append({"direction": d.replace("_", " "), **advice})

    corrections = _pigment_corrections(dL, da, db)

    if de < 0.5:
        verdict = "Excellent match — imperceptible difference."
    elif de < 1.0:
        verdict = "Very good match — visible only to a trained observer."
    elif de < 2.0:
        verdict = "Good match — within typical commercial tolerance."
    elif de < 3.5:
        verdict = "Marginal — noticeable difference, correction recommended."
    elif de < 5.0:
        verdict = "Poor match — clearly different color, correction required."
    else:
        verdict = "Failed match — significant deviation, reformulation required."

    return {
        "target": _color_block(target_rgb, t_lab),
        "actual": _color_block(actual_rgb, a_lab),
        "delta_e_2000": round(de, 2),
        "delta_l": round(dL, 2),
        "delta_a": round(da, 2),
        "delta_b": round(db, 2),
        "delta_chroma": round(d_chroma, 2),
        "verdict": verdict,
        "pass": de < 2.0,
        "issues": issues,
        "corrections": corrections,
    }


def _color_block(rgb: tuple[int, int, int], lab: tuple[float, float, float]) -> dict:
    return {
        "rgb": {"r": rgb[0], "g": rgb[1], "b": rgb[2]},
        "hex": rgb_to_hex(*rgb),
        "lab": {"l": round(lab[0], 2), "a": round(lab[1], 2), "b": round(lab[2], 2)},
    }


def _pigment_corrections(dL: float, da: float, db: float) -> list[dict]:
    """Translate LAB deltas into approximate pigment loading adjustments.

    Rule of thumb calibrated to typical powder coatings: ~1 unit of L* shift
    corresponds to roughly 0.8% relative change in TiO2/black balance; a*/b*
    shifts map to ~0.6% relative chromatic pigment change per unit.
    """
    out: list[dict] = []

    def add(pigment: str, change_pct: float, action: str, reason: str) -> None:
        out.append(
            {
                "pigment": pigment,
                "adjustment_pct_relative": round(change_pct, 2),
                "action": action,
                "reason": reason,
            }
        )

    if dL < -_L_TOL:  # too dark -> lighten
        add("Titanium Dioxide (TiO2)", abs(dL) * 0.8, "increase", "Raise L* (lighten)")
        add("Carbon Black", -min(abs(dL) * 0.5, 50), "reduce", "Reduce darkness")
    elif dL > _L_TOL:  # too light -> darken
        add("Carbon Black", dL * 0.15, "increase", "Lower L* (darken); dose carefully — carbon black is very strong")
        add("Titanium Dioxide (TiO2)", -min(dL * 0.8, 30), "reduce", "Reduce whiteness")

    if da > _AB_TOL:  # too red
        add("Red pigment (e.g. Iron Oxide Red / Quinacridone)", -min(da * 0.6, 40), "reduce", "Lower a* (reduce red cast)")
    elif da < -_AB_TOL:  # too green
        add("Red pigment component", abs(da) * 0.6, "increase", "Raise a* (counteract green cast)")

    if db > _AB_TOL:  # too yellow
        add("Yellow pigment (e.g. Iron Oxide Yellow)", -min(db * 0.6, 40), "reduce", "Lower b* (reduce yellow cast)")
        add("Violet/Blue shading pigment", db * 0.05, "increase", "Neutralize residual yellowness (trace addition)")
    elif db < -_AB_TOL:  # too blue
        add("Blue pigment (e.g. Ultramarine / Phthalo Blue)", -min(abs(db) * 0.6, 40), "reduce", "Raise b* (reduce blue cast)")

    if not out:
        out.append(
            {
                "pigment": "None",
                "adjustment_pct_relative": 0.0,
                "action": "none",
                "reason": "Color is within tolerance — no pigment correction needed.",
            }
        )
    return out


def nearest_ral(rgb: tuple[int, int, int], ral_colors: list) -> dict | None:
    """Nearest RAL classic color by CIEDE2000. `ral_colors` are ORM rows
    with .code, .name, .hex, .r, .g, .b attributes."""
    if not ral_colors:
        return None
    lab = rgb_to_lab(*rgb)
    best, best_de = None, float("inf")
    for c in ral_colors:
        de = delta_e_2000(lab, rgb_to_lab(c.r, c.g, c.b))
        if de < best_de:
            best, best_de = c, de
    return {"code": best.code, "name": best.name, "hex": best.hex, "delta_e": round(best_de, 2)}
