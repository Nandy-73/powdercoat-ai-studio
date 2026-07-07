"""Built-in AI assistant: intent parsing over natural-language R&D requests,
routed to the platform's engines (cost, optimization, color, knowledge base)."""

from __future__ import annotations

import json
import re

from sqlalchemy.orm import Session

from app.ai import color_science
from app.ai.cost_intelligence import cost_breakdown, suggest_alternatives
from app.ai.formulation_engine import compute_metrics, validate_formulation
from app.ai.optimizer import OptimizationTargets, optimize
from app.models.color import RalColor
from app.models.formulation import Formulation


def _items_from_formulation(f: Formulation) -> list[dict]:
    return [
        {
            "material_id": it.material_id,
            "name": it.material.name,
            "category": it.material.category.value,
            "chemical_family": it.material.chemical_family,
            "weight_kg": it.weight_kg,
            "density_g_cm3": it.material.density_g_cm3,
            "cost_per_kg": it.material.cost_per_kg,
        }
        for it in f.items
    ]


_STARTER_FORMULATIONS = {
    "polyester": [
        ("Carboxyl Polyester Resin (AV 32)", "resin", 57.0),
        ("TGIC Hardener", "hardener", 4.3),
        ("Titanium Dioxide (TiO2) Rutile", "pigment", 25.0),
        ("Barium Sulphate (Blanc Fixe)", "filler", 11.5),
        ("Polyacrylate Flow Agent", "flow_agent", 1.2),
        ("Benzoin", "benzoin", 0.5),
        ("Carnauba Wax", "wax", 0.5),
    ],
    "epoxy": [
        ("Bisphenol-A Epoxy Resin (EEW 750)", "resin", 55.0),
        ("Phenolic Hardener", "hardener", 27.0),
        ("Titanium Dioxide (TiO2) Rutile", "pigment", 8.0),
        ("Barium Sulphate (Blanc Fixe)", "filler", 8.3),
        ("Polyacrylate Flow Agent", "flow_agent", 1.2),
        ("Benzoin", "benzoin", 0.5),
    ],
    "hybrid": [
        ("Carboxyl Polyester Resin (AV 50, hybrid grade)", "resin", 36.0),
        ("Bisphenol-A Epoxy Resin (EEW 750)", "hardener", 24.0),
        ("Titanium Dioxide (TiO2) Rutile", "pigment", 22.0),
        ("Calcium Carbonate", "filler", 16.3),
        ("Polyacrylate Flow Agent", "flow_agent", 1.2),
        ("Benzoin", "benzoin", 0.5),
    ],
    "black": [
        ("Carboxyl Polyester Resin (AV 32)", "resin", 60.0),
        ("TGIC Hardener", "hardener", 4.5),
        ("Carbon Black", "pigment", 1.5),
        ("Barium Sulphate (Blanc Fixe)", "filler", 32.3),
        ("Polyacrylate Flow Agent", "flow_agent", 1.2),
        ("Benzoin", "benzoin", 0.5),
    ],
}


