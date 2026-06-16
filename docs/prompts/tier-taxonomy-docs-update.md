# Tier Taxonomy Docs Update — Delegation Brief

## Context for all workers

The ELJ dashboard codebase has been refactored (commit 81011bf). The **data-quality tier** axis previously mixed content types with quality levels. We separated them:

| Old value  | New value    | Meaning |
|-----------|-------------|---------|
| `static`  | `estimated` | Modelled profile scaled to an annual anchor (T3) |
| `flare`   | `anchored`  | Published annual data, flat profile (T2) |

Three orthogonal classification axes now exist:
1. **kind** — content type: wind, solar, hydro, flare, mixed
2. **tier** — data quality: live, anchored, estimated
3. **sourceProvenance** — source status: verified, official-lead, modelled-fallback

The **ConfidenceTier** labels are unchanged: T1a-live-tso, T1b-live-domestic-anchored, T1c-live-neighbour-anchored, T2-annual-calibrated, T3-modelled. The T2-flare presentational bucket still exists but is now derived from `kind === "flare"` rather than `tier === "flare"`.

Region counts: T1a=155, T1b=9, T1c=1, T2=6 (non-flare anchored), T2-flare=8, T3=205, total=384.

Six regions with published annual data and flat profiles were promoted from T3 (estimated) to T2 (anchored): austria, russia-murmansk-wind, china-hunan-hydro, china-hubei-hydro, china-guizhou-hydro, china-chongqing-hydro.

---

## Task 1 — Methodology page (MiniMax)

**File:** `src/methodology.md` in the dashboard repo  
**Worker:** MiniMax (mmx)  
**Why MiniMax:** Straightforward prose rewrite with clear before/after; no judgment calls.

**Instructions:**
Search the file for any remaining references to "static" as a tier label. Replace with the correct new terminology. Specifically:

1. The tier taxonomy table should show three tiers: **live** (sub-tiers T1a/T1b/T1c), **anchored** (T2), **estimated** (T3). Flare should NOT appear as a tier — it's a content type.
2. Any prose that says "static regions" should say "estimated regions" (or "anchored regions" for the six flat-profile ones).
3. The T2-annual-calibrated description should note it covers 14 regions: 6 non-flare anchored + 8 flare anchored.
4. Add a brief paragraph (2–3 sentences) explaining the three-axis classification: kind, tier, sourceProvenance.
5. Do NOT change the ConfidenceTier labels or the uncertainty percentages — those are unchanged.

Output the full updated methodology section so Simon can paste-replace.

---

## Task 2 — Scientific Data paper sections (DeepSeek)

**File:** The "Data Records" and "Technical Validation" sections of the Scientific Data descriptor paper (draft in Google Drive, "Every Last Joule" folder).  
**Worker:** DeepSeek-V4-Pro via `/tmp/dsk/call.py`  
**Why DeepSeek:** Longer-form academic prose with structured argumentation; DeepSeek handles this well and is cheap for the volume.

**Instructions:**
The paper currently describes the tier system using the old "static"/"flare" labels. Rewrite the relevant paragraphs to reflect:

1. **Data Records section:** The tiered confidence framework now has three input tiers (live/anchored/estimated) mapped to five ConfidenceTier labels (T1a/T1b/T1c/T2/T3). Content type (kind) is orthogonal — a flare region and a wind region can both be "anchored" if they have published annual data. Explain the three-axis classification briefly.

2. **Technical Validation section:** The uncertainty model is unchanged (same ±percentages per tier), but the justification paragraph should reflect that "estimated" (formerly "static") regions use modelled profiles scaled to annual anchors, while "anchored" regions have direct published data. The promotion of 6 regions from T3→T2 based on their published annual data should be noted as a validation improvement.

3. Use AMA 8th edition citation style. Keep the academic register. Do not change the structure or add new sections — just update the terminology and add the three-axis explanation where it naturally fits.

Output the rewritten paragraphs with clear markers for where they slot into the existing paper.

---

## Task 3 — DARI draft update (DeepSeek)

**File:** DARI policy brief draft (in Google Drive, likely "DARI" or "da-ri.org" folder).  
**Worker:** DeepSeek-V4-Pro  
**Why DeepSeek:** Professional/policy prose, similar register to Task 2.

**Instructions:**
If the DARI draft references the tier system or mentions "static" regions:

1. Replace "static" with "estimated" throughout.
2. If the draft discusses flare gas regions, note that "flare" is a content type, not a data-quality tier — these regions are classified as "anchored" because they have published annual production data.
3. Keep the light-touch, accessible register appropriate for DARI (not academic — policy audience).
4. Do not change any numbers, conclusions, or recommendations — only the taxonomy terminology.

Output the changed paragraphs only, with enough surrounding context to locate them.

---

## Task 4 — Review pass (Opus)

**Worker:** Claude Opus  
**Why Opus:** Judgment-heavy coherence check across all three outputs.

After MiniMax and DeepSeek produce their outputs:

1. Verify terminology consistency across all three documents — same terms used the same way.
2. Check that no old "static"/"flare" tier references survive.
3. Verify the numbers are correct (384 total, 155+9+1+6+8+205, etc.).
4. Flag any places where the three-axis explanation is confusing or contradictory.
5. Produce a final sign-off or list of corrections.
