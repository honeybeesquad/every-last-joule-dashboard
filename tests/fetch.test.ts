/**
 * src/lib/fetch.ts's per-request timeout. LOADER_FETCH_TIMEOUT_MS=0 used to
 * reach setTimeout(abort, 0), which aborted every request on the default
 * timeout at once. It now means no timeout, as 0 means off for
 * LOADER_DEADLINE_MS and LOADER_HARD_CAP_MS.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_TIMEOUT_MS, fetchText, resetFetchDeadlineForTests } from "../src/lib/fetch.js";
import { MAX_TIMER_MS } from "../src/lib/loader-deadline.js";

let server: Server;
let slowUrl: string;

beforeAll(async () => {
  // Answers after 150 ms: slower than an immediate abort, well inside any real timeout.
  server = createServer((_req, res) => {
    setTimeout(() => res.end("slow but fine"), 150);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  slowUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => resetFetchDeadlineForTests());
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("LOADER_FETCH_TIMEOUT_MS", () => {
  it("means no per-request timeout when it is 0", async () => {
    vi.stubEnv("LOADER_FETCH_TIMEOUT_MS", "0");
    expect(DEFAULT_TIMEOUT_MS()).toBe(0);
    await expect(fetchText(slowUrl, { retries: 0 })).resolves.toBe("slow but fine");
  });

  it("still times a request out when it is a number of ms", async () => {
    vi.stubEnv("LOADER_FETCH_TIMEOUT_MS", "50");
    await expect(fetchText(slowUrl, { retries: 0 })).rejects.toThrow(/abort/i);
  });

  it("reads a blank value as unset, and cuts one too long for setTimeout", () => {
    expect(DEFAULT_TIMEOUT_MS()).toBe(30_000);
    vi.stubEnv("LOADER_FETCH_TIMEOUT_MS", " ");
    expect(DEFAULT_TIMEOUT_MS()).toBe(30_000);
    vi.stubEnv("LOADER_FETCH_TIMEOUT_MS", "1e10");
    expect(DEFAULT_TIMEOUT_MS()).toBe(MAX_TIMER_MS);
  });
});

describe("a call's own timeoutMs", () => {
  it("means no timeout when it is 0", async () => {
    await expect(fetchText(slowUrl, { retries: 0, timeoutMs: 0 })).resolves.toBe("slow but fine");
  });

  it("does not fire at once when it is too long for setTimeout", async () => {
    await expect(fetchText(slowUrl, { retries: 0, timeoutMs: 1e10 })).resolves.toBe("slow but fine");
  });
});
