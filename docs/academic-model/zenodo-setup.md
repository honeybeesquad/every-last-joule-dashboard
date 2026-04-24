# Zenodo integration — Simon's manual steps (~20 min)

Zenodo automatically archives a release whenever a tagged version is pushed to a GitHub repo it's watching. One-time setup, then it runs forever.

## Step 1 — enable the integration (5 min)

1. Go to https://zenodo.org/account/settings/github/
2. Sign in with the GitHub account that owns `honeybeesquad/every-last-joule-dashboard`
3. Find `honeybeesquad/every-last-joule-dashboard` in the list and flip the switch to **ON**
4. Confirm the OAuth scope request (Zenodo needs `read:repo_hook` and `admin:repo_hook`)

## Step 2 — seed the metadata (10 min)

Before the first tag is pushed, edit the Zenodo metadata that gets applied to every archive. From https://zenodo.org/account/settings/github/ click the repo, then fill:

- **Title**: `Every Last Joule: an hourly synthesis of renewable-electricity curtailment and associated-gas flaring across 122 regions`
- **Description** (paste from `dataset/README.md` "What's in it" section, or shorten):
  > A versioned, reproducible synthesis dataset of hourly renewable-electricity curtailment and associated-gas flaring, covering 122 regions across six continents. Combines live transmission-system-operator feeds (ENTSO-E, EIA, AEMO, Elexon, ONS) with published annual calibration (IRENA, Ember, GGFR). Published to support the Every Last Joule thesis on Bitcoin-curtailment matching, made fully open for any renewable-integration research.
- **Authors**: `Collins, Simon` (affiliation blank unless you want DARI)
- **ORCID**: your ORCID iD (create at https://orcid.org if you don't have one — takes 2 min). Then update `dataset/CITATION.cff` `orcid:` field to match.
- **Keywords**: `curtailment, renewable energy, flaring, grid integration, solar, wind, hydro, Bitcoin, demand response, open data`
- **Licence**: `Creative Commons Attribution 4.0 International` (CC-BY-4.0)
- **Access right**: `Open`
- **Communities** (optional, free visibility): add `zenodo` and `GFZ Data Services` if accepting

## Step 3 — tell me when you're done

Once the toggle is on and the metadata is seeded, I'll push the v1.0.0 tag. Within ~5 minutes Zenodo will mint a DOI. I'll then:
1. Read the DOI from the Zenodo webhook response (or from the repo's new Zenodo badge)
2. Write it into `dataset/CITATION.cff` `identifiers:` section
3. Write it into `dataset/README.md` header
4. Push a `chore: record Zenodo DOI` commit

## What you'll get

- A Zenodo DOI resolvable at `https://doi.org/10.5281/zenodo.<N>` — this is the citation target in the paper
- A Zenodo badge in the repo README showing the latest archived version
- Versioned DOIs for every future tag (v1.0.1, v1.1.0, etc.) with a "concept DOI" that always resolves to the latest version — both are useful, both can be cited
- Full archival — if GitHub vanishes, the data survives on Zenodo

## If something goes wrong

- **Zenodo 500s on the webhook**: wait 10 min and retry the tag push. Zenodo occasionally has CERN-infrastructure hiccups. The integration is idempotent on re-push.
- **DOI not minted after 30 min**: check https://zenodo.org/account/settings/github/ for the repo's most-recent-archive error message. Usually metadata validation.
- **Want to un-publish a version**: you can't delete a DOI, but you can mark a version as "withdrawn." Better to push a v1.0.1 that supersedes the bad v1.0.0 than to try to hide the original.

## References

- Zenodo GitHub guide: https://zenodo.org/help/en/guides.html
- Zenodo DOI versioning: https://help.zenodo.org/faq/#versioning
- GitHub's own Zenodo how-to: https://docs.github.com/en/repositories/archiving-a-github-repository/referencing-and-citing-content
