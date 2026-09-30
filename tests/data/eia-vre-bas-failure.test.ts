import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EIA_VRE_BA_CONFIGS,
  LAST_GOOD_MAX_AGE_DAYS,
  buildEiaVreBasData,
  describeFetchFailure,
  loadEiaVreBas,
} from "../../src/data/eia-vre-bas.json";
import { parseEiaIsoRegionPerFuel, type EIAResponse, type EiaIsoConfig } from "../../src/lib/eia-iso";
import { resetFetchDeadlineForTests } from "../../src/lib/fetch";
import { UNKNOWN_TIME } from "../../src/lib/freshness";
import { findRegionDataIntegrityIssues } from "../../src/lib/region-data-integrity";
import { REGIONS } from "../../src/lib/regions";
import type { RegionData } from "../../src/lib/types";
import { isTsoCollected, showsWastePillar, unpublishedEmptyRegion } from "../../src/lib/waste-status";

// The failure these tests pin: on 29 Sep 2026 15 balancing authorities (BAs)
// timed out and the loader published their records as zero-generation, `cached`
// and stamped with the build time (withFallback stamps a modelled record with no
// status "cached" at `lastSuccessAt` = now). Nothing told them from a BA that
// had worked.

const NOW = new Date("2026-09-30T06:00:00.000Z");
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const iso = (msBeforeNow: number) => new Date(NOW.getTime() - msBeforeNow).toISOString();
const now = () => NOW;

const BAS = EIA_VRE_BA_CONFIGS.map((c) => c.regionId);
const ALL_IDS = BAS.flatMap((id) => [`${id}-wind`, `${id}-solar`]);

/** One day of hourly EIA-930 rows at a constant level. */
function eia(fueltype: "WND" | "SUN", respondent: string, mw: number): EIAResponse {
  return {
    response: {
      total: 24,
      data: Array.from({ length: 24 }, (_, h) => ({
        period: `2026-09-29T${String(h).padStart(2, "0")}`,
        respondent,
        fueltype,
        value: String(mw),
      })),
    },
  };
}

/** A BA that works; each BA gets its own level so a record shows which BA it came from. */
async function working(config: EiaIsoConfig) {
  const level = 100 + BAS.indexOf(config.regionId) * 10;
  return parseEiaIsoRegionPerFuel(config, eia("WND", config.respondent, level), eia("SUN", config.respondent, level * 2));
}

const failing = (...failed: string[]) => async (config: EiaIsoConfig) => {
  if (failed.includes(config.regionId)) throw new Error("This operation was aborted");
  return working(config);
};

/** What withFallback would have written to last-good after a build at `fetchedAt`. */
async function snapshotFrom(fetchedAt: string): Promise<Record<string, RegionData>> {
  const built = await buildEiaVreBasData({ fetchPair: working, lastGood: {}, now });
  return Object.fromEntries(
    Object.entries(built).map(([id, r]) => [id, { ...r, sourceStatus: "cached" as const, lastSuccessAt: fetchedAt }]),
  );
}

const warned = () => vi.mocked(console.warn).mock.calls.flat().join("\n");

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetFetchDeadlineForTests();
});