def answer(db: Session, question: str, formulation_id: int | None = None) -> dict:
    q = question.lower().strip()
    f: Formulation | None = None
    if formulation_id:
        f = db.get(Formulation, formulation_id)
    items = _items_from_formulation(f) if f else []

    # --- Cost reduction: "reduce cost by 10%"
    m = re.search(r"(reduce|cut|lower)\s+(the\s+)?cost(\s+by)?\s*(\d+(\.\d+)?)?\s*%?", q)
    if m and ("cost" in q):
        if not items:
            return _need_formulation("cost optimization")
        pct = float(m.group(4)) if m.group(4) else 10.0
        current = compute_metrics(items)["cost_per_kg"]
        target = round(current * (1 - pct / 100.0), 3)
        result = optimize(items, f.system.value, f.cure_temp_c, f.cure_time_min,
                          OptimizationTargets(max_cost_per_kg=target), iterations=200)
        alts = suggest_alternatives(db, items)
        return {
            "intent": "cost_reduction",
            "answer": f"Targeting a {pct:.0f}% cost reduction: current material cost is "
                      f"${current}/kg, target ${target}/kg. The optimizer reached "
                      f"${result['optimized']['cost_per_kg']}/kg. "
                      f"{len(alts)} cheaper raw-material alternatives were also found.",
            "optimization": result,
            "alternatives": alts,
        }

    # --- Gloss targets: "increase gloss to 95"
    m = re.search(r"gloss\s+(to|of|at)?\s*(\d{1,3})", q)
    if m and "gloss" in q:
        if not items:
            return _need_formulation("gloss optimization")
        target_gloss = float(m.group(2))
        result = optimize(items, f.system.value, f.cure_temp_c, f.cure_time_min,
                          OptimizationTargets(gloss=target_gloss), iterations=250)
        return {
            "intent": "gloss_target",
            "answer": f"Optimizing toward {target_gloss:.0f} GU: predicted gloss moved from "
                      f"{result['baseline']['gloss']} to {result['optimized']['gloss']} GU. "
                      "Key levers: PVC, flow agent level and texture/wax additives.",
            "optimization": result,
        }

    # --- Texture conversion
    if ("texture" in q and ("convert" in q or "into" in q or "change" in q)) or "fine texture" in q:
        if not items:
            return _need_formulation("texture conversion")
        result = optimize(items, f.system.value, f.cure_temp_c, f.cure_time_min,
                          OptimizationTargets(texture="fine_texture"), iterations=250)
        return {
            "intent": "texture_conversion",
            "answer": "To convert a smooth finish into a fine texture: add 0.8–2.0% of a PTFE-modified "
                      "polyethylene texture additive, keep flow agent at ~1%, and expect gloss to drop "
                      "into the 30–60 GU band. The optimizer's suggested rebalance is attached.",
            "optimization": result,
        }

    # --- Flexibility
    if "flexibility" in q or "flexible" in q:
        if not items:
            return _need_formulation("flexibility improvement")
        result = optimize(items, f.system.value, f.cure_temp_c, f.cure_time_min,
                          OptimizationTargets(flexibility=85.0), iterations=250)
        return {
            "intent": "flexibility",
            "answer": "To improve flexibility: reduce filler loading (biggest lever), keep stoichiometry "
                      f"balanced, and avoid PVC above ~35%. Optimizer moved predicted flexibility from "
                      f"{result['baseline']['flexibility']} to {result['optimized']['flexibility']}.",
            "optimization": result,
        }

    # --- Outdoor polyester suggestion
    if "outdoor" in q or ("polyester" in q and "suggest" in q):
        return {
            "intent": "starter_formulation",
            "answer": "Suggested outdoor-durable polyester (TGIC) white formulation. Polyester/TGIC at 93:7 "
                      "stoichiometry gives excellent UV durability (Qualicoat class 1). For TGIC-free markets, "
                      "swap to a HAA (Primid XL-552) system at 95:5.",
            "formulation": _starter("polyester"),
        }

    # --- Low-cost black
    if "black" in q:
        return {
            "intent": "starter_formulation",
            "answer": "Low-cost black polyester formulation: carbon black is extremely strong, so 1–2% is "
                      "enough; the filler level is pushed high (barytes) to cut cost while staying below "
                      "critical PVC. Expect ~85 GU gloss; add 2% texture additive for a sand-texture black.",
            "formulation": _starter("black"),
        }

    # --- Color correction
    if ("correct" in q or "match" in q or "fix" in q) and ("color" in q or "colour" in q or "red" in q or "shade" in q):
        hexes = re.findall(r"#?([0-9a-fA-F]{6})", question)
        if len(hexes) >= 2:
            analysis = color_science.analyze_color_pair(
                color_science.hex_to_rgb(hexes[0]), color_science.hex_to_rgb(hexes[1])
            )
            rals = db.query(RalColor).all()
            ral = color_science.nearest_ral(color_science.hex_to_rgb(hexes[0]), rals)
            return {
                "intent": "color_correction",
                "answer": f"Delta E (CIEDE2000) between target #{hexes[0].upper()} and actual "
                          f"#{hexes[1].upper()} is {analysis['delta_e_2000']}. {analysis['verdict']} "
                          + (f"Nearest RAL to target: {ral['code']} {ral['name']}." if ral else ""),
                "analysis": analysis,
            }
        return {
            "intent": "color_correction",
            "answer": "To correct a color I need both shades. Provide two hex values, e.g. "
                      "\"correct this red: target #C1121F actual #7A0C14\", or use the Color Matching "
                      "module to upload customer and lab sample photos — I will compute Delta E, "
                      "diagnose the hue shift and quantify the pigment adjustments.",
        }

    # --- Validation request
    if "validate" in q or "check" in q or "review" in q:
        if not items:
            return _need_formulation("validation")
        report = validate_formulation(items, f.system.value, f.cure_temp_c, f.cure_time_min)
        n_err = sum(1 for i in report["issues"] if i["severity"] == "error")
        return {
            "intent": "validation",
            "answer": f"Validation of '{f.name}': score {report['score']}/100 ({report['verdict']}), "
                      f"{n_err} error(s), {len(report['issues']) - n_err} advisory item(s). Details attached.",
            "validation": report,
        }

    # --- Cost breakdown
    if "cost" in q or "price" in q or "margin" in q:
        if not items:
            return _need_formulation("costing")
        breakdown = cost_breakdown(items)
        return {
            "intent": "costing",
            "answer": f"Material cost of '{f.name}' is ${breakdown['material_cost_per_kg']}/kg "
                      f"(${breakdown['production_cost_per_kg']}/kg with {breakdown['overhead_pct']}% overhead). "
                      "The largest cost drivers are listed first in the breakdown.",
            "cost": breakdown,
        }

    # --- Fallback: capability guide
    return {
        "intent": "help",
        "answer": "I can help with: cost reduction (\"reduce cost by 10%\"), gloss targets "
                  "(\"increase gloss to 95\"), texture conversion (\"convert smooth finish into fine texture\"), "
                  "flexibility improvement, starter formulations (\"suggest outdoor polyester formulation\", "
                  "\"suggest a low-cost black formulation\"), color correction (give me two hex codes), "
                  "formulation validation and full cost breakdowns. Select a formulation for "
                  "formulation-specific requests.",
    }


def _need_formulation(task: str) -> dict:
    return {
        "intent": "needs_formulation",
        "answer": f"Select a formulation first so I can run {task} on its actual composition.",
    }


def _starter(key: str) -> dict:
    rows = _STARTER_FORMULATIONS[key]
    total = sum(w for _, _, w in rows)
    return {
        "basis": "100 kg batch",
        "items": [
            {"name": n, "category": c, "weight_kg": w, "pct": round(w / total * 100, 2)}
            for n, c, w in rows
        ],
    }


def serialize(payload: dict) -> str:
    return json.dumps(payload, default=str)
