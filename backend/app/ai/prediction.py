"""ML prediction engines for finish, mechanical properties and manufacturing behavior.

Models are trained once per process on a physics-informed synthetic dataset
(10k formulations sampled across realistic composition windows, labeled by
domain response functions + noise). XGBoost handles gloss regression, a
RandomForest classifies finish type, and gradient boosting covers the
mechanical panel. Trained models are cached in a module-level registry.
"""

from __future__ import annotations

import threading

import numpy as np

from app.ai.formulation_engine import compute_metrics

_FEATURES = [
    "resin_pct", "hardener_pct", "pigment_pct", "filler_pct",
    "flow_pct", "benzoin_pct", "texture_pct", "wax_pct",
    "pvc_pct", "cure_temp_c", "cure_time_min", "system_id",
]

_SYSTEM_IDS = {"epoxy": 0, "polyester": 1, "hybrid": 2, "polyurethane": 3, "acrylic": 4, "custom": 5}
_FINISH_CLASSES = ["smooth", "fine_texture", "sand_texture", "wrinkle", "orange_peel"]

_registry: dict = {}
_lock = threading.Lock()


def _sample_dataset(n: int = 10000, seed: int = 42):
    rng = np.random.default_rng(seed)
    resin = rng.uniform(40, 75, n)
    hardener = rng.uniform(2, 35, n)
    pigment = rng.uniform(0, 40, n)
    filler = rng.uniform(0, 40, n)
    flow = rng.uniform(0, 2.5, n)
    benzoin = rng.uniform(0, 1.2, n)
    texture = rng.uniform(0, 6, n)
    wax = rng.uniform(0, 4, n)
    cure_t = rng.uniform(140, 220, n)
    cure_m = rng.uniform(5, 25, n)
    system = rng.integers(0, 6, n)

    # normalize composition to 100
    total = resin + hardener + pigment + filler + flow + benzoin + texture + wax
    scale = 100.0 / total
    resin, hardener, pigment, filler = resin * scale, hardener * scale, pigment * scale, filler * scale
    flow, benzoin, texture, wax = flow * scale, benzoin * scale, texture * scale, wax * scale

    # approximate PVC (volume-based, assuming pigment/filler density ~ 3x binder)
    pvc = (pigment / 3.5 + filler / 2.7) / (
        (resin + hardener) / 1.2 + pigment / 3.5 + filler / 2.7 + (flow + benzoin + texture + wax) / 1.1
    ) * 100

    cure_index = np.clip((cure_t - 150) / 50 + (cure_m - 8) / 15, 0, 2)  # 0=under, ~1=good

    # --- Gloss (60° GU): drops with PVC, texture, wax; needs flow agent and full cure
    gloss = (
        95
        - 1.6 * np.maximum(pvc - 22, 0)
        - 9.0 * texture
        - 3.0 * wax
        - 12.0 * np.maximum(0.8 - flow, 0) * 5
        - 18.0 * np.maximum(0.7 - cure_index, 0)
        + rng.normal(0, 3, n)
    )
    gloss = np.clip(gloss, 3, 98)

    # --- Finish class
    finish = np.zeros(n, dtype=int)
    finish[(texture > 2.5)] = 2                       # sand texture
    finish[(texture > 0.8) & (texture <= 2.5)] = 1    # fine texture
    finish[(flow < 0.4) & (texture <= 0.8)] = 4       # orange peel from poor flow
    finish[(cure_index < 0.35) & (texture <= 0.8)] = 3  # wrinkle from bad cure profile
    # remaining stay smooth (0)

    stoich = 1 - np.abs((hardener / np.maximum(resin, 1)) - 0.28) * 2.2  # crude cure balance
    stoich = np.clip(stoich, 0, 1)

    # --- Mechanical panel (0-100 scores)
    hardness = np.clip(50 + 25 * stoich + 0.5 * filler - 0.35 * np.maximum(pvc - 35, 0) * 3 + rng.normal(0, 4, n), 5, 99)
    adhesion = np.clip(88 - 0.9 * np.maximum(pvc - 32, 0) * 2 + 8 * stoich - 2.2 * wax + rng.normal(0, 4, n), 5, 99)
    flexibility = np.clip(85 - 1.1 * filler - 0.5 * pigment + 10 * stoich - 0.4 * hardness * 0.2 + rng.normal(0, 5, n), 5, 99)
    impact = np.clip(0.55 * flexibility + 0.35 * adhesion + rng.normal(0, 4, n), 5, 99)
    chem_res = np.clip(45 + 40 * stoich + 6 * (system == 0) + 4 * (system == 2) - 0.8 * np.maximum(pvc - 35, 0) + rng.normal(0, 4, n), 5, 99)
    weather = np.clip(35 + 30 * stoich + 28 * np.isin(system, [1, 3, 4]) - 22 * (system == 0) * 0.8 + rng.normal(0, 5, n), 5, 99)
    salt_spray = np.clip(0.5 * chem_res + 0.35 * adhesion + 6 * (system == 0) + rng.normal(0, 4, n), 5, 99)
    humidity = np.clip(0.6 * salt_spray + 0.3 * adhesion + rng.normal(0, 4, n), 5, 99)
    outdoor = np.clip(0.75 * weather + 0.2 * gloss * 0.3 + rng.normal(0, 4, n), 5, 99)

    X = np.column_stack([resin, hardener, pigment, filler, flow, benzoin, texture, wax, pvc, cure_t, cure_m, system])
    y = {
        "gloss": gloss, "finish": finish, "hardness": hardness, "adhesion": adhesion,
        "flexibility": flexibility, "impact": impact, "chem_res": chem_res,
        "weather": weather, "salt_spray": salt_spray, "humidity": humidity, "outdoor": outdoor,
    }
    return X, y


