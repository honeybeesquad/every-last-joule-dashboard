import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EIA_VRE_BA_CONFIGS,
  LAST_GOOD_MAX_AGE_DAYS,
  NEVER_FETCHED_AT,
  buildEiaVreBasData,
  describeFetchFailure,
  loadEiaVreBas,
} from "../../src/data/eia-vre-bas.json";
import { parseEiaIsoRegionPerFuel, type EIAResponse, type EiaIsoConfig } from "../../src/lib/eia-iso";
import { findRegionDataIntegrityIssues } from "../../src/lib/region-data-integrity";
import { REGIONS } from "../../src/lib/regions";
import type { RegionData } from "../../src/lib/types";
import { isTsoCollected, showsWastePillar } from "../../src/lib/waste-status";

// The failure these tests pin: on 29 Sep 2026 15 balancing authorities timed
// out and the loader published all 30 of their records as zero-generation,
// `cached`, and stamped with the build time (withFallback stamps a modelled
// record "cached" with `lastSuccessAt` = now). Nothing told them from a BA that
// had worked.

const NOW = new Date("2026-09-30T06:00:00.000Z");
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const iso = (msBeforeNow: number) => new Date(NOW.getTime() - msBeforeNow).toISOString();

const ALL_IDS = EIA_VRE_BA_CONFIGS.flatMap((c) => [`${c.regionId}-wind`, `${c.regionId}-solar`]);

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
  const level = 100 + EIA_VRE_BA_CONFIGS.findIndex((c) => c.regionId === config.regionId) * 10;
  return parseEiaIsoRegionPerFuel(config, eia("WND", config.respondent, level), eia("SUN", config.respondent, level * 2));
}

const failing = (...failed: string[]) => async (config: EiaIsoConfig) => {
  if (failed.includes(config.regionId)) throw new Error("This operation was aborted");
  return working(config);
};

/** What withFallback would have written to last-good after a build at `fetchedAt`. */
async function snapshotFrom(fetchedAt: string): Promise<Record<string, RegionData>> {
  const built = await buildEiaVreBasData({ fetchPair: working, lastGood: {}, now: () => NOW });
  return Object.fromEntries(
    Object.entries(built).map(([id, r]) => [id, { ...r, sourceStatus: "cached" as const, lastSuccessAt: fetchedAt }]),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a BA whose fetch failed, with a last-good copy", () => {
  it("serves the copy as degraded and keeps the time of the fetch that made it", async () => {
    const fetchedAt = iso(3 * HOUR_MS);
    const lastGood = await snapshotFrom(fetchedAt);
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood, now: () => NOW });

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

  it("is degraded at any age, since `cached` already means a record built this run", async () => {
    const lastGood = await snapshotFrom(iso(HOUR_MS));
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood, now: () => NOW });
    expect(out["tva-solar"].sourceStatus).toBe("degraded");
  });

  it("leaves the BAs that worked as this build's records", async () => {
    const lastGood = await snapshotFrom(iso(3 * HOUR_MS));
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood, now: () => NOW });
    const fresh = await buildEiaVreBasData({ fetchPair: working, lastGood: {}, now: () => NOW });
    for (const id of ALL_IDS.filter((id) => !id.startsWith("tva-"))) {
      expect(out[id]).toEqual(fresh[id]);
      expect(out[id].sourceNote).not.toContain("fetch failed");
    }
  });

  it("serves the same copy again after another failure, without stacking notes or refreshing its time", async () => {
    const fetchedAt = iso(6 * HOUR_MS);
    const first = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: await snapshotFrom(fetchedAt), now: () => NOW });
    const later = new Date(NOW.getTime() + 3 * HOUR_MS);
    const second = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: first, now: () => later });

    expect(second["tva-solar"].lastSuccessAt).toBe(fetchedAt);
    expect(second["tva-solar"].generationProfile).toEqual(first["tva-solar"].generationProfile);
    expect(second["tva-solar"].sourceNote?.split("[fetch failed this build")).toHaveLength(2);
  });

  it("stops serving a copy older than the window it summarises", async () => {
    const justInside = await snapshotFrom(iso(LAST_GOOD_MAX_AGE_DAYS * DAY_MS - HOUR_MS));
    const inside = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: justInside, now: () => NOW });
    expect(inside["tva-solar"].generationProfile).toBeDefined();

    const justOutside = await snapshotFrom(iso(LAST_GOOD_MAX_AGE_DAYS * DAY_MS + HOUR_MS));
    const outside = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: justOutside, now: () => NOW });
    expect(outside["tva-solar"].generationProfile).toBeUndefined();
    expect(outside["tva-solar"].lastSuccessAt).toBe(NEVER_FETCHED_AT);
  });

  it("does not serve a copy dated in the future", async () => {
    const lastGood = await snapshotFrom(new Date(NOW.getTime() + 6 * HOUR_MS).toISOString());
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood, now: () => NOW });
    expect(out["tva-solar"].generationProfile).toBeUndefined();
  });

  it("needs a usable copy of both fuels, or serves neither", async () => {
    const lastGood = await snapshotFrom(iso(3 * HOUR_MS));
    delete lastGood["tva-solar"];
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood, now: () => NOW });
    expect(out["tva-wind"].generationProfile).toBeUndefined();
    expect(out["tva-solar"].generationProfile).toBeUndefined();
  });
});