describe("a record whose BA fetch failed, with a last-good copy", () => {
  it("serves the copy as degraded and keeps the time of the fetch that made it", async () => {
    const fetchedAt = iso(3 * HOUR_MS);
    const lastGood = await snapshotFrom(fetchedAt);
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood, now });

    for (const id of ["tva-wind", "tva-solar"]) {
      expect(out[id].sourceStatus).toBe("degraded");
      expect(out[id].lastSuccessAt).toBe(fetchedAt);
      expect(out[id].lastUpdated).toBe(lastGood[id].lastUpdated);
      expect(out[id].generationProfile).toEqual(lastGood[id].generationProfile);
      expect(out[id].generationTotalTWh).toBe(lastGood[id].generationTotalTWh);
      expect(out[id].sourceNote).toContain("fetch failed this build (This operation was aborted)");
      expect(out[id].sourceNote).toContain(`serving the copy fetched ${fetchedAt}`);
      // The copy still says what the record is, ahead of the failure.
      expect(out[id].sourceNote?.startsWith(lastGood[id].sourceNote as string)).toBe(true);
    }
  });

  it("leaves the BAs that worked as this build's records", async () => {
    const lastGood = await snapshotFrom(iso(3 * HOUR_MS));
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood, now });
    const fresh = await buildEiaVreBasData({ fetchPair: working, lastGood: {}, now });
    for (const id of ALL_IDS.filter((id) => !id.startsWith("tva-"))) {
      expect(out[id]).toEqual(fresh[id]);
    }
  });

  it("serves the same copy again after another failure, without stacking notes or refreshing its time", async () => {
    const fetchedAt = iso(6 * HOUR_MS);
    const first = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: await snapshotFrom(fetchedAt), now });
    const later = new Date(NOW.getTime() + 3 * HOUR_MS);
    const second = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: first, now: () => later });

    expect(second["tva-solar"].lastSuccessAt).toBe(fetchedAt);
    expect(second["tva-solar"].generationProfile).toEqual(first["tva-solar"].generationProfile);
    expect(second["tva-solar"].sourceNote?.split("[fetch failed this build")).toHaveLength(2);
  });

  it("stops serving a copy older than the window it summarises", async () => {
    const justInside = await snapshotFrom(iso(LAST_GOOD_MAX_AGE_DAYS * DAY_MS - HOUR_MS));
    const inside = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: justInside, now });
    expect(inside["tva-solar"].generationProfile).toBeDefined();

    const justOutside = await snapshotFrom(iso(LAST_GOOD_MAX_AGE_DAYS * DAY_MS + HOUR_MS));
    const outside = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: justOutside, now });
    expect(outside["tva-solar"].generationProfile).toBeUndefined();
    expect(outside["tva-solar"].lastSuccessAt).toBe(UNKNOWN_TIME);
  });

  it("does not serve a copy dated after now", async () => {
    const lastGood = await snapshotFrom(new Date(NOW.getTime() + 60_000).toISOString());
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood, now });
    expect(out["tva-solar"].generationProfile).toBeUndefined();
  });

  it("serves each record's own copy: a missing solar copy does not cost the wind copy", async () => {
    const fetchedAt = iso(3 * HOUR_MS);
    const lastGood = await snapshotFrom(fetchedAt);
    delete lastGood["tva-solar"];
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood, now });

    expect(out["tva-wind"].generationProfile).toEqual(lastGood["tva-wind"].generationProfile);
    expect(out["tva-wind"].lastSuccessAt).toBe(fetchedAt);
    expect(out["tva-solar"].generationProfile).toBeUndefined();
    expect(out["tva-solar"].sourceNote).toContain("no usable earlier copy of this record");
  });

  it("ignores a last-good record that is not shaped like one", async () => {
    const lastGood = await snapshotFrom(iso(HOUR_MS));
    const wind = lastGood["tva-wind"] as unknown as Record<string, unknown>;
    wind.sourceNote = 5;
    const solar = lastGood["tva-solar"] as unknown as { generationProfile: (number | null)[] };
    solar.generationProfile = [...solar.generationProfile.slice(0, 23), null];

    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood, now });
    expect(out["tva-wind"].generationProfile).toBeUndefined();
    expect(out["tva-solar"].generationProfile).toBeUndefined();
  });

  it("does not serve a zero series that an older run recorded under a failure note", async () => {
    // The shape committed in #1053: every BA failed (no key), and the zeros went
    // into last-good stamped as a success.
    const zeros = (id: string): RegionData => ({
      ...unpublishedEmptyRegion(
        id,
        "EIA-930 TVA generation fetch failed (EIA_API_KEY not set); waste unpublished.",
        iso(2 * HOUR_MS),
      ),
      sourceStatus: "cached",
    });
    const lastGood = { "tva-wind": zeros("tva-wind"), "tva-solar": zeros("tva-solar") };
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood, now });
    expect(out["tva-solar"].generationProfile).toBeUndefined();
  });

  it("carries the reason without the API key", async () => {
    // Every BA but tva answers with an HTTP error that quotes the keyed URL.
    const leaky = async (config: EiaIsoConfig) => {
      if (config.regionId === "tva") return working(config);
      throw new Error(
        "HTTP 429 Too Many Requests for https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/?api_key=test-dummy-key-0123456789&frequency=hourly",
      );
    };
    const out = await buildEiaVreBasData({ fetchPair: leaky, lastGood: await snapshotFrom(iso(HOUR_MS)), now });
    const noLastGood = await buildEiaVreBasData({ fetchPair: leaky, lastGood: {}, now });

    const published = JSON.stringify([out, noLastGood]) + warned();
    expect(published).not.toContain("test-dummy-key-0123456789");
    expect(out["fpl-solar"].sourceNote).toContain("api_key=REDACTED");
    expect(noLastGood["fpl-solar"].sourceNote).toContain("api_key=REDACTED");
  });

  it("says nothing about fetches that were skipped after a deadline", async () => {
    const skipped = async (config: EiaIsoConfig) => {
      if (config.regionId === "tva") throw new Error("fetch skipped: loader deadline (https://api.eia.gov/v2/x)");
      return working(config);
    };
    await buildEiaVreBasData({ fetchPair: skipped, lastGood: {}, now });
    expect(warned()).not.toContain("tva");
  });
});

