/**
 * Backwards-compat shim: `scripts/validate.ts` was renamed to
 * `scripts/validate-snapshots.ts` (date of rename: pre-2026-04-29).
 * Direct callers (`npx tsx scripts/validate.ts`) hit ERR_MODULE_NOT_FOUND.
 *
 * This file simply re-exports the renamed script's main side effects so old
 * call sites keep working. The canonical entrypoint is the npm script
 * (`npm run validate`), which already points at validate-snapshots.ts.
 */
import "./validate-snapshots.js";