describe("a BA whose fetch failed, with nothing to serve", () => {
  it("publishes records with no generation, marked degraded and never fetched", async () => {
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: {}, now: () => NOW });

    for (const id of ["tva-wind", "tva-solar"]) {
      const record = out[id];
      expect(record.sourceStatus).toBe("degraded");
      expect(record.lastSuccessAt).toBe(NEVER_FETCHED_AT);
      expect(record.lastUpdated).toBe(NEVER_FETCHED_AT);
      // Unknown, not zero: a zero series would claim a measurement of no output.
      expect(record.generationProfile).toBeUndefined();
      expect(record.generationTotalTWh).toBeUndefined();
      expect(isTsoCollected(record)).toBe(false);
      // Waste keeps its meaning for this loader: no figure, so no pillar.
      expect(record.wasteStatus).toBe("unpublished");
      expect(showsWastePillar(record)).toBe(false);
      expect(record.sourceNote).toContain("fetch failed this build (This operation was aborted)");
      expect(record.sourceNote).toContain("no usable earlier copy (none, or older than 30 days)");
    }
  });

  it("still carries what the dashboard needs of every record", async () => {
    const out = await buildEiaVreBasData({ fetchPair: failing(...EIA_VRE_BA_CONFIGS.map((c) => c.regionId)), lastGood: {}, now: () => NOW });
    const wanted = REGIONS.filter((r) => ALL_IDS.includes(r.id));
    expect(findRegionDataIntegrityIssues(out, wanted)).toEqual({ missing: [], extra: [], malformed: [], mismatchedId: [] });
    expect(out["tva-solar"].confidenceTier).toBe("T3-modelled");
  });

  it("is not taken for a last-good copy on the next failure", async () => {
    const first = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: {}, now: () => NOW });
    const second = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood: first, now: () => NOW });
    expect(second["tva-solar"].generationProfile).toBeUndefined();
    expect(second["tva-solar"].lastSuccessAt).toBe(NEVER_FETCHED_AT);
  });

  it("does not serve a zero series that an older run recorded under a failure note", async () => {
    // The shape committed in #1053: every BA failed (no key), and the zeros went
    // into last-good stamped as a success.
    const zeros = (id: string): RegionData => ({
      regionId: id,
      profile: Array(24).fill(0),
      latestProfile: null,
      totalTWh: 0,
      peakGW: 0,
      lastUpdated: iso(2 * HOUR_MS),
      lastSuccessAt: iso(2 * HOUR_MS),
      sourceNote: "EIA-930 TVA generation fetch failed (EIA_API_KEY not set); waste unpublished.",
      sourceStatus: "cached",
      wasteStatus: "unpublished",
      generationProfile: Array(24).fill(0),
      generationTotalTWh: 0,
    });
    const lastGood = { "tva-wind": zeros("tva-wind"), "tva-solar": zeros("tva-solar") };
    const out = await buildEiaVreBasData({ fetchPair: failing("tva"), lastGood, now: () => NOW });
    expect(out["tva-solar"].generationProfile).toBeUndefined();
  });

  it("carries the reason without the API key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const leaky = async () => {
      throw new Error(
        "HTTP 429 Too Many Requests for https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/?api_key=test-dummy-key-0123456789&frequency=hourly",
      );
    };
    const out = await buildEiaVreBasData({ fetchPair: leaky, lastGood: await snapshotFrom(iso(HOUR_MS)), now: () => NOW });
    const noLastGood = await buildEiaVreBasData({ fetchPair: leaky, lastGood: {}, now: () => NOW });

    const published = JSON.stringify([out, noLastGood]) + warn.mock.calls.flat().join("\n");
    expect(published).not.toContain("test-dummy-key-0123456789");
    expect(out["tva-solar"].sourceNote).toContain("api_key=REDACTED");
    expect(noLastGood["tva-solar"].sourceNote).toContain("api_key=REDACTED");
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

  it("redacts before it truncates, so a cut cannot leave part of a key", () => {
    const long = `${"x".repeat(180)} https://x/?api_key=test-dummy-abcdefghijklmnopqrstuvwxyz`;
    const described = describeFetchFailure(new Error(long));
    expect(described).not.toContain("test-dummy");
    expect(described.length).toBeLessThanOrEqual(200);
  });

  it("describes a thrown non-Error", () => {
    expect(describeFetchFailure("boom")).toBe("boom");
  });
});