describe("a record whose BA fetch failed, with nothing to serve", () => {
  it("publishes records with no generation, marked degraded and of unknown time", async () => {
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: {}, now });

    for (const id of ["tva-wind", "tva-solar"]) {
      const record = out[id];
      expect(record.sourceStatus).toBe("degraded");
      expect(record.lastSuccessAt).toBe(UNKNOWN_TIME);
      expect(record.lastUpdated).toBe(UNKNOWN_TIME);
      // Unknown, not zero: a zero series would claim a measurement of no output.
      expect(record.generationProfile).toBeUndefined();
      expect(record.generationTotalTWh).toBeUndefined();
      expect(isTsoCollected(record)).toBe(false);
      // Waste keeps its meaning for this loader: no figure, so no pillar.
      expect(record.wasteStatus).toBe("unpublished");
      expect(showsWastePillar(record)).toBe(false);
      expect(record.sourceNote).toContain("fetch failed this build (This operation was aborted)");
      expect(record.sourceNote).toContain("no usable earlier copy of this record");
    }
  });

  it("still carries what the dashboard needs of every record", async () => {
    const out = await buildEiaVreBasData({ fetchPair: failing(...BAS.slice(1)), lastGood: {}, now });
    const wanted = REGIONS.filter((r) => ALL_IDS.includes(r.id));
    expect(findRegionDataIntegrityIssues(out, wanted)).toEqual({ missing: [], extra: [], malformed: [], mismatchedId: [] });
    expect(out["fpl-solar"].confidenceTier).toBe("T3-modelled");
  });

  it("is not taken for a last-good copy on the next failure", async () => {
    const first = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: {}, now });
    const second = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: first, now });
    expect(second["tva-solar"].generationProfile).toBeUndefined();
    expect(second["tva-solar"].lastSuccessAt).toBe(UNKNOWN_TIME);
  });
});

describe("when every BA fails", () => {
  it("fails the run, naming the first reason, so a failure is never stored as the new last-good", async () => {
    await expect(
      buildEiaVreBasData({ fetchPair: failing(...BAS), lastGood: await snapshotFrom(iso(HOUR_MS)), now }),
    ).rejects.toThrow("All 18 EIA-930 balancing authorities failed (first error: This operation was aborted)");
  });
});

