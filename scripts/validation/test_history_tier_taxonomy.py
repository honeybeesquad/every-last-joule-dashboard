import importlib.util
from pathlib import Path

import pytest

pytest.importorskip("pyarrow")

REPO_ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


append_history = load_module("append_history", REPO_ROOT / "scripts" / "append_history.py")
annual_rollup = load_module("build_annual_rollup", REPO_ROOT / "scripts" / "build_annual_rollup.py")


REGIONS_FIXTURE = """
export const REGIONS = [
  { id: "live-a", tier: "live", kind: "wind" },
  { id: "domestic-a", tier: "live-domestic-anchored", kind: "solar" },
  { id: "neighbour-a", tier: "live-neighbour-anchored", kind: "wind" },
  { id: "anchored-a", tier: "anchored", kind: "flare" },
  { id: "estimated-a", tier: "estimated", kind: "solar" },
];
"""


def test_history_scripts_parse_current_region_tier_taxonomy(tmp_path, monkeypatch):
    regions_ts = tmp_path / "regions.ts"
    regions_ts.write_text(REGIONS_FIXTURE)

    monkeypatch.setattr(append_history, "REGIONS_TS", regions_ts)
    monkeypatch.setattr(append_history, "_REGIONS_CACHE", None)
    monkeypatch.setattr(annual_rollup, "REGIONS_TS", regions_ts)

    expected = {
        "live-a": "live",
        "domestic-a": "live-domestic-anchored",
        "neighbour-a": "live-neighbour-anchored",
        "anchored-a": "anchored",
        "estimated-a": "estimated",
    }
    assert append_history._load_regions_manifest() == expected
    assert annual_rollup.load_regions_manifest() == expected


@pytest.mark.parametrize(
    ("region_tier", "confidence_tier", "fraction"),
    [
        ("live", "T1a-live-tso", 0.15),
        ("live-domestic-anchored", "T1b-live-domestic-anchored", 0.50),
        ("live-neighbour-anchored", "T1c-live-neighbour-anchored", 0.355),
        ("anchored", "T2-annual-calibrated", 0.20),
        ("estimated", "T3-modelled", 0.40),
    ],
)
def test_annual_rollup_maps_region_tiers_to_current_confidence_tiers(region_tier, confidence_tier, fraction):
    assert annual_rollup.derive_tier("example", region_tier) == confidence_tier
    assert annual_rollup.TIER_DEFAULT_FRACTION[confidence_tier] == pytest.approx(fraction)


def test_append_history_fallback_uncertainty_uses_current_tier_mapping(tmp_path, monkeypatch):
    regions_ts = tmp_path / "regions.ts"
    regions_ts.write_text(REGIONS_FIXTURE)

    monkeypatch.setattr(append_history, "REGIONS_TS", regions_ts)
    monkeypatch.setattr(append_history, "_REGIONS_CACHE", None)

    cases = {
        "live-a": ("T1a-live-tso", 8.5, 11.5),
        "domestic-a": ("T1b-live-domestic-anchored", 5.0, 15.0),
        "neighbour-a": ("T1c-live-neighbour-anchored", 6.45, 13.55),
        "anchored-a": ("T2-annual-calibrated", 8.0, 12.0),
        "estimated-a": ("T3-modelled", 6.0, 14.0),
    }

    for region_id, expected in cases.items():
        tier, low, high = append_history.derive_fallback_uncertainty(region_id, 10.0)
        expected_tier, expected_low, expected_high = expected
        assert tier == expected_tier
        assert low == pytest.approx(expected_low)
        assert high == pytest.approx(expected_high)