describe("through withFallback, as the build runs the loader", () => {
  function tmpCwd(): string {
    const dir = mkdtempSync(join(tmpdir(), "elj-eia-vre-bas-"));
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    return dir;
  }
  const snapshotPath = (cwd: string) => join(cwd, "data", "snapshots", "last-good", "eia-vre-bas.json");

  it("keeps a failed BA degraded at its last real time, and stamps the others with this build", async () => {
    const cwd = tmpCwd();
    try {
      const fetchedAt = iso(5 * HOUR_MS);
      mkdirSync(join(cwd, "data", "snapshots", "last-good"), { recursive: true });
      writeFileSync(snapshotPath(cwd), JSON.stringify(await snapshotFrom(fetchedAt)));

      const out = await loadEiaVreBas({ fetchPair: failing("tva"), now: () => NOW });

      // The bug: withFallback's stampLive turned these into `cached` at NOW.
      for (const id of ["tva-wind", "tva-solar"]) {
        expect(out[id].sourceStatus).toBe("degraded");
        expect(out[id].lastSuccessAt).toBe(fetchedAt);
      }
      for (const id of ALL_IDS.filter((id) => !id.startsWith("tva-"))) {
        expect(out[id].sourceStatus).toBe("cached");
        expect(out[id].lastSuccessAt).toBe(NOW.toISOString());
      }
      expect(JSON.parse(readFileSync(snapshotPath(cwd), "utf8"))).toEqual(out);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("does not let a failed BA pass for current when it has no copy either", async () => {
    const cwd = tmpCwd();
    try {
      const out = await loadEiaVreBas({ fetchPair: failing("tva"), now: () => NOW });
      for (const id of ["tva-wind", "tva-solar"]) {
        expect(out[id].sourceStatus).toBe("degraded");
        expect(out[id].lastSuccessAt).toBe(NEVER_FETCHED_AT);
        expect(out[id].generationProfile).toBeUndefined();
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("survives every BA failing on the next build: copies keep their own times", async () => {
    const cwd = tmpCwd();
    try {
      await loadEiaVreBas({ fetchPair: failing(), now: () => NOW });
      const next = new Date(NOW.getTime() + 3 * HOUR_MS);
      const out = await loadEiaVreBas({ fetchPair: failing(...EIA_VRE_BA_CONFIGS.map((c) => c.regionId)), now: () => next });
      for (const id of ALL_IDS) {
        expect(out[id].sourceStatus).toBe("degraded");
        expect(out[id].lastSuccessAt).toBe(NOW.toISOString());
        expect(out[id].generationProfile).toBeDefined();
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("the committed last-good snapshot", () => {
  // #1053 committed a snapshot of a run with no EIA_API_KEY: 38 of 38 records
  // were failures, stamped as a success. withFallback overwrites this file on
  // any local build, so a careless `git add` can commit one again.
  const snapshot = JSON.parse(
    readFileSync(join(process.cwd(), "data", "snapshots", "last-good", "eia-vre-bas.json"), "utf8"),
  ) as Record<string, RegionData>;

  it("holds a record for each listed BA's wind and solar, and nothing else", () => {
    expect(Object.keys(snapshot).sort()).toEqual([...ALL_IDS].sort());
  });

  it("is a capture from a run that worked, not one that failed", () => {
    for (const [id, record] of Object.entries(snapshot)) {
      expect(record.sourceNote, id).not.toContain("fetch failed");
      expect(record.sourceStatus, id).not.toBe("degraded");
      expect(Array.isArray(record.generationProfile) && record.generationProfile.length === 24, `${id} has a series`).toBe(true);
    }
    // A BA can have no wind, or no solar, but not neither.
    for (const config of EIA_VRE_BA_CONFIGS) {
      const total = (snapshot[`${config.regionId}-wind`].generationTotalTWh ?? 0) + (snapshot[`${config.regionId}-solar`].generationTotalTWh ?? 0);
      expect(total, `${config.regionId} generation`).toBeGreaterThan(0);
    }
  });
});
