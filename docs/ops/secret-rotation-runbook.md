# Secret rotation runbook

**Created:** 2026-06-16 · **Trigger:** committee audit 2026-05-12 (SEC-1/2/3), confirmed still live on 2026-06-16.

This is the remediation procedure for the leaked/at-risk credentials flagged in
[`committee-code-review-2026-05-12.md`](committee-code-review-2026-05-12.md).
The canonical, placeholder-only template lives at [`.env.example`](../../.env.example).

## Honest severity (read before you panic-rotate)

The audit rated SEC-1 "high" because it's a *leaked* credential. By **blast radius** the real order is different:

| Secret | Where exposed | Impact if abused | Real priority |
|---|---|---|---|
| `ERCOT_USERNAME` / `ERCOT_PASSWORD` / `ERCOT_API_KEY` | Vercel Production (sensitive, set 2026-04-23), and `.env.local` until that file went missing (found absent 2026-09-09); **not** in git history. Since #1150 builds skip the only loader that reads them | Real account login | **Highest** — these are account credentials |
| `DEEPSEEK_API_KEY` | `.env.local` only, until that file went missing (found absent 2026-09-09) | Paid LLM API → $ if abused | High (cost) |
| `EIA_API_KEY` | **Leaked in git history** (test fixtures, redacted from HEAD in `b9c63c4`) | Free, read-only, rate-limited public-data key | Medium — wide exposure, tiny impact |
| `ENTSOE_API_TOKEN` | Vercel Production and Development; `.env.local` until that file went missing (found absent 2026-09-09) | Free, read-only public-data token | Low |
| Vercel OIDC JWT (`.vercel/.env.production.local`) | local file | Short-lived (hours); likely already expired | Low |

Takeaway: **rotating a key makes the leaked copy worthless** — that's the actual fix; history-rewrite (below) is optional cleanup. The genuinely sensitive items (ERCOT login, DeepSeek) were *not* committed to history; they only sit unencrypted on disk, so the urgent action there is "move to a password manager," not "rewrite history." (2026-09-29: that disk copy went missing from a checkout then on iCloud-synced `~/Desktop`, found absent on 2026-09-09, and the ERCOT login is also in Vercel Production; rotation remains the fix.)

## Step 1 — Rotate each secret (do the account-credential ones first)

- **ERCOT** (`apiexplorer.ercot.com` developer portal): change the account password, regenerate the subscription/API key, and update `ERCOT_PASSWORD` + `ERCOT_API_KEY` in Vercel Production (and in `.env.local` if you rebuild it). Only the disabled native-ERCOT probe reads them, and builds skip it since #1150. If native ERCOT is not coming back, closing the account retires the login too; then delete the three from Vercel as well.
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

A build no longer checks the ERCOT values: builds skip the only loader that reads them. Check a new ERCOT password with a direct token request, which touches nothing in the repo. It prints `200` when the login works and `400` when ERCOT's sign-in service rejects it:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  'https://ercotb2c.b2clogin.com/ercotb2c.onmicrosoft.com/B2C_1_PUBAPI-ROPC-FLOW/oauth2/v2.0/token' \
  --data-urlencode grant_type=password \
  --data-urlencode "username=$ERCOT_USERNAME" \
  --data-urlencode "password=$ERCOT_PASSWORD" \
  --data-urlencode 'scope=openid fec253ea-0d06-4272-a5e6-b478baeecd70 offline_access' \
  --data-urlencode client_id=fec253ea-0d06-4272-a5e6-b478baeecd70 \
  --data-urlencode response_type=id_token
```

Don't run `src/data/ercot-native.json.ts` for this: it rewrites tracked files under `data/snapshots/`. The subscription key can only be checked against `api.ercot.com`, which answered this project's NZ checkout with Incapsula's 403 and let Vercel's US build machines through.
