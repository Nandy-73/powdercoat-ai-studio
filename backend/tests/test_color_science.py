from app.ai import color_science as cs


def test_hex_roundtrip():
    assert cs.rgb_to_hex(*cs.hex_to_rgb("#C1121F")) == "#C1121F"


def test_lab_white():
    l, a, b = cs.rgb_to_lab(255, 255, 255)
    assert abs(l - 100) < 0.5
    assert abs(a) < 0.5
    assert abs(b) < 0.5


def test_delta_e_identical_is_zero():
    lab = cs.rgb_to_lab(100, 150, 200)
    assert cs.delta_e_2000(lab, lab) == 0


def test_delta_e_black_white_large():
    de = cs.delta_e_2000(cs.rgb_to_lab(0, 0, 0), cs.rgb_to_lab(255, 255, 255))
    assert de > 50


def test_analyze_detects_too_dark():
    result = cs.analyze_color_pair((204, 6, 5), (122, 12, 20))  # bright red vs dark red
    directions = [i["direction"] for i in result["issues"]]
    assert "too dark" in directions
    assert result["delta_e_2000"] > 2
    corrections = {c["pigment"] for c in result["corrections"]}
    assert any("TiO2" in p or "Titanium" in p for p in corrections)
