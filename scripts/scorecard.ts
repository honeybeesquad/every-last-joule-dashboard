/**
 * Comprehensiveness Scorecard
 *
 * Computes a credibility-oriented audit of the every-last-joule dataset:
 * how much is measured, how much is modelled, where the gaps are, and how
 * fresh the live feeds are. Run with:
 *
 *   npm run scorecard
 *
 * Outputs:
 *   docs/comprehensiveness-scorecard.md   — human-readable report
 *   data/scorecard.json                   — machine-readable summary
 *
 * Accepts an optional --date YYYY-MM-DD flag to override the reference date
 * for freshness bucketing. Defaults to the newest `lastSuccessAt` timestamp
 * found across all snapshots (not Date.now(), to avoid churn on repeated runs).
 *
 * This script is read-only: it touches no data files, no regions.ts, and
 * no golden fixtures.
 *
 * The two outputs above are written only when this file is run as the main
 * module. Importing it for `computeScorecard` writes nothing, so `npm test`
 * and the CI gates leave the tracked output files alone.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { REGIONS } from "../src/lib/regions.js";
import { resolveAll } from "./lib/tier-resolution.js";
import type { RegionData, RegionTier } from "../src/lib/types.js";

// ── Paths ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SNAP_DIR = path.join(ROOT, "data/snapshots/last-good");
const KNOWN_LIMITATIONS = path.join(ROOT, "docs/known-limitations.md");

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let cliDate: Date | null = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--date" && args[i + 1]) {
    cliDate = new Date(args[i + 1] + "T00:00:00Z");
  }
}

// ── Snapshot loading ──────────────────────────────────────────────────────────

/** Load every RegionData record from committed last-good snapshots. */
function loadSnapshots(): Map<string, RegionData> {
  const map = new Map<string, RegionData>();
  const files = fs
    .readdirSync(SNAP_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(SNAP_DIR, file), "utf8"));
    if (typeof raw !== "object" || raw === null) continue;

    if ("regionId" in raw && typeof raw.regionId === "string") {
      // Single-region snapshot file
      map.set(raw.regionId, raw as RegionData);
    } else {
      // Multi-region snapshot file (dict keyed by regionId)
      for (const [, val] of Object.entries(raw)) {
        if (
          typeof val === "object" &&
          val !== null &&
          "regionId" in val &&
          typeof (val as Record<string, unknown>).regionId === "string"
        ) {
          const rd = val as RegionData;
          map.set(rd.regionId, rd);
        }
      }
    }
  }
  return map;
}

// ── Tier classification helpers ───────────────────────────────────────────────

/** Map RegionTier → T1/T2/T3 MeasuredClass for scorecard grouping. */
type MeasuredClass = "measured" | "anchored" | "modelled";

function tierToClass(tier: RegionTier): MeasuredClass {
  if (tier === "live" || tier === "live-domestic-anchored" || tier === "live-neighbour-anchored") {
    return "measured";
  }
  if (tier === "anchored") return "anchored";
  return "modelled";
}

/** Human display for tier values. */
const TIER_LABELS: Record<RegionTier, string> = {
  live: "live (T1a)",
  "live-domestic-anchored": "live-domestic-anchored (T1b)",
  "live-neighbour-anchored": "live-neighbour-anchored (T1c)",
  anchored: "anchored (T2)",
  estimated: "estimated (T3)",
};

// ── Freshness bucketing ───────────────────────────────────────────────────────

type FreshnessBucket = "<24h" | "<7d" | "7-30d" | ">30d" | "no-timestamp";

function freshnessBucket(lastSuccessAt: string | undefined, refDate: Date): FreshnessBucket {
  if (!lastSuccessAt) return "no-timestamp";
  const ts = new Date(lastSuccessAt);
  if (isNaN(ts.getTime())) return "no-timestamp";
  const ageMs = refDate.getTime() - ts.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 1) return "<24h";
  if (ageDays < 7) return "<7d";
  if (ageDays <= 30) return "7-30d";
  return ">30d";
}

// ── Main computation ──────────────────────────────────────────────────────────

function pct(n: number, total: number): string {
  if (total === 0) return "0.0";
  return ((n / total) * 100).toFixed(1);
}

function fmt(n: number, dp = 1): string {
  return n.toFixed(dp);
}

export interface ScorecardData {
  generatedOn: string;          // ISO date from newest snapshot timestamp
  regionCount: number;
  countryCount: number;
  byTier: Record<RegionTier, number>;
  byKind: Record<string, number>;
  byProvenance: Record<string, number>;
  measuredClass: { measured: number; anchored: number; modelled: number };
  freshnessBuckets: Record<FreshnessBucket, number>;
  staleButLive: string[];       // live-tier regionIds with snapshot >7d
  twhByClass: { measured: number; anchored: number; modelled: number; total: number };
  snapshotCoverage: { inSnapshots: number; notInSnapshots: number };
}

