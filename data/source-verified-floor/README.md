# Source-Verified Annual Curtailment Floor

This directory is the conservative public annual floor layer for Every Last Joule.

Rows are included only when all of these are true:

- the source is an official operator, regulator, or market/system operator source;
- the source fields measure curtailed, constrained-off, or frustrated renewable energy, not deviation settlement, instructions, capacity at risk, or an assumed rate;
- the interval length and calendar-year coverage are locked;
- the row can be reproduced from a script or documented extraction artifact;
- the validation document names the source, formula, and exclusions.

The floor is intentionally incomplete. A row missing here is not a zero; it means the region has not yet cleared the source-verified annual floor gate.

Some rows use floor-only IDs when the official annual source has a different geographic scope from an existing dashboard snapshot. For example, `chile-sen-solar` is SEN-wide Chile solar reduction energy, not the dashboard's Atacama-only spatial label.
