# Secret rotation runbook

**Created:** 2026-06-16 · **Trigger:** committee audit 2026-05-12 (SEC-1/2/3), confirmed still live on 2026-06-16.

This is the remediation procedure for the leaked/at-risk credentials flagged in
[`committee-code-review-2026-05-12.md`](committee-code-review-2026-05-12.md).
The canonical, placeholder-only template lives at [`.env.example`](../../.env.example).

## Honest severity (read before you panic-rotate)

The audit rated SEC-1 "high" because it's a *leaked* credential. By **blast radius** the real order is different:

| Secret | Where exposed | Impact if abused | Real priority |
|---|---|---|---|
| `ERCOT_USERNAME` / `ERCOT_PASSWORD` / `ERCOT_API_KEY` | `.env.local` only (gitignored, **not** in git history) | Real account login | **Highest** — these are account credentials |
| `DEEPSEEK_API_KEY` | `.env.local` only | Paid LLM API → $ if abused | High (cost) |
| `EIA_API_KEY` | **Leaked in git history** (test fixtures, redacted from HEAD in `b9c63c4`) | Free, read-only, rate-limited public-data key | Medium — wide exposure, tiny impact |
| `ENTSOE_API_TOKEN` | `.env.local` only | Free, read-only public-data token | Low |
| Vercel OIDC JWT (`.vercel/.env.production.local`) | local file | Short-lived (hours); likely already expired | Low |

Takeaway: **rotating a key makes the leaked copy worthless** — that's the actual fix; history-rewrite (below) is optional cleanup. The genuinely sensitive items (ERCOT login, DeepSeek) were *not* committed to history; they only sit unencrypted on disk, so the urgent action there is "move to a password manager," not "rewrite history."

## Step 1 — Rotate each secret (do the account-credential ones first)

- **ERCOT** (`apiexplorer.ercot.com` developer portal): change the account password, regenerate the subscription/API key, update `ERCOT_PASSWORD` + `ERCOT_API_KEY` in `.env.local`.
- **DeepSeek** (`platform.deepseek.com` → API keys): delete the old key, create a new one, update `DEEPSEEK_API_KEY`. (Not used by the build — consider just deleting it from `.env.local`.)
- **ENTSO-E** (`transparency.entsoe.eu` → My Account Settings → Web Api Security Token): regenerate, update `ENTSOE_API_TOKEN`.
- **EIA** (`eia.gov/opendata/register.php`): EIA has **no self-serve revocation dashboard** — re-register to get a new key, switch `.env.local` to it, and stop using the old one. The leaked key may stay technically valid; impact is limited to rate-quota abuse on a free public-data endpoint. If you want it truly killed, email EIA Open Data support.
- **Vercel JWT** (`.vercel/.env.production.local`): `rm .vercel/.env.production.local` then `vercel logout && vercel login`. It's short-lived and regenerated on next pull.

## Step 2 — Clean up `.env.local`

It currently contains malformed lines (a stray password-shaped value and the leaked EIA key sitting as its own bogus key-name) alongside the real vars. Rebuild it cleanly from `.env.example` so it has exactly one well-formed `KEY=value` per line, then prefer a password manager / 1Password CLI over a plaintext file (SEC-2).

## Step 3 — (Optional) scrub the EIA key from git history

Only the EIA key is in history. Once it's rotated this is cosmetic, but to remove the literal value:

```bash
pipx install git-filter-repo            # or: brew install git-filter-repo
# Put the leaked literal in a replacement file (NOT committed):
printf '%s==>REDACTED\n' 'THE_OLD_EIA_KEY' > /tmp/elj-secrets.txt
git filter-repo --replace-text /tmp/elj-secrets.txt
```

**Heavy-operation caveats — coordinate before doing this:**
- It rewrites every commit hash → requires a **force-push to `main`** (CLAUDE.md forbids force-push without explicit approval).
- Every existing clone/worktree and open PR must be re-based or re-cloned.
- The Zenodo releases reference git tags; verify the published DOIs/tags are unaffected before and after.
- The bot automation (`AUTOMATION_TOKEN`) and branch protection on `main` will need the force-push allowed temporarily.

Because the only history-leaked key is the low-impact EIA one, **rotation alone is usually sufficient** and the rewrite can be skipped.

## Step 4 — Verify

```bash
npm run build      # loaders pick up new tokens (or fall back cleanly)
git log -p -S 'THE_OLD_EIA_KEY' --all   # after a rewrite: should return nothing
```
