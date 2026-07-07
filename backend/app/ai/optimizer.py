"""AI optimization engine.

Random-restart local search over composition space: perturbs category weights,
re-normalizes, scores candidates against the user's property targets using the
prediction models, and returns the best adjusted formulation.
"""

from __future__ import annotations

import copy

import numpy as np

from app.ai.formulation_engine import compute_metrics, validate_formulation
from app.ai.prediction import predict_finish, predict_mechanical


class OptimizationTargets:
    def __init__(self, gloss: float | None = None, hardness: float | None = None,
                 flexibility: float | None = None, texture: str | None = None,
                 weather_resistance: float | None = None, max_cost_per_kg: float | None = None):
        self.gloss = gloss
        self.hardness = hardness
        self.flexibility = flexibility
        self.texture = texture
        self.weather_resistance = weather_resistance
        self.max_cost_per_kg = max_cost_per_kg


def _score(items: list[dict], system: str, cure_t: float, cure_m: float,
           targets: OptimizationTargets) -> tuple[float, dict]:
    finish = predict_finish(items, system, cure_t, cure_m)
    mech = predict_mechanical(items, system, cure_t, cure_m)
    metrics = compute_metrics(items)

    penalty = 0.0
    if targets.gloss is not None:
        penalty += abs(finish["gloss_60deg"] - targets.gloss) * 1.5
    if targets.hardness is not None:
        penalty += abs(mech["hardness"]["score"] - targets.hardness)
    if targets.flexibility is not None:
        penalty += abs(mech["flexibility"]["score"] - targets.flexibility)
    if targets.weather_resistance is not None:
        penalty += max(0.0, targets.weather_resistance - mech["weather_resistance"]["score"]) * 1.5
    if targets.texture is not None and finish["finish_type"] != targets.texture:
        penalty += 25.0
    if targets.max_cost_per_kg is not None:
        penalty += max(0.0, metrics["cost_per_kg"] - targets.max_cost_per_kg) * 20.0

    # keep the formulation valid
    validation = validate_formulation(items, system, cure_t, cure_m)
    penalty += (100 - validation["score"]) * 0.6

    detail = {"finish": finish, "mechanical": mech, "metrics": metrics, "validation_score": validation["score"]}
    return -penalty, detail


def optimize(items: list[dict], system: str, cure_temp_c: float, cure_time_min: float,
             targets: OptimizationTargets, iterations: int = 250, seed: int = 7) -> dict:
    rng = np.random.default_rng(seed)
    if not items:
        return {"error": "Formulation has no items to optimize."}

    best_items = copy.deepcopy(items)
    best_score, best_detail = _score(best_items, system, cure_temp_c, cure_time_min, targets)
    baseline_detail = copy.deepcopy(best_detail)

    current = copy.deepcopy(best_items)
    current_score = best_score

    for step in range(iterations):
        candidate = copy.deepcopy(current)
        # perturb 1-2 random components by up to ±15%
        for idx in rng.choice(len(candidate), size=min(2, len(candidate)), replace=False):
            factor = 1.0 + rng.uniform(-0.15, 0.15)
            candidate[idx]["weight_kg"] = max(0.001, candidate[idx]["weight_kg"] * factor)

        score, detail = _score(candidate, system, cure_temp_c, cure_time_min, targets)
        # hill climb with occasional random restart acceptance
        if score > current_score or rng.random() < 0.05:
            current, current_score = candidate, score
            if score > best_score:
                best_items, best_score, best_detail = candidate, score, detail

    total = sum(i["weight_kg"] for i in best_items)
    changes = []
    for orig, new in zip(items, best_items):
        orig_pct = orig["weight_kg"] / sum(i["weight_kg"] for i in items) * 100
        new_pct = new["weight_kg"] / total * 100
        if abs(new_pct - orig_pct) > 0.05:
            changes.append(
                {
                    "material": orig["name"],
                    "from_pct": round(orig_pct, 2),
                    "to_pct": round(new_pct, 2),
                    "direction": "increase" if new_pct > orig_pct else "decrease",
                }
            )

    return {
        "baseline": {
            "gloss": baseline_detail["finish"]["gloss_60deg"],
            "hardness": baseline_detail["mechanical"]["hardness"]["score"],
            "flexibility": baseline_detail["mechanical"]["flexibility"]["score"],
            "weather": baseline_detail["mechanical"]["weather_resistance"]["score"],
            "cost_per_kg": baseline_detail["metrics"]["cost_per_kg"],
        },
        "optimized": {
            "gloss": best_detail["finish"]["gloss_60deg"],
            "finish_type": best_detail["finish"]["finish_type"],
            "hardness": best_detail["mechanical"]["hardness"]["score"],
            "flexibility": best_detail["mechanical"]["flexibility"]["score"],
            "weather": best_detail["mechanical"]["weather_resistance"]["score"],
            "cost_per_kg": best_detail["metrics"]["cost_per_kg"],
            "validation_score": best_detail["validation_score"],
        },
        "changes": changes,
        "optimized_items": [
            {"name": i["name"], "material_id": i.get("material_id"),
             "weight_kg": round(i["weight_kg"], 4),
             "pct": round(i["weight_kg"] / total * 100, 2)}
            for i in best_items
        ],
        "iterations": iterations,
    }