def _train():
    from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
    from xgboost import XGBRegressor

    X, y = _sample_dataset()
    models: dict = {}

    models["gloss"] = XGBRegressor(
        n_estimators=200, max_depth=5, learning_rate=0.08, n_jobs=2, verbosity=0
    ).fit(X, y["gloss"])

    models["finish"] = RandomForestClassifier(
        n_estimators=120, max_depth=12, n_jobs=2, random_state=0
    ).fit(X, y["finish"])

    for prop in ["hardness", "adhesion", "flexibility", "impact", "chem_res",
                 "weather", "salt_spray", "humidity", "outdoor"]:
        models[prop] = GradientBoostingRegressor(
            n_estimators=80, max_depth=4, random_state=0
        ).fit(X, y[prop])

    return models


def get_models() -> dict:
    with _lock:
        if "models" not in _registry:
            _registry["models"] = _train()
    return _registry["models"]


def features_from_items(items: list[dict], system: str, cure_temp_c: float, cure_time_min: float) -> np.ndarray:
    m = compute_metrics(items)
    total = m["total_weight_kg"] or 1.0

    def cat_pct(cat: str) -> float:
        return sum(i["weight_kg"] for i in items if i["category"] == cat) / total * 100.0

    return np.array(
        [[
            m["resin_pct"], m["hardener_pct"], m["pigment_pct"], m["filler_pct"],
            cat_pct("flow_agent"), cat_pct("benzoin"), cat_pct("texture_additive"), cat_pct("wax"),
            m["pvc_pct"], cure_temp_c, cure_time_min,
            _SYSTEM_IDS.get(system, 5),
        ]]
    )


def _score_label(v: float) -> str:
    if v >= 85:
        return "excellent"
    if v >= 70:
        return "good"
    if v >= 50:
        return "fair"
    return "poor"


def predict_finish(items: list[dict], system: str, cure_temp_c: float, cure_time_min: float) -> dict:
    models = get_models()
    X = features_from_items(items, system, cure_temp_c, cure_time_min)
    gloss = float(models["gloss"].predict(X)[0])
    proba = models["finish"].predict_proba(X)[0]
    classes = models["finish"].classes_
    ranked = sorted(zip(classes, proba), key=lambda t: -t[1])

    gloss_cat = (
        "high gloss" if gloss >= 85 else "gloss" if gloss >= 70
        else "semi-gloss" if gloss >= 40 else "satin/matt" if gloss >= 15 else "dead matt"
    )
    return {
        "gloss_60deg": round(gloss, 1),
        "gloss_category": gloss_cat,
        "finish_type": _FINISH_CLASSES[int(ranked[0][0])],
        "finish_probabilities": {
            _FINISH_CLASSES[int(c)]: round(float(p), 3) for c, p in ranked
        },
        "film_appearance": _appearance_note(gloss, _FINISH_CLASSES[int(ranked[0][0])]),
    }


def _appearance_note(gloss: float, finish: str) -> str:
    notes = {
        "smooth": f"Smooth, leveled film at ~{gloss:.0f} GU; DOI should be good with proper film build (60–80 µm).",
        "fine_texture": "Uniform fine texture; hides substrate defects well, moderate gloss readings are directional.",
        "sand_texture": "Pronounced sand texture; excellent defect hiding, gloss measurement not representative.",
        "wrinkle": "Wrinkle finish driven by cure profile; verify oven schedule for consistency.",
        "orange_peel": "Visible orange peel expected — increase flow agent or optimize particle size/film build.",
    }
    return notes.get(finish, "")


