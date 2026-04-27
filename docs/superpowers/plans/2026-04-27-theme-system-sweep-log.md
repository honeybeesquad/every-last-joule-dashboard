# Theme system — Final hardcoded-colour sweep log (Task 6.4)

> Audit performed by MiniMax-M2.7 (architect-reviewed by Claude). The plan's
> Task 6.4 grep `grep -rnE 'rgba\(20[,\s]+175[,\s]+172|#14afac|#f7931a' src/`
> returned 5 matches after Tasks 6.1–6.3. Each is annotated below with the
> retain/tokenize decision.

| File | Line | Match | Decision |
|------|------|-------|----------|
| `src/style.css` | 120 | `--data-flare: #f7931a;` (Sunfire) | **Retain.** This is the canonical token definition for the Sunfire theme. The literal lives here on purpose — every consumer reads it via `var(--data-flare)`. |
| `src/style.css` | 175 | `--data-flare: #f7931a;` (Vellum) | **Retain.** Same as above for the Vellum theme. |
| `src/style.css` | 229 | `--data-flare: #f7931a;` (Eclipse) | **Retain.** Same as above for the Eclipse theme. |
| `src/components/region-tooltip.js` | 9 | `readToken("--data-flare", "#f7931a")` (SSR fallback arg) | **Retain.** The literal is the second argument to `readToken()`, used only when `getComputedStyle` cannot resolve the var (SSR / pre-stylesheet eval). The runtime paint reads the live token; this is the guard. Same engineering pattern as `src/lib/fuel.ts::FUEL_FALLBACK`. |
| `src/components/timeline.js` | 153 | `readToken("--data-flare", "#f7931a")` (SSR fallback arg) | **Retain.** Same pattern as the region-tooltip site above. |

**Result:** zero runtime hardcoded paints remain. Every match is either a token *definition* (in `:root[data-theme]` blocks) or a *fallback argument* paired with its corresponding `readToken()` call. The theme system's invariant — runtime paints read live tokens — is satisfied across `src/`.

**Tests:** `npm test` → 247 passed (86 test files), 0 failures.

**Out-of-scope literals deliberately ignored:** none found. Data-point colours (e.g. fuel-mix splits in JSON loaders) live entirely in CSS variables now and were not touched by this sweep.
