"""Tests for manual-block preservation in build_region_docs.py.

Covers the _extract_manual_blocks / _inject_manual_blocks pair and the
higher-level build_region_doc_with_manual_blocks wrapper.

Strategy under test: (A) anchor by preceding ## section heading.
Each <!-- BEGIN MANUAL --> block is associated with the nearest ## heading
above it in the source doc.  On re-injection the block is appended at the
end of that section in the newly-generated doc (just before the next ##
heading or EOF).  If the section heading no longer exists the block is
appended at the end of the new doc with a <!-- WARNING: … --> comment and
a message on stderr.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Make sibling import work without packaging.
sys.path.insert(0, str(Path(__file__).parent))

from build_region_docs import (
    _MANUAL_BEGIN,
    _MANUAL_END,
    _UNPLACED_WARNING,
    _extract_manual_blocks,
    _inject_manual_blocks,
    build_region_doc_with_manual_blocks,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _md(text: str) -> str:
    """De-dent triple-quoted test strings for readability."""
    import textwrap
    return textwrap.dedent(text).lstrip("\n")


# ---------------------------------------------------------------------------
# _extract_manual_blocks
# ---------------------------------------------------------------------------

def test_extract_no_markers_returns_empty():
    doc = _md("""
        # Validation

        ## Source
        Some content here.

        ## Known limitations
        Nothing special.
    """)
    assert _extract_manual_blocks(doc) == []


def test_extract_single_block_under_heading():
    doc = _md(f"""
        # Validation

        ## Known limitations
        Auto-generated note.

        {_MANUAL_BEGIN}
        My citation block.
        {_MANUAL_END}

        ## Links
        Link here.
    """)
    blocks = _extract_manual_blocks(doc)
    assert len(blocks) == 1
    heading, body = blocks[0]
    assert heading == "## Known limitations"
    assert "My citation block." in body


def test_extract_two_blocks_under_different_sections():
    doc = _md(f"""
        # Validation

        ## Source
        Some info.

        {_MANUAL_BEGIN}
        Block A under Source.
        {_MANUAL_END}

        ## Known limitations
        Auto note.

        {_MANUAL_BEGIN}
        Block B under Known limitations.
        {_MANUAL_END}
    """)
    blocks = _extract_manual_blocks(doc)
    assert len(blocks) == 2
    assert blocks[0][0] == "## Source"
    assert "Block A" in blocks[0][1]
    assert blocks[1][0] == "## Known limitations"
    assert "Block B" in blocks[1][1]


def test_extract_block_before_any_heading_uses_top_sentinel():
    doc = _md(f"""
        {_MANUAL_BEGIN}
        Preamble block before any heading.
        {_MANUAL_END}

        # Validation

        ## Source
        Content.
    """)
    blocks = _extract_manual_blocks(doc)
    assert len(blocks) == 1
    assert blocks[0][0] == "__TOP__"
    assert "Preamble block" in blocks[0][1]


def test_extract_unclosed_begin_is_discarded(capsys):
    doc = _md(f"""
        # Validation

        ## Source
        {_MANUAL_BEGIN}
        No closing marker here.
    """)
    blocks = _extract_manual_blocks(doc)
    # Unclosed block should be silently discarded (with stderr warning).
    assert blocks == []
    captured = capsys.readouterr()
    assert "unclosed" in captured.err.lower() or "BEGIN MANUAL" in captured.err


def test_extract_stray_end_is_ignored(capsys):
    doc = _md(f"""
        # Validation

        ## Source
        {_MANUAL_END}
        Normal content.
    """)
    blocks = _extract_manual_blocks(doc)
    assert blocks == []
    captured = capsys.readouterr()
    assert "stray" in captured.err.lower() or "END MANUAL" in captured.err


def test_extract_nested_begin_closes_outer_and_starts_new(capsys):
    doc = _md(f"""
        # Validation

        ## Source
        {_MANUAL_BEGIN}
        Outer block content.
        {_MANUAL_BEGIN}
        Inner block content.
        {_MANUAL_END}
    """)
    blocks = _extract_manual_blocks(doc)
    # Outer block closed at inner BEGIN; inner block closed at END.
    assert len(blocks) == 2
    assert "Outer block content." in blocks[0][1]
    assert "Inner block content." in blocks[1][1]
    captured = capsys.readouterr()
    assert "nested" in captured.err.lower()


def test_extract_preserves_begin_end_markers_not_in_output():
    """The BEGIN / END marker lines themselves must NOT appear in the block body."""
    doc = _md(f"""
        ## Source
        {_MANUAL_BEGIN}
        Content line.
        {_MANUAL_END}
    """)
    blocks = _extract_manual_blocks(doc)
    assert len(blocks) == 1
    body = blocks[0][1]
    assert _MANUAL_BEGIN not in body
    assert _MANUAL_END not in body


# ---------------------------------------------------------------------------
# _inject_manual_blocks
# ---------------------------------------------------------------------------

def test_inject_no_blocks_returns_doc_unchanged():
    doc = "# Title\n\n## Source\n\nContent.\n"
    result = _inject_manual_blocks(doc, [], region_id="test")
    assert result == doc


def test_inject_single_block_placed_under_correct_section():
    blocks = [("## Known limitations", "My manual content.\n")]
    fresh_doc = _md("""
        # Validation

        ## Source

        Source content.

        ## Known limitations

        Auto limitations text.

        ## Links

        Link content.
    """)
    result = _inject_manual_blocks(fresh_doc, blocks, region_id="test")
    # Manual block should appear somewhere after ## Known limitations
    # and before ## Links.
    lim_pos = result.index("## Known limitations")
    manual_pos = result.index(_MANUAL_BEGIN)
    links_pos = result.index("## Links")
    assert lim_pos < manual_pos < links_pos
    assert "My manual content." in result


def test_inject_two_blocks_under_different_sections_both_placed():
    blocks = [
        ("## Source", "Source block.\n"),
        ("## Known limitations", "Limitations block.\n"),
    ]
    fresh_doc = _md("""
        # Validation

        ## Source

        Generated source.

        ## Known limitations

        Generated limitations.

        ## Links

        Links here.
    """)
    result = _inject_manual_blocks(fresh_doc, blocks, region_id="test")
    assert result.count(_MANUAL_BEGIN) == 2
    # Source block before Known limitations section.
    src_pos = result.index("## Source")
    lim_pos = result.index("## Known limitations")
    first_manual = result.index(_MANUAL_BEGIN)
    second_manual = result.index(_MANUAL_BEGIN, first_manual + 1)
    assert src_pos < first_manual < lim_pos
    assert lim_pos < second_manual


def test_inject_unplaced_block_goes_to_end_with_warning(capsys):
    blocks = [("## Renamed section", "Orphan block content.\n")]
    fresh_doc = _md("""
        # Validation

        ## Source

        Source content.

        ## Known limitations

        Limitations text.
    """)
    result = _inject_manual_blocks(fresh_doc, blocks, region_id="rajasthan-test")
    # Block should appear at end of doc.
    assert _UNPLACED_WARNING in result
    assert "Orphan block content." in result
    # Warning on stderr.
    captured = capsys.readouterr()
    assert "Renamed section" in captured.err or "no longer exists" in captured.err


def test_inject_top_blocks_go_before_first_heading():
    blocks = [("__TOP__", "Preamble content.\n")]
    fresh_doc = _md("""
        # Validation

        ## Source

        Content.
    """)
    result = _inject_manual_blocks(fresh_doc, blocks, region_id="test")
    preamble_pos = result.index("Preamble content.")
    heading_pos = result.index("# Validation")
    assert preamble_pos < heading_pos


def test_inject_multiple_blocks_same_section_all_placed():
    blocks = [
        ("## Known limitations", "First block.\n"),
        ("## Known limitations", "Second block.\n"),
    ]
    fresh_doc = _md("""
        # Validation

        ## Known limitations

        Auto text.

        ## Links

        Links.
    """)
    result = _inject_manual_blocks(fresh_doc, blocks, region_id="test")
    assert "First block." in result
    assert "Second block." in result
    # Both appear before ## Links.
    links_pos = result.index("## Links")
    assert result.index("First block.") < links_pos
    assert result.index("Second block.") < links_pos


# ---------------------------------------------------------------------------
# build_region_doc_with_manual_blocks (integration)
# ---------------------------------------------------------------------------

def _minimal_region() -> dict:
    return {
        "id": "test-region",
        "name": "Test Region",
        "country": "TST",
        "lat": 0.0,
        "lon": 0.0,
        "tier": "static",
        "kind": "solar",
        "source": "Test source",
        "source_url": "https://example.com",
    }


def test_no_markers_generates_clean_doc(tmp_path):
    """A doc with no markers regenerates without any BEGIN/END markers."""
    out_path = tmp_path / "test-region.md"
    # Write a doc with no markers.
    out_path.write_text("# Previous doc\n\nNo markers here.\n", encoding="utf-8")
    result = build_region_doc_with_manual_blocks(_minimal_region(), {}, out_path)
    assert _MANUAL_BEGIN not in result
    assert _MANUAL_END not in result


def test_no_existing_doc_generates_clean_doc(tmp_path):
    """If no existing doc exists, generates fresh without errors."""
    out_path = tmp_path / "new-region.md"
    # File does not exist.
    result = build_region_doc_with_manual_blocks(_minimal_region(), {}, out_path)
    assert "Test Region" in result
    assert _MANUAL_BEGIN not in result


def test_manual_block_survives_regen(tmp_path):
    """The key integration test: a manual block in the existing doc
    must survive a full regeneration cycle."""
    region = _minimal_region()
    out_path = tmp_path / "test-region.md"

    # Write a doc that has a manual block under ## Known limitations.
    existing = _md(f"""
        # Validation — Test Region (`test-region`)

        Last updated: 2026-01-01

        ## Source

        Some source info.

        ## Known limitations

        Auto limitations.

        {_MANUAL_BEGIN}
        | # | Item | Verdict | Reason |
        |---|------|---------|--------|
        | 1 | DSM / deviation | no | Not applicable |
        {_MANUAL_END}

        ## Links

        Links here.
    """)
    out_path.write_text(existing, encoding="utf-8")

    result = build_region_doc_with_manual_blocks(region, {}, out_path)

    assert _MANUAL_BEGIN in result
    assert "DSM / deviation" in result
    assert "Not applicable" in result


def test_manual_block_position_is_within_correct_section(tmp_path):
    """Manual block placed under ## Known limitations stays in that section
    in the regenerated doc."""
    region = _minimal_region()
    out_path = tmp_path / "test-region.md"

    existing = _md(f"""
        # Validation

        ## Known limitations

        Auto text.

        {_MANUAL_BEGIN}
        Preserved citation.
        {_MANUAL_END}

        ## Links

        Links.
    """)
    out_path.write_text(existing, encoding="utf-8")

    result = build_region_doc_with_manual_blocks(region, {}, out_path)

    lim_pos = result.index("## Known limitations")
    manual_pos = result.index(_MANUAL_BEGIN)
    # Links heading should exist in regenerated doc.
    links_pos = result.index("## Links")
    assert lim_pos < manual_pos < links_pos


def test_renamed_section_falls_back_to_end_with_warning(tmp_path, capsys):
    """If the section heading has been renamed in the new template, the
    block falls back to end of doc with a WARNING comment."""
    region = _minimal_region()
    out_path = tmp_path / "test-region.md"

    existing = _md(f"""
        # Validation

        ## Old section name

        Content.

        {_MANUAL_BEGIN}
        Orphan block.
        {_MANUAL_END}
    """)
    out_path.write_text(existing, encoding="utf-8")

    result = build_region_doc_with_manual_blocks(region, {}, out_path)

    # Block must still appear in the output.
    assert "Orphan block." in result
    # Warning comment at end.
    assert _UNPLACED_WARNING in result
    # Warning on stderr.
    captured = capsys.readouterr()
    assert "no longer exists" in captured.err or "Old section name" in captured.err
