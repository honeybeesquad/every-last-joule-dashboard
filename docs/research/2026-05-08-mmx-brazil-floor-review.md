## Audit Decision: **APPROVE with standard caveats**

This can be the first source-verified annual floor slice.

---

## Blockers Assessed

**None.** No items rise to the level of blocking publication.

---

## Verification Checklist

| Criterion | Status | Notes |
|---|---|---|
| Official primary source | OK | ONS Brazil is the national grid operator |
| Source URL pattern traceable | OK | S3-hosted ONS open-data monthly CSVs |
| Formula reproducible | OK | `max(ref - actual, 0) * 0.5h` with locked fields |
| Correct field discipline | OK | `val_geracaolimitada` excluded; frustrated generation used |
| Complete calendar year | OK | Jan–Dec 2025 monthly files summed |
| Rows filtered to positive energy | OK | Zero-frustrated rows (incl. `brazil-other-wind`) correctly excluded |
| Diagnostic energy separated | OK | Limited-setpoint (63 TWh) held in research only, not mixed into floor |
| Validation documentation present | OK | `docs/validation/brazil-ons-annual-floor-2025.md` |
| Research artifact traceable | OK | Reconciliation CSV and MD linked |
| Generator script auditable | OK | Node script included with full logic |

---

## Required Caveats

These are standard for any public release and do not block publication:

1. **Brazil-only slice.** The floor is the official ONS measured constrained-off slice for Brazil, not a global floor. Absence of other countries in this file is expected and correct.
2. **Incomplete state coverage is not zero.** States/fuels not present in the monthly ONS constrained-off files must not be treated as zero curtailment; they may simply have no constrained-off events recorded.
3. **ONS dictionary field status.** Release notes should note that `val_geracaolimitada` is a limited-setpoint diagnostic per the ONS data dictionary and is not included in the curtailment floor.
4. **Conservative floor definition.** The 3.808 TWh figure represents frustrated-generation-only; the larger limited-setpoint integral (63.050 TWh) is excluded by design and must not be added.

---

## Notes on the Diagnostic Separation

The reconciliation shows a large limited-setpoint diagnostic (63.050 TWh vs. 3.808 TWh floor). This discrepancy is expected and is correctly documented:

- **Frustrated generation** (floor): `max(val_geracaoreferenciafinal - val_geracao, 0) x 0.5h` - energy the resource could have produced but did not.
- **Limited setpoint** (diagnostic): integral of `val_geracaolimitada` - generation at the operator-imposed limit, retained for reconciliation only.

The floor correctly captures the smaller frustrated-generation quantity, which is the conservative gate for public curtailment reporting.

---

## Conclusion

The Brazil 2025 ONS source-verified annual floor is correctly gated. Source fields, formula, unit conversion, calendar coverage, and field discipline are all locked and reproducible. No blockers identified. Approve for public release with standard caveats.