export function computeScorecard(): ScorecardData {
  const snapshots = loadSnapshots();

  // Find reference date from newest lastSuccessAt
  let newestTs = new Date(0);
  for (const rd of snapshots.values()) {
    const ts = rd.lastSuccessAt ? new Date(rd.lastSuccessAt) : null;
    if (ts && !isNaN(ts.getTime()) && ts > newestTs) {
      newestTs = ts;
    }
  }
  const refDate = cliDate ?? newestTs;

  // ── Counts from canonical REGIONS list ───────────────────────────────────

  const byTier: Record<RegionTier, number> = {
    live: 0,
    "live-domestic-anchored": 0,
    "live-neighbour-anchored": 0,
    anchored: 0,
    estimated: 0,
  };

  const byKind: Record<string, number> = {};
  const byProvenance: Record<string, number> = {
    verified: 0,
    "official-lead": 0,
    "modelled-fallback": 0,
  };

  const measuredClass: ScorecardData["measuredClass"] = {
    measured: 0,
    anchored: 0,
    modelled: 0,
  };

  const countries = new Set<string>();

  for (const r of REGIONS) {
    byTier[r.tier]++;
    byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    countries.add(r.country);
    const prov = r.sourceProvenance ?? "modelled-fallback";
    byProvenance[prov] = (byProvenance[prov] ?? 0) + 1;
    measuredClass[tierToClass(r.tier)]++;
  }

  // ── Freshness analysis (from snapshots) ──────────────────────────────────

  const freshnessBuckets: Record<FreshnessBucket, number> = {
    "<24h": 0,
    "<7d": 0,
    "7-30d": 0,
    ">30d": 0,
    "no-timestamp": 0,
  };

  const staleButLive: string[] = [];

  // Map regionId → tier for fast lookup
  const regionById = new Map(REGIONS.map((r) => [r.id, r]));

  for (const [regionId, rd] of snapshots.entries()) {
    const bucket = freshnessBucket(rd.lastSuccessAt, refDate);
    freshnessBuckets[bucket]++;

    // Flag live-tier regions with snapshots >7d stale
    const region = regionById.get(regionId);
    if (region && tierToClass(region.tier) === "measured" && (bucket === "7-30d" || bucket === ">30d")) {
      staleButLive.push(regionId);
    }
  }

  // ── TWh by measured class (from snapshots) ────────────────────────────────

  const twhByClass: ScorecardData["twhByClass"] = {
    measured: 0,
    anchored: 0,
    modelled: 0,
    total: 0,
  };

  for (const [regionId, rd] of snapshots.entries()) {
    const region = regionById.get(regionId);
    if (!region) continue;
    const cls = tierToClass(region.tier);
    twhByClass[cls] += rd.totalTWh;
    twhByClass.total += rd.totalTWh;
  }

  // ── Snapshot coverage ────────────────────────────────────────────────────

  let inSnapshots = 0;
  let notInSnapshots = 0;
  for (const r of REGIONS) {
    if (snapshots.has(r.id)) inSnapshots++;
    else notInSnapshots++;
  }

  return {
    generatedOn: refDate.toISOString().slice(0, 10),
    regionCount: REGIONS.length,
    countryCount: countries.size,
    byTier,
    byKind,
    byProvenance,
    measuredClass,
    freshnessBuckets,
    staleButLive: staleButLive.sort(),
    twhByClass,
    snapshotCoverage: { inSnapshots, notInSnapshots },
  };
}

// ── Report generation ─────────────────────────────────────────────────────────

