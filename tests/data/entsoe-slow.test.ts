/**
 * The ENTSO-E loader when ENTSO-E is slow. 2026-09-29, run 36572293601: zone
 * requests timed out one by one, the loader hit withFallback's 180 s deadline,
 * and withFallback served data/snapshots/last-good/entsoe.json whole: 54 of the
 * 72 zones as June data marked `degraded`, the 18 the snapshot lacks dropped,
 * every zone fetched before the deadline thrown away.
 *
 * These run the loader for real (its 72 zones, withFallback's stamping, the
 * fetch layer's timeouts, retries and aborts) against a stubbed `fetch` and
 * fake timers, with the build prefetch's knobs (15 s per request, one retry).
 * Time is faked, so 180 s of stall costs milliseconds and the timings asserted
 * here are exact. The snapshot is a temp directory: nothing here reads or
 * writes data/snapshots except the last test, which only reads.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { collectEntsoeZones, loadEntsoe, ZONES } from "../../src/data/entsoe.json";
import { resetFetchDeadlineForTests } from "../../src/lib/fetch";
import type { RegionData } from "../../src/lib/types";

const GERMANY_XML = readFileSync(join(__dirname, "../fixtures/entsoe-germany-7d.xml"), "utf8");
// What ENTSO-E answers, with HTTP 200, when a zone has no data in the window.
const NO_DATA_XML =
  '<?xml version="1.0" encoding="UTF-8"?><Acknowledgement_MarketDocument xmlns="urn:iec62325.351:tc57wg16:451-1:acknowledgementdocument:7:0">' +
  "<Reason><code>999</code><text>No matching data found</text></Reason></Acknowledgement_MarketDocument>";

const INCIDENT = new Date("2026-09-29T13:02:57.000Z"); // when the refresh started
const JUNE = "2026-06-17T04:11:31.459Z"; // when every zone in the committed snapshot last succeeded
const LAST_GOOD_TWH = 1.5; // a value no fetch of the fixture produces

// `slow:<ms>` answers like "fast", after that long, unless the request is aborted first.
type Behaviour = "fast" | "hang" | "empty" | "http500" | `slow:${number}`;
type Zone = (typeof ZONES)[number];

const key = (domain: string, psrType: string) => `${domain}|${psrType}`;
const isAllowEmpty = (z: Zone) => "allowEmpty" in z && z.allowEmpty;
const withTechnologies = (z: Zone) => z.technologies.length > 0;

function lastGood(id: string, lastSuccessAt = JUNE): RegionData {
  return {
    regionId: id,
    profile: Array(24).fill(0.1),
    latestProfile: null,
    totalTWh: LAST_GOOD_TWH,
    peakGW: 0.2,
    lastUpdated: lastSuccessAt,
    lastSuccessAt,
    sourceNote: `last-good ${id}`,
    sourceStatus: "live",
    generationProfile: Array(24).fill(1),
    generationTotalTWh: 10,
  };
}

describe("the ENTSO-E loader when ENTSO-E is slow", () => {
  let root: string;
  let behaviours: Map<string, Behaviour>;
  let requests: { domain: string; psrType: string; at: number }[];
  let warned: string[]; // what the loader wrote to console.warn and console.error, a line per call
  let errored: string[];
  const said = (...lines: string[][]) => lines.flat().join("\n");

  /** Every technology of the zones `pick` selects behaves as `how`; the rest answer fast. */
  const setBehaviour = (how: Behaviour, pick: (z: Zone, i: number) => boolean) => {
    ZONES.forEach((z, i) => {
      if (!pick(z, i)) return;
      for (const t of z.technologies) behaviours.set(key(z.domain, t.psrType), how);
    });
  };
  const byId = (...ids: string[]) => (z: Zone) => ids.includes(z.id);

  const writeSnapshot = (records: Record<string, RegionData>) => {
    const dir = join(root, "data", "snapshots", "last-good");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "entsoe.json"), JSON.stringify(records));
  };
  /** The committed snapshot's shape: every zone that is not allowEmpty, June. */
  const junesSnapshot = () =>
    Object.fromEntries(ZONES.filter((z) => !isAllowEmpty(z)).map((z) => [z.id, lastGood(z.id)]));

  /** Starts the loader at INCIDENT and lets `ms` of fake time pass. */
  async function runFor(ms: number, load: () => Promise<Record<string, RegionData>> = loadEntsoe) {
    const started = Date.now();
    let finishedAt: number | undefined;
    const done = load().then((r) => {
      finishedAt = Date.now();
      return r;
    });
    done.catch(() => {}); // a rejection is asserted by the caller, not reported as unhandled meanwhile
    await vi.advanceTimersByTimeAsync(ms);
    return { done, started, elapsed: () => (finishedAt === undefined ? undefined : finishedAt - started) };
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "elj-entsoe-slow-"));
    vi.spyOn(process, "cwd").mockReturnValue(root);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(INCIDENT);
    vi.stubEnv("ENTSOE_API_TOKEN", "test-dummy-token");
    // The build prefetch's knobs, which the incident ran under.
    vi.stubEnv("LOADER_DEADLINE_MS", "180000");
    vi.stubEnv("LOADER_FETCH_TIMEOUT_MS", "15000");
    vi.stubEnv("LOADER_FETCH_RETRIES", "1");
    vi.stubEnv("ENTSOE_ZONE_CONCURRENCY", "6");
    resetFetchDeadlineForTests();

    behaviours = new Map();
    requests = [];
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const params = new URL(String(input)).searchParams;
      const domain = params.get("in_Domain") ?? "";
      const psrType = params.get("psrType") ?? "";
      requests.push({ domain, psrType, at: Date.now() });
      const how = behaviours.get(key(domain, psrType)) ?? "fast";
      if (how === "fast") return Promise.resolve(new Response(GERMANY_XML));
      if (how === "empty") return Promise.resolve(new Response(NO_DATA_XML));
      if (how === "http500") {
        return Promise.resolve(new Response("upstream error", { status: 500, statusText: "Internal Server Error" }));
      }
      // Like a real fetch, "hang" never answers and "slow" answers late; both reject when the signal aborts.
      return new Promise<Response>((resolve, reject) => {
        const timer = how === "hang" ? undefined : setTimeout(() => resolve(new Response(GERMANY_XML)), Number(how.slice("slow:".length)));
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException("This operation was aborted", "AbortError"));
        };
        if (init?.signal?.aborted) return abort();
        init?.signal?.addEventListener("abort", abort, { once: true });
      });
    });
    warned = [];
    errored = [];
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => void warned.push(args.map(String).join(" ")));
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => void errored.push(args.map(String).join(" ")));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetFetchDeadlineForTests();
    rmSync(root, { recursive: true, force: true });
  });

  it("gives every zone a distinct request, so the scenarios below can tell them apart", () => {
    const keys = ZONES.flatMap((z) => z.technologies.map((t) => key(z.domain, t.psrType)));
    expect(new Set(keys).size).toBe(keys.length);
  });

  describe("the 29 Sep incident: ENTSO-E stops answering after the first ten zones", () => {
    const FRESH = 10;
    const isFresh = (z: Zone) => ZONES.indexOf(z) < FRESH;

    it("returns at 90% of its budget, before the deadline, with a record for every zone", async () => {
      writeSnapshot(junesSnapshot());
      setBehaviour("hang", (_z, i) => i >= FRESH);

      const run = await runFor(181_000);
      const result = await run.done;

      // Stopped by its own budget, not by the deadline.
      expect(run.elapsed()).toBe(162_000);
      expect(said(errored)).toMatch(/ENTSO-E stopped at 162s of its 180s budget/);
      expect(said(errored)).not.toMatch(/live fetch failed/);

      // One record per zone: the 18 the snapshot lacks are not dropped.
      expect(Object.keys(result).sort()).toEqual(ZONES.map((z) => z.id).sort());
    });

    it("keeps the zones it fetched before the stop, live and current", async () => {
      writeSnapshot(junesSnapshot());
      setBehaviour("hang", (_z, i) => i >= FRESH);

      const result = await (await runFor(181_000)).done;

      for (const zone of ZONES.filter(isFresh)) {
        const r = result[zone.id];
        expect(r.sourceStatus, zone.id).toBe("live");
        expect(r.lastSuccessAt, zone.id).toBe(INCIDENT.toISOString());
        expect(r.totalTWh, zone.id).not.toBe(LAST_GOOD_TWH); // fetched, not the snapshot's
      }
    });

    it("keeps the other zones' last-good records, labelled by their age", async () => {
      writeSnapshot(junesSnapshot());
      setBehaviour("hang", (_z, i) => i >= FRESH);

      const result = await (await runFor(181_000)).done;

      const stale = ZONES.filter((z) => !isFresh(z) && !isAllowEmpty(z) && withTechnologies(z));
      expect(stale.length).toBeGreaterThan(20);
      for (const zone of stale) {
        const r = result[zone.id];
        // June is 104 days old: degraded, and still June, not restamped as fresh.
        expect(r.sourceStatus, zone.id).toBe("degraded");
        expect(r.lastSuccessAt, zone.id).toBe(JUNE);
        expect(r.totalTWh, zone.id).toBe(LAST_GOOD_TWH);
      }
    });

    it("labels a last-good record under 24 h old cached, not degraded", async () => {
      const yesterdayEvening = "2026-09-29T02:00:00.000Z"; // 11 h before the run
      writeSnapshot(Object.fromEntries(ZONES.filter((z) => !isAllowEmpty(z)).map((z) => [z.id, lastGood(z.id, yesterdayEvening)])));
      setBehaviour("hang", (_z, i) => i >= FRESH);

      const result = await (await runFor(181_000)).done;

      const stale = ZONES.filter((z) => !isFresh(z) && !isAllowEmpty(z) && withTechnologies(z));
      for (const zone of stale) {
        expect(result[zone.id].sourceStatus, zone.id).toBe("cached");
        expect(result[zone.id].lastSuccessAt, zone.id).toBe(yesterdayEvening);
      }
    });

    it("keeps the 18 zones the snapshot lacks as unpublished markers that say they were not fetched", async () => {
      writeSnapshot(junesSnapshot());
      setBehaviour("hang", (_z, i) => i >= FRESH);

      const result = await (await runFor(181_000)).done;

      const markers = ZONES.filter(isAllowEmpty);
      expect(markers).toHaveLength(18);
      for (const zone of markers) {
        const r = result[zone.id];
        expect(r, zone.id).toBeDefined();
        expect(r.wasteStatus, zone.id).toBe("unpublished");
        expect(r.totalTWh, zone.id).toBe(0);
        expect(r.generationTotalTWh, zone.id).toBe(0);
        // Never "live": nothing was fetched. Never a claim that ENTSO-E's answer was empty.
        expect(r.sourceStatus, zone.id).not.toBe("live");
        expect(r.sourceNote, zone.id).toMatch(/not fetched before the loader's time budget ran out/);
        expect(r.sourceNote, zone.id).not.toMatch(/empty in-window/);
      }
    });

    it("starts no request after the stop, and leaves none open", async () => {
      writeSnapshot(junesSnapshot());
      setBehaviour("hang", (_z, i) => i >= FRESH);

      const run = await runFor(181_000);
      await run.done;

      const stopAt = run.started + 162_000;
      expect(requests.filter((r) => r.at > stopAt)).toEqual([]);
      // The zones at the end of the list were never reached.
      const reached = new Set(requests.map((r) => key(r.domain, r.psrType)));
      for (const zone of ZONES.filter(isAllowEmpty)) {
        for (const t of zone.technologies) expect(reached.has(key(zone.domain, t.psrType)), zone.id).toBe(false);
      }
      // Nothing left waiting on the fake clock: no timer keeps the loader's process alive.
      expect(vi.getTimerCount()).toBe(0);
    });

    it("persists what it returned as the new last-good snapshot, all 72 zones", async () => {
      writeSnapshot(junesSnapshot());
      setBehaviour("hang", (_z, i) => i >= FRESH);

      await (await runFor(181_000)).done;

      const written = JSON.parse(readFileSync(join(root, "data", "snapshots", "last-good", "entsoe.json"), "utf8"));
      expect(Object.keys(written)).toHaveLength(ZONES.length);
    });
  });

  describe("without a stall", () => {
    it("fetches every zone and stops nothing when ENTSO-E answers at once", async () => {
      writeSnapshot(junesSnapshot());

      const run = await runFor(1_000);
      const result = await run.done;

      expect(run.elapsed()).toBe(0);
      expect(requests.length).toBeGreaterThanOrEqual(ZONES.filter(withTechnologies).length);
      for (const zone of ZONES.filter(withTechnologies)) {
        expect(result[zone.id].sourceStatus, zone.id).not.toBe("degraded");
      }
      expect(said(errored)).not.toMatch(/stopped at/);
    });

    it("does not stop a slow run that finishes inside its budget", async () => {
      writeSnapshot(junesSnapshot());
      // Every answer takes 8 s: 70 zones, six at a time, 12 rounds, about 96 s.
      setBehaviour("slow:8000", () => true);

      const run = await runFor(181_000);
      const result = await run.done;

      expect(run.elapsed()).toBeGreaterThan(60_000);
      expect(run.elapsed()).toBeLessThan(162_000);
      // The 18 allowEmpty zones are estimated-tier, which withFallback stamps cached, never live.
      for (const zone of ZONES.filter((z) => withTechnologies(z) && !isAllowEmpty(z))) {
        expect(result[zone.id].sourceStatus, zone.id).toBe("live");
      }
      for (const zone of ZONES.filter(isAllowEmpty)) {
        expect(result[zone.id].sourceStatus, zone.id).toBe("cached");
        expect(result[zone.id].generationTotalTWh, zone.id).toBeGreaterThan(0); // fetched, not a marker
      }
      expect(said(errored)).not.toMatch(/stopped at/);
    });

    // One answer that takes 200 s, past a stop at 162 s and the deadline at 180 s.
    // Requests are allowed 1000 s so that only the loader's own budget can end it.
    const oneAnswerAt200s = () => {
      vi.stubEnv("LOADER_FETCH_TIMEOUT_MS", "1000000");
      setBehaviour("slow:200000", byId("spain-wind"));
    };

    it("stops at 90% of its budget for a zone that would answer after it", async () => {
      writeSnapshot(junesSnapshot());
      oneAnswerAt200s();

      const run = await runFor(300_000);
      const result = await run.done;

      expect(run.elapsed()).toBe(162_000);
      expect(result["spain-wind"].sourceStatus).toBe("degraded");
      expect(result["spain-wind"].totalTWh).toBe(LAST_GOOD_TWH);
      expect(result["spain-solar"].sourceStatus).toBe("live"); // the other zones answered at once
    });

    it("has no stop and no deadline when LOADER_DEADLINE_MS is 0", async () => {
      vi.stubEnv("LOADER_DEADLINE_MS", "0");
      writeSnapshot(junesSnapshot());
      oneAnswerAt200s();

      const run = await runFor(300_000);
      const result = await run.done;

      expect(run.elapsed()).toBe(200_000);
      expect(result["spain-wind"].sourceStatus).toBe("live");
      expect(result["spain-wind"].totalTWh).not.toBe(LAST_GOOD_TWH);
      expect(said(errored)).not.toMatch(/stopped at/);
    });
  });

  describe("a failed request is not an empty answer", () => {
    it("falls a two-technology zone back on its last-good record when one technology's request fails", async () => {
      // 29 Sep 13:04:55: netherlands-wind's B18 timed out while its B19 answered,
      // and the zone went out live from B19 alone.
      writeSnapshot(junesSnapshot());
      behaviours.set(key("10YNL----------L", "B18"), "hang");

      const result = await (await runFor(60_000)).done;

      expect(result["netherlands-wind"].sourceStatus).toBe("degraded");
      expect(result["netherlands-wind"].totalTWh).toBe(LAST_GOOD_TWH);
      expect(result["netherlands-solar"].sourceStatus).toBe("live"); // its neighbour is unaffected
    });

    it("keeps an allowEmpty zone's last-good record when its requests fail, not an empty one", async () => {
      writeSnapshot({ ...junesSnapshot(), "austria-wind": lastGood("austria-wind") });
      setBehaviour("http500", byId("austria-wind"));

      const result = await (await runFor(60_000)).done;

      expect(result["austria-wind"].totalTWh).toBe(LAST_GOOD_TWH);
      expect(result["austria-wind"].generationTotalTWh).toBe(10);
      expect(result["austria-wind"].sourceStatus).toBe("degraded");
    });

    it("makes an allowEmpty zone with no last-good record a marker that says the fetch failed", async () => {
      writeSnapshot(junesSnapshot());
      setBehaviour("http500", byId("malta"));

      const result = await (await runFor(60_000)).done;

      expect(result.malta.wasteStatus).toBe("unpublished");
      expect(result.malta.sourceNote).toMatch(/fetch failed with no last-good cache/);
      expect(result.malta.sourceNote).not.toMatch(/empty in-window/);
    });

    it("still takes ENTSO-E's own 'no data' answer as an empty record, not a failure", async () => {
      writeSnapshot(junesSnapshot());
      setBehaviour("empty", byId("kosovo-wind"));

      const result = await (await runFor(60_000)).done;

      expect(result["kosovo-wind"].wasteStatus).toBe("unpublished");
      expect(result["kosovo-wind"].sourceNote).toMatch(/A75 empty in-window/);
      expect(said(warned)).not.toMatch(/zone kosovo-wind failed/);
    });

    it("never writes the API token into a failure message", async () => {
      writeSnapshot(junesSnapshot());
      setBehaviour("http500", byId("spain-wind"));

      await (await runFor(60_000)).done;

      const logged = said(warned, errored);
      expect(logged).toMatch(/zone spain-wind failed: ENTSO-E spain-wind: B19 request failed: HTTP 500/);
      expect(logged).not.toContain("test-dummy-token");
      expect(logged).toContain("securityToken=[REDACTED]");
    });
  });

  describe("when nothing answers, or nothing can be served", () => {
    it("serves every last-good record and marker when no zone answers, and says so", async () => {
      writeSnapshot(junesSnapshot());
      setBehaviour("http500", () => true);

      const result = await (await runFor(120_000)).done;

      expect(Object.keys(result)).toHaveLength(ZONES.length);
      for (const zone of ZONES.filter((z) => !isAllowEmpty(z) && withTechnologies(z))) {
        expect(result[zone.id].sourceStatus, zone.id).toBe("degraded");
      }
      for (const zone of ZONES.filter(isAllowEmpty)) expect(result[zone.id].wasteStatus, zone.id).toBe("unpublished");
      expect(said(errored)).toMatch(/ENTSO-E answered no zone/);
    });

    it("serves the snapshot whole, with no request, when the token is missing", async () => {
      vi.stubEnv("ENTSOE_API_TOKEN", "");
      writeSnapshot(junesSnapshot());

      const result = await (await runFor(1_000)).done;

      expect(requests).toEqual([]);
      expect(Object.keys(result)).toHaveLength(Object.keys(junesSnapshot()).length);
      expect(result["spain-wind"].sourceStatus).toBe("degraded");
    });

    it("still fails the loader when a zone that must have a last-good record has none", async () => {
      const snapshot = junesSnapshot();
      delete snapshot["spain-solar"];
      writeSnapshot(snapshot);
      setBehaviour("http500", byId("spain-solar"));

      const run = await runFor(60_000, collectEntsoeZones);

      await expect(run.done).rejects.toThrow(/spain-solar failed and no cached data available/);
    });
  });
});

describe("the committed last-good snapshot", () => {
  it("has a record for every zone that is not allowEmpty", () => {
    // collectEntsoeZones fails the loader on a zone with no last-good record
    // that is not allowEmpty, and withFallback then serves the snapshot whole,
    // dropping every zone it lacks: the 29 Sep incident again. A new zone needs
    // allowEmpty (its A75 may be empty and its waste is unpublished), or a
    // last-good record, which is a data PR of its own: read "Gate hazard
    // confirmed" in STATUS.md first, because these files feed ci:magnitude-golden.
    const snapshot = JSON.parse(
      readFileSync(join(__dirname, "../../data/snapshots/last-good/entsoe.json"), "utf8"),
    ) as Record<string, RegionData>;
    const missing = ZONES.filter((z) => !isAllowEmpty(z) && !(z.id in snapshot)).map((z) => z.id);
    expect(missing).toEqual([]);
  });
});