describe("with the snapshot on disk, as the build runs the loader", () => {
  let cwd: string;
  const snapshotPath = () => join(cwd, "data", "snapshots", "last-good", "eia-vre-bas.json");
  const writeSnapshot = (contents: unknown) => {
    mkdirSync(join(cwd, "data", "snapshots", "last-good"), { recursive: true });
    writeFileSync(snapshotPath(), typeof contents === "string" ? contents : JSON.stringify(contents));
  };

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "elj-eia-vre-bas-"));
    // withFallback and the loader both read and write under process.cwd().
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("keeps a failed BA degraded at its last real time, and stamps the others with this build", async () => {
    const fetchedAt = iso(5 * HOUR_MS);
    writeSnapshot(await snapshotFrom(fetchedAt));

    const out = await loadEiaVreBas({ fetchPair: failing("tva"), now });

    // The bug: withFallback's stampLive turned these into `cached` at NOW.
    for (const id of ["tva-wind", "tva-solar"]) {
      expect(out[id].sourceStatus).toBe("degraded");
      expect(out[id].lastSuccessAt).toBe(fetchedAt);
    }
    for (const id of ALL_IDS.filter((id) => !id.startsWith("tva-"))) {
      expect(out[id].sourceStatus).toBe("cached");
      expect(out[id].lastSuccessAt).toBe(NOW.toISOString());
    }
    expect(JSON.parse(readFileSync(snapshotPath(), "utf8"))).toEqual(out);
  });

  it("does not let a failed BA pass for current when there is no copy either", async () => {
    const out = await loadEiaVreBas({ fetchPair: failing("tva"), now });
    for (const id of ["tva-wind", "tva-solar"]) {
      expect(out[id].sourceStatus).toBe("degraded");
      expect(out[id].lastSuccessAt).toBe(UNKNOWN_TIME);
      expect(out[id].generationProfile).toBeUndefined();
    }
  });

  it("serves the snapshot's copies when every BA fails, and leaves the file as it was", async () => {
    await loadEiaVreBas({ fetchPair: working, now });
    const before = readFileSync(snapshotPath(), "utf8");

    const next = new Date(NOW.getTime() + 3 * HOUR_MS);
    const out = await loadEiaVreBas({ fetchPair: failing(...BAS), now: () => next });

    for (const id of ALL_IDS) {
      expect(out[id].sourceStatus).toBe("degraded");
      expect(out[id].lastSuccessAt).toBe(NOW.toISOString());
      expect(out[id].generationProfile).toBeDefined();
      expect(out[id].sourceNote).toContain("All 18 EIA-930 balancing authorities failed");
    }
    expect(readFileSync(snapshotPath(), "utf8")).toBe(before);
  });

  it("serves no series for a snapshot older than the cap when every BA fails, and leaves the file as it was", async () => {
    writeSnapshot(await snapshotFrom(iso((LAST_GOOD_MAX_AGE_DAYS + 1) * DAY_MS)));
    const before = readFileSync(snapshotPath(), "utf8");

    const out = await loadEiaVreBas({ fetchPair: failing(...BAS), now });

    for (const id of ALL_IDS) {
      expect(out[id].sourceStatus).toBe("degraded");
      expect(out[id].generationProfile).toBeUndefined();
    }
    expect(readFileSync(snapshotPath(), "utf8")).toBe(before);
  });

  it("fails as every loader does when every BA fails and there is no snapshot", async () => {
    await expect(loadEiaVreBas({ fetchPair: failing(...BAS), now })).rejects.toThrow("All 18 EIA-930 balancing authorities failed");
  });

  it("gives a loader that runs past its deadline the same rules, and never labels a copy `cached`", async () => {
    const lastGood = await snapshotFrom(iso(HOUR_MS));
    for (const id of ["tva-wind", "tva-solar"]) lastGood[id].lastSuccessAt = iso((LAST_GOOD_MAX_AGE_DAYS + 1) * DAY_MS);
    writeSnapshot(lastGood);
    const before = readFileSync(snapshotPath(), "utf8");

    const out = await loadEiaVreBas({ fetchPair: () => new Promise<never>(() => {}), now, deadlineMs: 20 });

    // An hour-old copy: withFallback's own age rule would call it `cached`.
    expect(out["fpl-solar"].sourceStatus).toBe("degraded");
    expect(out["fpl-solar"].generationProfile).toEqual(lastGood["fpl-solar"].generationProfile);
    expect(out["fpl-solar"].lastSuccessAt).toBe(iso(HOUR_MS));
    expect(out["fpl-solar"].sourceNote).toContain("the loader ran past its deadline");
    // A copy past the cap is not served here either.
    expect(out["tva-solar"].sourceStatus).toBe("degraded");
    expect(out["tva-solar"].generationProfile).toBeUndefined();
    expect(readFileSync(snapshotPath(), "utf8")).toBe(before);
  });

  it("warns about a snapshot it cannot read and publishes stand-ins", async () => {
    writeSnapshot("<<<<<<< HEAD\n{}");
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), now });
    expect(warned()).toContain("ignoring the last-good snapshot, which cannot be read");
    expect(out["tva-solar"].generationProfile).toBeUndefined();
  });

  it("treats a snapshot that is not an object as empty", async () => {
    writeSnapshot("null");
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), now });
    expect(out["tva-solar"].generationProfile).toBeUndefined();
    expect(out["fpl-solar"].generationProfile).toBeDefined();
  });

  it("does not warn when there is no snapshot", async () => {
    await buildEiaVreBasData({ fetchPair: failing("tva"), now });
    expect(warned()).not.toContain("cannot be read");
  });
});

