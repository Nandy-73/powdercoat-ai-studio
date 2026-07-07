"""Formulation mathematics and the AI validation rule engine.

Works on a normalized item structure:
    {"name", "category", "weight_kg", "density_g_cm3", "cost_per_kg"}
"""

from __future__ import annotations

from app.models.material import MaterialCategory

BINDER_CATEGORIES = {MaterialCategory.RESIN.value, MaterialCategory.HARDENER.value}
ADDITIVE_CATEGORIES = {
    MaterialCategory.FLOW_AGENT.value,
    MaterialCategory.BENZOIN.value,
    MaterialCategory.DEGASSING_AGENT.value,
    MaterialCategory.TEXTURE_ADDITIVE.value,
    MaterialCategory.SPECIAL_ADDITIVE.value,
    MaterialCategory.WAX.value,
}

# Recommended resin:hardener weight ratios per chemistry (resin parts per 1 part hardener)
SYSTEM_RATIOS = {
    "epoxy": (0.9, 1.1),        # ~50/50 to 55/45 epoxy/hardener systems vary; use ratio window
    "polyester": (12.0, 19.0),  # polyester/TGIC ~93/7 -> ratio ~13.3
    "hybrid": (1.0, 2.4),       # 50/50 to 70/30 epoxy-polyester
    "polyurethane": (3.5, 6.5), # polyester/blocked isocyanate ~80/20
    "acrylic": (5.0, 9.0),
    "custom": (0.5, 20.0),
}

CATEGORY_LIMITS = {
    # category: (min_pct, max_pct, hard_max_pct)
    MaterialCategory.RESIN.value: (45.0, 75.0, 95.0),
    MaterialCategory.HARDENER.value: (2.0, 35.0, 55.0),
    MaterialCategory.PIGMENT.value: (0.0, 35.0, 45.0),
    MaterialCategory.FILLER.value: (0.0, 35.0, 45.0),
    MaterialCategory.FLOW_AGENT.value: (0.5, 1.5, 2.5),
    MaterialCategory.BENZOIN.value: (0.2, 0.8, 1.5),
    MaterialCategory.DEGASSING_AGENT.value: (0.0, 1.0, 2.0),
    MaterialCategory.TEXTURE_ADDITIVE.value: (0.0, 3.0, 6.0),
    MaterialCategory.SPECIAL_ADDITIVE.value: (0.0, 5.0, 10.0),
    MaterialCategory.WAX.value: (0.0, 3.0, 5.0),
}


def compute_metrics(items: list[dict]) -> dict:
    """Weight, percentage, ratio, PVC, binder and cost mathematics for a formulation."""
    total = sum(i["weight_kg"] for i in items)
    if total <= 0:
        return {
            "total_weight_kg": 0.0,
            "cost_per_kg": 0.0,
            "total_cost": 0.0,
            "resin_pct": 0.0,
            "hardener_pct": 0.0,
            "pigment_pct": 0.0,
            "filler_pct": 0.0,
            "additive_pct": 0.0,
            "binder_content_pct": 0.0,
            "resin_to_hardener_ratio": None,
            "pigment_loading_pct": 0.0,
            "pvc_pct": 0.0,
            "composition": [],
        }

    by_cat: dict[str, float] = {}
    total_cost = 0.0
    composition = []
    for i in items:
        pct = i["weight_kg"] / total * 100.0
        by_cat[i["category"]] = by_cat.get(i["category"], 0.0) + pct
        total_cost += i["weight_kg"] * i.get("cost_per_kg", 0.0)
        composition.append(
            {
                "name": i["name"],
                "category": i["category"],
                "weight_kg": round(i["weight_kg"], 4),
                "pct": round(pct, 2),
                "cost": round(i["weight_kg"] * i.get("cost_per_kg", 0.0), 2),
            }
        )

    resin = by_cat.get(MaterialCategory.RESIN.value, 0.0)
    hardener = by_cat.get(MaterialCategory.HARDENER.value, 0.0)
    pigment = by_cat.get(MaterialCategory.PIGMENT.value, 0.0)
    filler = by_cat.get(MaterialCategory.FILLER.value, 0.0)
    additives = sum(by_cat.get(c, 0.0) for c in ADDITIVE_CATEGORIES)
    binder = resin + hardener

    # Pigment Volume Concentration: volume of pigment+filler over total solids volume
    vol_pig = sum(
        i["weight_kg"] / max(i.get("density_g_cm3", 1.0), 0.1)
        for i in items
        if i["category"] in (MaterialCategory.PIGMENT.value, MaterialCategory.FILLER.value)
    )
    vol_total = sum(
        i["weight_kg"] / max(i.get("density_g_cm3", 1.0), 0.1) for i in items
    )
    pvc = vol_pig / vol_total * 100.0 if vol_total > 0 else 0.0

    return {
        "total_weight_kg": round(total, 4),
        "cost_per_kg": round(total_cost / total, 3),
        "total_cost": round(total_cost, 2),
        "resin_pct": round(resin, 2),
        "hardener_pct": round(hardener, 2),
        "pigment_pct": round(pigment, 2),
        "filler_pct": round(filler, 2),
        "additive_pct": round(additives, 2),
        "binder_content_pct": round(binder, 2),
        "resin_to_hardener_ratio": round(resin / hardener, 2) if hardener > 0 else None,
        "pigment_loading_pct": round(pigment, 2),
        "pvc_pct": round(pvc, 2),
        "composition": composition,
    }


