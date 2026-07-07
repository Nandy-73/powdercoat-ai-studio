"""Cost intelligence: batch costing, margins and lower-cost material alternatives."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.ai.formulation_engine import compute_metrics
from app.models.material import Material


def cost_breakdown(items: list[dict], batch_kg: float | None = None,
                   selling_price_per_kg: float | None = None,
                   overhead_pct: float = 18.0) -> dict:
    m = compute_metrics(items)
    total = m["total_weight_kg"]
    scale = (batch_kg / total) if (batch_kg and total > 0) else 1.0

    lines = []
    for c in m["composition"]:
        lines.append(
            {
                "material": c["name"],
                "category": c["category"],
                "weight_kg": round(c["weight_kg"] * scale, 3),
                "pct": c["pct"],
                "cost": round(c["cost"] * scale, 2),
            }
        )
    material_cost = round(m["total_cost"] * scale, 2)
    production_cost = round(material_cost * (1 + overhead_pct / 100.0), 2)
    out_kg = round(total * scale, 2)

    result = {
        "batch_kg": out_kg,
        "material_cost": material_cost,
        "material_cost_per_kg": m["cost_per_kg"],
        "overhead_pct": overhead_pct,
        "production_cost": production_cost,
        "production_cost_per_kg": round(production_cost / out_kg, 3) if out_kg else 0.0,
        "lines": sorted(lines, key=lambda x: -x["cost"]),
    }
    if selling_price_per_kg:
        revenue = round(selling_price_per_kg * out_kg, 2)
        result["selling_price_per_kg"] = selling_price_per_kg
        result["revenue"] = revenue
        result["profit"] = round(revenue - production_cost, 2)
        result["margin_pct"] = round((revenue - production_cost) / revenue * 100, 2) if revenue else 0.0
    return result


def suggest_alternatives(db: Session, items: list[dict]) -> list[dict]:
    """For each cost-heavy component, find same-category materials that are
    cheaper without an obvious quality penalty (same chemical family preferred)."""
    suggestions = []
    for item in items:
        if item.get("cost_per_kg", 0) <= 0 or item.get("material_id") is None:
            continue
        cheaper = (
            db.query(Material)
            .filter(
                Material.category == item["category"],
                Material.cost_per_kg > 0,
                Material.cost_per_kg < item["cost_per_kg"] * 0.95,
                Material.id != item["material_id"],
            )
            .order_by(Material.cost_per_kg.asc())
            .limit(3)
            .all()
        )
        for alt in cheaper:
            same_family = (
                alt.chemical_family
                and alt.chemical_family.lower() == (item.get("chemical_family") or "").lower()
            )
            saving_per_kg_item = item["cost_per_kg"] - alt.cost_per_kg
            suggestions.append(
                {
                    "replace": item["name"],
                    "with": alt.name,
                    "category": item["category"],
                    "current_cost_per_kg": item["cost_per_kg"],
                    "alternative_cost_per_kg": alt.cost_per_kg,
                    "saving_per_kg_of_material": round(saving_per_kg_item, 3),
                    "estimated_formulation_saving_per_kg": round(
                        saving_per_kg_item * item["weight_kg"]
                        / max(sum(i["weight_kg"] for i in items), 0.001),
                        3,
                    ),
                    "same_chemical_family": bool(same_family),
                    "risk": "low — drop-in candidate (same chemical family)" if same_family
                    else "medium — lab trial required (different chemical family)",
                }
            )
    return sorted(suggestions, key=lambda s: -s["estimated_formulation_saving_per_kg"])[:10]
