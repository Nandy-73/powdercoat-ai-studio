from app.ai.formulation_engine import compute_metrics, scale_formulation, validate_formulation

GOOD_POLYESTER = [
    {"material_id": 1, "name": "Polyester Resin", "category": "resin", "chemical_family": "Carboxyl Polyester",
     "weight_kg": 57.0, "density_g_cm3": 1.23, "cost_per_kg": 2.45},
    {"material_id": 2, "name": "TGIC Hardener", "category": "hardener", "chemical_family": "TGIC",
     "weight_kg": 4.3, "density_g_cm3": 1.42, "cost_per_kg": 6.8},
    {"material_id": 3, "name": "TiO2", "category": "pigment", "chemical_family": "Inorganic Oxide",
     "weight_kg": 25.0, "density_g_cm3": 4.2, "cost_per_kg": 3.1},
    {"material_id": 4, "name": "Barytes", "category": "filler", "chemical_family": "Barium Sulphate",
     "weight_kg": 11.5, "density_g_cm3": 4.4, "cost_per_kg": 0.55},
    {"material_id": 5, "name": "Flow Agent", "category": "flow_agent", "chemical_family": "Polyacrylate",
     "weight_kg": 1.2, "density_g_cm3": 1.05, "cost_per_kg": 4.8},
    {"material_id": 6, "name": "Benzoin", "category": "benzoin", "chemical_family": "Benzoin",
     "weight_kg": 0.5, "density_g_cm3": 1.31, "cost_per_kg": 5.2},
    {"material_id": 7, "name": "PE Wax", "category": "wax", "chemical_family": "Polyethylene Wax",
     "weight_kg": 0.5, "density_g_cm3": 0.97, "cost_per_kg": 4.3},
]


def test_metrics_sum_to_100():
    m = compute_metrics(GOOD_POLYESTER)
    assert abs(m["total_weight_kg"] - 100.0) < 0.01
    assert (
        abs(m["resin_pct"] + m["hardener_pct"] + m["pigment_pct"] + m["filler_pct"] + m["additive_pct"] - 100)
        < 0.1
    )
    assert m["cost_per_kg"] > 0
    assert 0 < m["pvc_pct"] < 100


def test_good_formulation_scores_high():
    report = validate_formulation(GOOD_POLYESTER, "polyester", 180, 10)
    assert report["score"] >= 75
    assert not [i for i in report["issues"] if i["severity"] == "error"]


def test_missing_hardener_detected():
    items = [i for i in GOOD_POLYESTER if i["category"] != "hardener"]
    report = validate_formulation(items, "polyester", 180, 10)
    codes = [i["code"] for i in report["issues"]]
    assert "NO_HARDENER" in codes


def test_pigment_overload_detected():
    items = [dict(i) for i in GOOD_POLYESTER]
    for i in items:
        if i["category"] == "pigment":
            i["weight_kg"] = 60.0
    report = validate_formulation(items, "polyester", 180, 10)
    assert any("PIGMENT" in i["code"] for i in report["issues"])


def test_scaling_preserves_percentages():
    scaled = scale_formulation(GOOD_POLYESTER, 2500)
    assert abs(sum(i["weight_kg"] for i in scaled) - 2500) < 0.5
    orig = compute_metrics(GOOD_POLYESTER)
    new = compute_metrics(scaled)
    assert abs(orig["resin_pct"] - new["resin_pct"]) < 0.05
