# Git hooks

## `pre-commit`

Blocks commits that introduce API keys, tokens, or other secrets. Runs on
the staged diff only (additions, not deletions).

### What it catches

- **Burned keys**: explicit literal values previously leaked and redacted
  (maintained as an array at the top of the hook script). Currently:
  the EIA HEGM key leaked in v1.o (commit `e523959`), redacted in `b9c63c4`.
- **Shape matches**: `"api_key": "..."`, `"secretapikey": "..."`, Bearer
  tokens, `Ocp-Apim-Subscription-Key` headers, PEM private keys, Stripe
  live secrets, Slack tokens, AWS access keys, GitHub PATs, Porkbun
  secret keys.

### What it allows

Any line that also contains `REDACTED_FOR_FIXTURES` or `test-dummy`.
Adding these placeholders to an otherwise secret-shaped string is the
canonical way to keep fixtures committable.

### Activation

The hook activates automatically via `npm install` (a `postinstall`
script runs `git config core.hooksPath .githooks`). If it doesn't seem
to be running, re-run:

    git config core.hooksPath .githooks

### Adding a new burned value

Edit `burned_keys=(...)` in `.githooks/pre-commit`, add the literal
string, commit.

### Bypassing (last resort)

If the hook is a false positive and replacing with `REDACTED_FOR_FIXTURES`
isn't suitable, you can bypass with:

    git commit --no-verify

Document in the commit message why the bypass was safe.