# Known incompatible chemical family pairs
_INCOMPATIBLE = [
    ("tgic", "epoxy resin", "TGIC hardener with epoxy resin: mismatched cure chemistry causes under-cure and poor film properties."),
    ("phthalo", "iron oxide", "Phthalocyanine and iron oxide pigments can show flocculation and shade drift in high-shear extrusion."),
    ("hydroxyalkylamide", "epoxy resin", "HAA (Primid) hardeners cure carboxyl polyesters, not epoxy resins — the film will not crosslink."),
]


def validate_formulation(items: list[dict], system: str, cure_temp_c: float = 180.0,
                         cure_time_min: float = 10.0) -> dict:
    """AI validation: detects composition errors, explains each issue,
    and recommends corrections. Returns a scored report."""
    metrics = compute_metrics(items)
    issues: list[dict] = []

    def issue(severity: str, code: str, message: str, explanation: str, correction: str) -> None:
        issues.append(
            {
                "severity": severity,  # error | warning | info
                "code": code,
                "message": message,
                "explanation": explanation,
                "correction": correction,
            }
        )

    if metrics["total_weight_kg"] <= 0:
        issue(
            "error", "EMPTY", "Formulation has no materials.",
            "A formulation must contain at least a resin and a curing agent.",
            "Add a resin, hardener, pigments and standard additives.",
        )
        return {"metrics": metrics, "issues": issues, "score": 0, "verdict": "invalid"}

    # --- Resin ratio ---
    lo, hi = SYSTEM_RATIOS.get(system, SYSTEM_RATIOS["custom"])
    ratio = metrics["resin_to_hardener_ratio"]
    if metrics["hardener_pct"] == 0 and system != "custom":
        issue(
            "error", "NO_HARDENER", "No hardener / curing agent present.",
            "Thermoset powder coatings require a crosslinker; without one the film never cures.",
            f"Add the appropriate hardener for a {system} system (e.g. "
            + {"epoxy": "dicyandiamide or phenolic hardener",
               "polyester": "TGIC or HAA (Primid)",
               "hybrid": "epoxy resin acts as co-reactant — check resin balance",
               "polyurethane": "blocked isocyanate (e.g. IPDI adduct)",
               "acrylic": "dodecanedioic acid (DDDA)"}.get(system, "a suitable crosslinker") + ".",
        )
    elif ratio is not None and not (lo <= ratio <= hi):
        direction = "high" if ratio > hi else "low"
        issue(
            "error", "RESIN_RATIO",
            f"Resin-to-hardener ratio {ratio}:1 is out of range for {system} ({lo}–{hi}:1).",
            "An off-stoichiometry binder leaves unreacted groups: under-cure, brittleness, "
            "poor chemical resistance and low impact strength.",
            f"{'Reduce resin or increase hardener' if direction == 'high' else 'Increase resin or reduce hardener'} "
            f"to bring the ratio inside {lo}–{hi}:1.",
        )

    # --- Category loading windows ---
    cat_pct: dict[str, float] = {}
    for i in items:
        pct = i["weight_kg"] / metrics["total_weight_kg"] * 100.0
        cat_pct[i["category"]] = cat_pct.get(i["category"], 0.0) + pct

    labels = {
        "resin": "Resin", "hardener": "Hardener", "pigment": "Pigment", "filler": "Filler",
        "flow_agent": "Flow agent", "benzoin": "Benzoin", "degassing_agent": "Degassing agent",
        "texture_additive": "Texture additive", "special_additive": "Special additive", "wax": "Wax",
    }
    explanations_high = {
        "pigment": "Pigment overload starves the binder: poor flow, low gloss, weak mechanicals and extrusion torque spikes.",
        "flow_agent": "Excess flow agent migrates to the surface causing craters, haze, poor recoatability and intercoat adhesion failure.",
        "benzoin": "Excess benzoin yellows the film, especially in white and light shades, and can cause plate-out.",
        "texture_additive": "Texture additive overload gives an uncontrolled, coarse or irregular texture and can destroy gloss uniformity.",
        "filler": "High filler loading raises PVC above CPVC: porous film, poor gloss, reduced corrosion protection.",
        "wax": "Excess wax reduces intercoat adhesion and can cause surface defects during recoat.",
        "hardener": "Excess hardener leaves unreacted crosslinker: brittleness, yellowing and blooming.",
        "resin": "Binder-rich formulations are costly and can sag or show excessive flow on vertical surfaces.",
        "degassing_agent": "Excess degassing agent can cause surface defects and gloss reduction.",
        "special_additive": "Very high special-additive loadings usually indicate a dosing error.",
    }
    for cat, (mn, mx, hard) in CATEGORY_LIMITS.items():
        pct = cat_pct.get(cat, 0.0)
        label = labels.get(cat, cat)
        if pct > hard:
            issue(
                "error", f"{cat.upper()}_OVERLOAD",
                f"{label} at {pct:.1f}% exceeds the hard limit of {hard}%.",
                explanations_high.get(cat, f"{label} loading is far outside industrial practice."),
                f"Reduce {label.lower()} to below {mx}% (typical window {mn}–{mx}%).",
            )
        elif pct > mx:
            issue(
                "warning", f"{cat.upper()}_HIGH",
                f"{label} at {pct:.1f}% is above the typical maximum of {mx}%.",
                explanations_high.get(cat, f"{label} loading is above common practice."),
                f"Consider reducing {label.lower()} toward {mn}–{mx}%.",
            )
        elif cat in ("flow_agent", "benzoin") and 0 < pct < mn:
            issue(
                "warning", f"{cat.upper()}_LOW",
                f"{label} at {pct:.2f}% is below the typical minimum of {mn}%.",
                "Insufficient flow/degassing additives cause orange peel, pinholes and poor leveling.",
                f"Increase {label.lower()} to {mn}–{mx}%.",
            )
    if cat_pct.get("flow_agent", 0.0) == 0:
        issue(
            "warning", "NO_FLOW_AGENT", "No flow agent in the formulation.",
            "Without a flow/leveling agent (polyacrylate type) the film shows craters and heavy orange peel.",
            "Add 0.8–1.5% of a polyacrylate flow agent (e.g. Resiflow PV5, Modaflow).",
        )
    if cat_pct.get("benzoin", 0.0) == 0:
        issue(
            "info", "NO_BENZOIN", "No degassing agent (benzoin).",
            "Benzoin releases trapped air/volatiles during cure; without it pinholes appear above ~80 µm film builds.",
            "Add 0.3–0.5% benzoin.",
        )

    # --- PVC ---
    pvc = metrics["pvc_pct"]
    if pvc > 45:
        issue(
            "error", "PVC_HIGH", f"PVC of {pvc:.1f}% is above the critical range.",
            "Above the critical PVC the binder can no longer wet all pigment/filler particles: "
            "porous, low-gloss, mechanically weak film with poor corrosion resistance.",
            "Reduce filler/pigment volume or increase binder content to bring PVC below ~40%.",
        )
    elif pvc > 38:
        issue(
            "warning", "PVC_ELEVATED", f"PVC of {pvc:.1f}% is close to critical.",
            "Gloss and flexibility drop rapidly as PVC approaches CPVC.",
            "Target PVC of 20–35% for gloss finishes.",
        )

    # --- Cure schedule ---
    if cure_temp_c < 140:
        issue(
            "error", "CURE_TEMP_LOW", f"Cure temperature {cure_temp_c:.0f}°C is too low.",
            "Standard powder chemistries need ≥150°C object temperature; under-cured films fail MEK rub and impact tests.",
            "Use 160–200°C, or specify a low-bake catalyzed system for 140–150°C.",
        )
    elif cure_temp_c > 220:
        issue(
            "warning", "CURE_TEMP_HIGH", f"Cure temperature {cure_temp_c:.0f}°C risks over-bake.",
            "Over-bake yellows whites and light shades and can degrade gloss.",
            "Reduce to 180–200°C unless the chemistry requires more.",
        )
    if cure_time_min < 6 and cure_temp_c < 200:
        issue(
            "warning", "CURE_TIME_SHORT", f"Cure time {cure_time_min:.0f} min may be insufficient at {cure_temp_c:.0f}°C.",
            "Short dwell risks under-cure unless temperature is raised.",
            "Use ≥10 min at 180°C or ≥6 min at 200°C (object temperature).",
        )

    # --- Incompatibilities ---
    names = [(i["name"] + " " + i.get("chemical_family", "")).lower() for i in items]
    joined = " | ".join(names)
    for a, b, why in _INCOMPATIBLE:
        if a in joined and b in joined:
            issue(
                "error", "INCOMPATIBLE",
                f"Incompatible combination detected: '{a}' with '{b}'.",
                why,
                "Replace one of the two components with a compatible alternative.",
            )

    # --- Score ---
    score = 100
    for it in issues:
        score -= {"error": 20, "warning": 8, "info": 2}[it["severity"]]
    score = max(0, min(100, score))
    verdict = "excellent" if score >= 90 else "good" if score >= 75 else "needs_work" if score >= 50 else "poor"

    return {"metrics": metrics, "issues": issues, "score": score, "verdict": verdict}


def scale_formulation(items: list[dict], target_kg: float) -> list[dict]:
    """Scale to a target batch size, preserving percentages exactly."""
    total = sum(i["weight_kg"] for i in items)
    if total <= 0:
        return []
    factor = target_kg / total
    return [
        {**i, "weight_kg": round(i["weight_kg"] * factor, 4)}
        for i in items
    ]