function buildMarkdownReport(sc: ScorecardData): string {
  const total = sc.regionCount;

  // Tier table rows
  const tierRows = (
    [
      "live",
      "live-domestic-anchored",
      "live-neighbour-anchored",
      "anchored",
      "estimated",
    ] as RegionTier[]
  ).map((t) => {
    const n = sc.byTier[t];
    return `| ${TIER_LABELS[t]} | ${n} | ${pct(n, total)}% |`;
  });

  // Kind table rows
  const kindOrder = ["solar", "wind", "hydro", "mixed", "geo"];
  const kindRows = kindOrder
    .filter((k) => sc.byKind[k])
    .map((k) => `| ${k} | ${sc.byKind[k]} | ${pct(sc.byKind[k], total)}% |`);

  // Provenance table rows
  const provRows = (["verified", "official-lead", "modelled-fallback"] as const).map((p) => {
    const n = sc.byProvenance[p] ?? 0;
    return `| ${p} | ${n} | ${pct(n, total)}% |`;
  });

  // Measured class headline
  const { measured, anchored: anch, modelled } = sc.measuredClass;
  const measuredPct = pct(measured, total);
  const anchPct = pct(anch, total);
  const modPct = pct(modelled, total);

  // TWh class
  const tTotal = sc.twhByClass.total;
  const tMeasured = sc.twhByClass.measured;
  const tAnch = sc.twhByClass.anchored;
  const tMod = sc.twhByClass.modelled;

  // Freshness
  const fb = sc.freshnessBuckets;
  const fbTotal = Object.values(fb).reduce((a, b) => a + b, 0);

  // Stale-but-live section
  const staleSection =
    sc.staleButLive.length === 0
      ? "_None — all live-tier regions have snapshots refreshed within 7 days of the reference date._"
      : sc.staleButLive.map((id) => `- \`${id}\``).join("\n");

  return `# Comprehensiveness Scorecard

> Generated from committed snapshots in \`data/snapshots/last-good/\`.
> Reference date: **${sc.generatedOn}** (newest \`lastSuccessAt\` across all snapshots).
> Regenerate: \`npm run scorecard\`

---

## 1. Coverage counts

| Metric | Value |
|---|---|
| Total regions | **${total}** |
| Distinct countries / territories | **${sc.countryCount}** |
| Regions with committed snapshots | ${sc.snapshotCoverage.inSnapshots} / ${total} |
| Regions without snapshots (static stubs) | ${sc.snapshotCoverage.notInSnapshots} |

## 2. Regions by fuel / energy type

| Kind | Count | Share |
|---|---|---|
${kindRows.join("\n")}

## 3. Tier breakdown

The tier field records **data-quality methodology**, not source freshness.
See docs/methodology/tier-classification-guide.md for definitions.

| Tier | Count | Share |
|---|---|---|
${tierRows.join("\n")}

### Headline split

| Class | Regions | Share |
|---|---|---|
| Measured (T1 live*) | **${measured}** | **${measuredPct}%** |
| Anchored (T2) | **${anch}** | **${anchPct}%** |
| Modelled (T3 estimated) | **${modelled}** | **${modPct}%** |

_*T1 = live + live-domestic-anchored + live-neighbour-anchored_

## 4. Source provenance

| Provenance | Count | Share |
|---|---|---|
${provRows.join("\n")}

- **verified** — snapshot value comes from a verified upstream feed or anchor.
- **official-lead** — authoritative source exists and loader is wired or scaffolded, but the live path is not producing usable data (geoblocked, auth-gated, parser pending). Snapshot falls back to modelled or last-good.
- **modelled-fallback** — no verified upstream link. Snapshot is a typical-shape profile scaled to an anchor, or otherwise estimated.

## 5. Freshness (snapshot age at reference date)

All ${fbTotal} snapshots bucketed by age of \`lastSuccessAt\`.

> **What this measures:** the age of the *committed* \`data/snapshots/last-good/*.json\` corpus — i.e. the **fallback** that is served only when a live fetch fails at build. Production redeploys roughly every 3 h (\`.github/workflows/data-refresh.yml\`) and re-fetches live, so committed-snapshot age is **not** the age of the data on everylastjoule.com (which is current whenever the upstream is reachable at build time). Many \`> 30 d\` entries are also **static-anchor** snapshots that never change by design (modelled T3 regions). The number that actually matters is the live-tier subset below.

| Age bucket | Snapshots | Share |
|---|---|---|
| < 24 h | ${fb["<24h"]} | ${pct(fb["<24h"], fbTotal)}% |
| < 7 d | ${fb["<7d"]} | ${pct(fb["<7d"], fbTotal)}% |
| 7 – 30 d | ${fb["7-30d"]} | ${pct(fb["7-30d"], fbTotal)}% |
| > 30 d | ${fb[">30d"]} | ${pct(fb[">30d"], fbTotal)}% |
| No timestamp | ${fb["no-timestamp"]} | ${pct(fb["no-timestamp"], fbTotal)}% |

### Live-tier regions with stale snapshots (> 7 d)

Live-tier regions whose committed **fallback** snapshot is > 7 d old. Prod still
re-fetches these every ~3 h, so this does **not** mean the live site shows stale
data — but it flags (a) the fallback corpus worth periodically regenerating, and
(b) any feed that may have silently drifted to its fallback. Cross-check the
\`health-check.yml\` prod monitor before treating any as a live outage.

${staleSection}

## 6. Magnitude: 30-day TWh by data quality class

The \`totalTWh\` field in each snapshot is the trailing-30-day curtailment
scaled to annualised GW-hours. The table below partitions this total by the
measured / anchored / modelled classification of the underlying region.

| Class | 30-day TWh | Share of total |
|---|---|---|
| Measured (T1 live*) | ${fmt(tMeasured)} | ${pct(tMeasured, tTotal)}% |
| Anchored (T2) | ${fmt(tAnch)} | ${pct(tAnch, tTotal)}% |
| Modelled (T3 estimated) | ${fmt(tMod)} | ${pct(tMod, tTotal)}% |
| **Total** | **${fmt(tTotal)}** | — |

_Annualised estimate ≈ ${fmt(tTotal * 12, 0)} TWh/yr (multiply 30-day figure by 12)._

## 7. Known blind spots

The following limitations are material to any claim of comprehensiveness.
They are reproduced from \`docs/known-limitations.md\`.

### 7.1 Self-curtailment is invisible (limitation #1)

Market-data curtailment captures system-operator dispatch-down instructions,
but it does not capture asset owners privately throttling output in response
to negative prices or local economics. Observed curtailment is commonly only
about **50–70% of true curtailment** once self-curtailment behaviour in
ERCOT and European markets is considered. The AEMO SEMIDISPATCHCAP feed is
an exception — it measures operator-directed dispatch limits, which captures
more of the signal than market prices alone.

### 7.2 Geographic gaps (limitation #2)

Coverage is broad but not a strict global total. Several large renewable
markets — most notably mainland China's full provincial picture, India's
state-level dispatch registers, and most of sub-Saharan Africa — currently
rely on annual-anchor estimates rather than measured dispatch-down series.

### 7.3 European curtailment has no machine-readable aggregate feed

ENTSO-E Transparency Platform does not publish a curtailment-energy product
(A77 "Curtailed Renewable Energy" does not exist as a live API endpoint).
European regions use ENTSO-E generation feeds combined with national
regulator-published annual rates, yielding T1b (live-domestic-anchored)
at best. No single European feed gives direct-measured curtailment volumes
comparable to AEMO SEMIDISPATCHCAP or CAISO OASIS.

### 7.4 Modelled regions dominate by count

As shown in section 3, **${modPct}%** of regions (${modelled} of ${total}) are in the
T3-modelled class. These regions carry ±40% uncertainty envelopes and
rely on capacity-based or literature anchors rather than operational
dispatch data. By TWh, modelled regions account for **${pct(tMod, tTotal)}%**
of the 30-day total — a lower share than their count would suggest,
because T1 live regions cover the highest-volume grids.

---

_This report is a credibility instrument. Weaknesses are listed as prominently
as strengths. To improve any metric, upgrade the underlying tier or source for
the relevant region in \`src/lib/regions.ts\` and re-run \`npm run scorecard\`._
`;
}