def predict_mechanical(items: list[dict], system: str, cure_temp_c: float, cure_time_min: float) -> dict:
    models = get_models()
    X = features_from_items(items, system, cure_temp_c, cure_time_min)

    def score(name: str) -> dict:
        v = float(np.clip(models[name].predict(X)[0], 0, 100))
        return {"score": round(v, 1), "rating": _score_label(v)}

    hardness = score("hardness")
    flexibility = score("flexibility")
    impact = score("impact")
    adhesion = score("adhesion")
    salt = score("salt_spray")

    return {
        "hardness": {**hardness, "estimate": _pencil_hardness(hardness["score"])},
        "adhesion": {**adhesion, "estimate": _adhesion_class(adhesion["score"])},
        "flexibility": {**flexibility, "estimate": _flex_estimate(flexibility["score"])},
        "impact_resistance": {**impact, "estimate": _impact_estimate(impact["score"])},
        "chemical_resistance": score("chem_res"),
        "weather_resistance": score("weather"),
        "salt_spray_resistance": {**salt, "estimate": f"~{int(200 + salt['score'] * 10)} h to first creep (ASTM B117, est.)"},
        "humidity_resistance": score("humidity"),
        "outdoor_durability": score("outdoor"),
    }


def _pencil_hardness(v: float) -> str:
    scale = ["B", "HB", "F", "H", "2H", "3H"]
    return scale[min(int(v // 18), len(scale) - 1)] + " (pencil, est.)"


def _adhesion_class(v: float) -> str:
    return f"{5 - min(int(v // 20), 5)}B cross-hatch (est.)".replace("0B", "5B")


def _flex_estimate(v: float) -> str:
    mm = max(2, int(26 - v * 0.24))
    return f"~{mm} mm cylindrical mandrel pass (est.)"


def _impact_estimate(v: float) -> str:
    return f"~{int(v * 1.6)} in·lb direct impact (est.)"


def predict_manufacturing(items: list[dict], system: str, cure_temp_c: float,
                          cure_time_min: float, batch_kg: float = 500.0) -> dict:
    """Physics-informed heuristics for process behavior."""
    m = compute_metrics(items)
    pvc = m["pvc_pct"]
    filler = m["filler_pct"]
    pigment = m["pigment_pct"]

    extrusion_load = min(100, 40 + (pigment + filler) * 1.1)
    extrusion = "smooth" if extrusion_load < 60 else "moderate torque" if extrusion_load < 80 else "high torque — risk of surging"
    grind = max(30, 95 - filler * 0.8 - pigment * 0.5)
    d50 = round(32 + (pigment + filler) * 0.12, 1)
    spray = max(30, 92 - abs(d50 - 35) * 2.5 - max(pvc - 35, 0) * 1.2)
    transfer_eff = round(min(75, 45 + spray * 0.3), 1)

    risks = []
    if pigment + filler > 45:
        risks.append("High solids loading: extruder torque spikes and possible incomplete dispersion.")
    if pvc > 38:
        risks.append("PVC near critical: expect gloss variation between batches.")
    if cure_temp_c < 160:
        risks.append("Low-bake schedule: verify cure with MEK double-rub before release.")
    if batch_kg > 2000:
        risks.append("Large batch: split extrusion runs to keep premix homogeneity.")
    if not risks:
        risks.append("No significant production risks detected.")

    return {
        "extrusion_behavior": {"load_pct": round(extrusion_load, 1), "assessment": extrusion},
        "cooling_efficiency": {"score": round(max(40, 95 - extrusion_load * 0.3), 1),
                               "note": "Chill-roll cooling adequate for this melt viscosity." if extrusion_load < 80
                               else "Reduce throughput or increase chill-roll cooling water flow."},
        "grinding_efficiency": {"score": round(grind, 1),
                                "note": "Standard ACM mill settings apply." if grind > 60
                                else "Abrasive formulation — expect higher mill wear and lower throughput."},
        "particle_size_d50_um": d50,
        "sprayability": {"score": round(spray, 1),
                         "note": "Good fluidization and cloud formation expected." if spray > 65
                         else "Check fines content (<10 µm) and virgin/reclaim ratio."},
        "transfer_efficiency_pct": transfer_eff,
        "recommended_film_thickness_um": "60–80" if pvc < 30 else "70–90",
        "recommended_cure_schedule": _cure_schedule(system, cure_temp_c),
        "production_risks": risks,
    }


def _cure_schedule(system: str, requested_c: float) -> str:
    base = {
        "epoxy": "10 min @ 180°C (object temp); functional cure from 8 min @ 190°C",
        "polyester": "10 min @ 180°C or 6 min @ 200°C (object temp)",
        "hybrid": "10 min @ 180°C (object temp); low-bake variants 15 min @ 160°C",
        "polyurethane": "15 min @ 190°C — full deblocking of isocyanate needed",
        "acrylic": "20 min @ 180°C for full DDDA crosslinking",
    }
    return base.get(system, f"{'12' if requested_c < 180 else '10'} min @ {max(requested_c, 160):.0f}°C (verify with DSC)")
