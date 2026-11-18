"""Unit tests for the CEA gen-re Excel parser (no network)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import india_cea_excel as cea


def test_rejects_excel_serial_date():
    assert cea.is_plausible_daily_gwh(45944.0) is False
    assert cea.is_plausible_daily_gwh(239.64) is True
    assert cea.is_plausible_daily_gwh(0.0) is True
    assert cea.is_plausible_daily_gwh(-1.0) is False
    assert cea.is_plausible_daily_gwh(400.0) is True
    assert cea.is_plausible_daily_gwh(400.01) is False


def test_header_aware_columns_skip_cumulative():
    rows = {
        1: {0: "State", 1: "Wind Energy (MU)", 2: "Solar Energy (MU)", 5: "Cumulative Wind", 6: "Cumulative Solar"},
        2: {0: "राजस्थान / Rajasthan", 1: 57.11, 2: 239.64, 5: 561.0, 6: 4200.0},
        3: {0: "कर्नाटक / Karnataka", 1: 12.0, 2: 80.0, 5: 200.0, 6: 1500.0},
        4: {0: "बिहार / Bihar", 1: 0.0, 2: 1.5, 5: 0.0, 6: 40.0},
        5: {0: "केरल / Kerala", 1: 0.4, 2: 1.2, 5: 10.0, 6: 80.0},
        6: {0: "गोआ / Goa", 1: 0.0, 2: 0.05, 5: 0.0, 6: 1.0},
        7: {0: "सम्पूर्ण भारत / All India", 1: 200.0, 2: 800.0, 5: 4000.0, 6: 20000.0},
    }
    wind_col, solar_col = cea.find_wind_solar_columns(rows)
    assert (wind_col, solar_col) == (1, 2)
    states = cea.extract_labelled_generation(
        rows, cea.STATE_LABELS, wind_col=wind_col, solar_col=solar_col
    )
    assert states["rajasthan"] == {"wind_gwh": 57.11, "solar_gwh": 239.64}
    assert "karnataka" in states
    assert states["kerala"] == {"wind_gwh": 0.4, "solar_gwh": 1.2}
    east = cea.extract_named_generation(
        rows, cea.EAST_RESIDUAL_LABELS, wind_col=wind_col, solar_col=solar_col
    )
    assert east["Bihar"]["solar_gwh"] == 1.5
    rest = cea.extract_named_generation(
        rows, cea.REST_RESIDUAL_LABELS, wind_col=wind_col, solar_col=solar_col
    )
    assert rest["Goa"]["solar_gwh"] == 0.05
    assert "All India" not in rest
    assert "Kerala" not in rest


def test_layout_b_state_code_and_serial_are_not_energy():
    """2025-10-14 layout: State, State Code, Date serial, Wind, Solar."""
    rows = {
        1: {0: "State", 1: "State Code", 2: "Date", 3: "Wind", 4: "Solar"},
        2: {0: "Rajasthan", 1: 8.0, 2: 45944.0, 3: 1.45, 4: 45.7},
        3: {0: "Gujarat", 1: 24.0, 2: 45944.0, 3: 40.0, 4: 120.0},
        4: {0: "Tamil Nadu", 1: 33.0, 2: 45944.0, 3: 55.0, 4: 22.0},
        5: {0: "Bihar", 1: 10.0, 2: 45944.0, 3: 0.0, 4: 0.8},
    }
    wind_col, solar_col = cea.find_wind_solar_columns(rows)
    assert (wind_col, solar_col) == (3, 4)
    states = cea.extract_labelled_generation(
        rows, cea.STATE_LABELS, wind_col=wind_col, solar_col=solar_col
    )
    assert states["rajasthan"]["solar_gwh"] == 45.7
    assert states["rajasthan"]["wind_gwh"] == 1.45
    assert 45944.0 not in (
        states["rajasthan"]["wind_gwh"],
        states["rajasthan"]["solar_gwh"],
    )


def test_implausible_row_is_dropped():
    rows = {
        1: {0: "State", 1: "Wind", 2: "Solar"},
        2: {0: "Rajasthan", 1: 8.0, 2: 45944.0},
        3: {0: "Gujarat", 1: 40.0, 2: 120.0},
    }
    states = cea.extract_labelled_generation(
        rows, cea.STATE_LABELS, wind_col=1, solar_col=2
    )
    assert "rajasthan" not in states
    assert states["gujarat"]["solar_gwh"] == 120.0