// ── Write outputs ─────────────────────────────────────────────────────────────

// Guarded so that importing this module for `computeScorecard` (tests/scorecard.test.ts,
// and anything else that pulls it in transitively) does not rewrite the two tracked
// output files as a side effect. `npm run scorecard` still regenerates both.
const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]!).href;

if (isMain) {
  const sc = computeScorecard();

  // Write JSON
  const jsonPath = path.join(ROOT, "data/scorecard.json");
  fs.writeFileSync(jsonPath, JSON.stringify(sc, null, 2) + "\n");
  console.log(`Wrote ${jsonPath}`);

  // Write Markdown
  const mdPath = path.join(ROOT, "docs/comprehensiveness-scorecard.md");
  const mdContent = buildMarkdownReport(sc);
  fs.writeFileSync(mdPath, mdContent);
  console.log(`Wrote ${mdPath}`);

  // Print headline summary to stdout
  const { measured, anchored: anch2, modelled } = sc.measuredClass;
  const T = sc.regionCount;
  console.log(`\n=== Comprehensiveness Scorecard (${sc.generatedOn}) ===`);
  console.log(`Regions:        ${T} across ${sc.countryCount} countries/territories`);
  console.log(`Measured (T1):  ${measured} (${pct(measured, T)}%)`);
  console.log(`Anchored (T2):  ${anch2} (${pct(anch2, T)}%)`);
  console.log(`Modelled (T3):  ${modelled} (${pct(modelled, T)}%)`);
  console.log(`Provenance: verified=${sc.byProvenance["verified"]}, official-lead=${sc.byProvenance["official-lead"]}, modelled-fallback=${sc.byProvenance["modelled-fallback"]}`);
  console.log(`Freshness: <24h=${sc.freshnessBuckets["<24h"]}, <7d=${sc.freshnessBuckets["<7d"]}, 7-30d=${sc.freshnessBuckets["7-30d"]}, >30d=${sc.freshnessBuckets[">30d"]}`);
  const twh = sc.twhByClass;
  console.log(`30-day TWh: measured=${fmt(twh.measured)}, anchored=${fmt(twh.anchored)}, modelled=${fmt(twh.modelled)}, total=${fmt(twh.total)}`);
  console.log(`Stale-but-live feeds: ${sc.staleButLive.length}`);
}