describe("describeFetchFailure", () => {
  it("redacts the API key wherever it sits in the URL", () => {
    expect(describeFetchFailure(new Error("HTTP 500 for https://x/?api_key=test-dummy-1&a=b"))).toBe(
      "HTTP 500 for https://x/?api_key=REDACTED&a=b",
    );
    expect(describeFetchFailure(new Error("HTTP 500 for https://x/?a=b&API_KEY=test-dummy-2"))).toBe(
      "HTTP 500 for https://x/?a=b&API_KEY=REDACTED",
    );
  });

  it("stays within 200 characters with the key redacted, when the cut falls right after `api_key=`", () => {
    const long = `${"x".repeat(180)} https://x/?api_key=test-dummy-abcdefghijklmnopqrstuvwxyz`;
    const described = describeFetchFailure(new Error(long));
    expect(described).not.toContain("test-dummy");
    expect(described.length).toBeLessThanOrEqual(200);
  });

  it("describes a thrown non-Error", () => {
    expect(describeFetchFailure("boom")).toBe("boom");
  });
});

describe("the committed last-good snapshot", () => {
  // #1053 committed a snapshot of a run with no EIA_API_KEY: 38 of 38 records
  // were failures, stamped as a success. A local build rewrites this file, so a
  // careless `git add` can commit one again. Read in a hook, not at collection,
  // so a missing file fails these tests and not the file's other tests.
  let snapshot: Record<string, RegionData>;

  beforeAll(() => {
    const path = fileURLToPath(new URL("../../data/snapshots/last-good/eia-vre-bas.json", import.meta.url));
    snapshot = JSON.parse(readFileSync(path, "utf8"));
  });

  it("holds a record for each listed BA's wind and solar, and nothing else", () => {
    expect(Object.keys(snapshot).sort()).toEqual([...ALL_IDS].sort());
  });

  it("is a capture from a run that worked, not one that failed", () => {
    for (const [id, record] of Object.entries(snapshot)) {
      expect(record.sourceNote, id).not.toContain("fetch failed");
      expect(record.sourceStatus, id).not.toBe("degraded");
      expect(isTsoCollected(record), `${id} has a series`).toBe(true);
    }
    // Some BAs report no wind or solar, and a BA can have an empty window, but
    // not all of them at once.
    const total = Object.values(snapshot).reduce((sum, r) => sum + (r.generationTotalTWh ?? 0), 0);
    expect(total).toBeGreaterThan(0);
  });
});
