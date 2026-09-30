/**
 * src/lib/fetch.ts's per-request timeout. LOADER_FETCH_TIMEOUT_MS=0 used to
 * reach setTimeout(abort, 0), which aborted every request on the default
 * timeout at once. It now means no timeout, as 0 means off for
 * LOADER_DEADLINE_MS and LOADER_HARD_CAP_MS.
 *
 * And the credential in a keyed URL. fetch.ts quotes the request URL in its
 * error messages, and a keyed API takes its credential in the query string
 * (EIA api_key, ENTSO-E securityToken, KPX serviceKey), so those messages
 * reached the public build log and, from the South Korea loader, a served
 * sourceNote. They now carry the URL through redactUrl.
 */
import { createServer, type IncomingMessage, type RequestOptions, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  abortInflightFetches,
  DEFAULT_TIMEOUT_MS,
  fetchBytes,
  fetchHttp1Bytes,
  fetchJSON,
  fetchText,
  redactUrl,
  resetFetchDeadlineForTests,
} from "../src/lib/fetch.js";
import { MAX_TIMER_MS } from "../src/lib/loader-deadline.js";

// fetchHttp1Bytes dials port 443 over TLS and ignores the URL's own port, so a
// local server cannot answer it. Its node:https request is pointed at the local
// server over plain HTTP instead: real sockets, and real status and timeout
// handling, with only TLS left out.
const local = vi.hoisted(() => ({ port: 0 }));
vi.mock("node:https", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:https")>();
  const { request } = await import("node:http");
  return {
    ...actual,
    request: (options: RequestOptions, callback: (res: IncomingMessage) => void) =>
      request({ ...options, hostname: "127.0.0.1", port: local.port, agent: false }, callback),
  };
});

// Dummy credentials, one per keyed API the loaders call.
const EIA_KEY = "test-dummy-eia-key";
const ENTSOE_TOKEN = "test-dummy-entsoe-token";
const KPX_KEY = "test-dummy-kpx-service-key";

let server: Server;
let baseUrl: string;
let slowUrl: string;

beforeAll(async () => {
  // /status/<code> answers at once with that status. Any other path answers
  // after 150 ms: slower than an immediate abort, well inside any real timeout.
  server = createServer((req, res) => {
    const status = /^\/status\/(\d{3})/.exec(req.url ?? "")?.[1];
    if (status) {
      res.statusCode = Number(status);
      res.end("refused");
      return;
    }
    setTimeout(() => res.end("slow but fine"), 150);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  local.port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${local.port}`;
  slowUrl = `${baseUrl}/`;
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

describe("redactUrl", () => {
  const url = (param: string) =>
    `https://api.test/v2/data?frequency=hourly&${param}&facets%5Brespondent%5D%5B%5D=ERCO`;

  it.each(["api_key", "apikey", "securityToken", "serviceKey", "token", "key"])(
    "masks the value of %s and leaves the rest of the URL as it was",
    (name) => {
      expect(redactUrl(url(`${name}=test-dummy-value`))).toBe(url(`${name}=REDACTED`));
    },
  );

  it.each(["API_KEY", "ApiKey", "SECURITYTOKEN", "ServiceKey", "api-key"])(
    "matches %s without regard to case",
    (name) => {
      expect(redactUrl(url(`${name}=test-dummy-value`))).toBe(url(`${name}=REDACTED`));
    },
  );

  it.each(["access_token", "subscription-key", "client_secret", "password"])(
    "masks %s too: a name ending in key, token, secret or password",
    (name) => {
      expect(redactUrl(url(`${name}=test-dummy-value`))).toBe(url(`${name}=REDACTED`));
    },
  );

  it("masks a credential first, last, or among other credentials", () => {
    expect(redactUrl("https://x.test/a?api_key=test-dummy-1&b=2")).toBe("https://x.test/a?api_key=REDACTED&b=2");
    expect(redactUrl("https://x.test/a?b=2&api_key=test-dummy-1")).toBe("https://x.test/a?b=2&api_key=REDACTED");
    expect(redactUrl("https://x.test/a?token=test-dummy-1&b=2&securityToken=test-dummy-2")).toBe(
      "https://x.test/a?token=REDACTED&b=2&securityToken=REDACTED",
    );
  });

  it("masks the whole value, up to the next & or #", () => {
    // data.go.kr service keys are percent-encoded base64, with its = padding.
    expect(redactUrl("https://x.test/a?serviceKey=test-dummy%2Bkey%3D%3D==/x?y&pageNo=1#top")).toBe(
      "https://x.test/a?serviceKey=REDACTED&pageNo=1#top",
    );
    expect(redactUrl("https://x.test/a?b=2&api_key=test-dummy-1#top")).toBe("https://x.test/a?b=2&api_key=REDACTED#top");
    // A space is not a URL character. A value holding one is masked whole, not cut at it.
    expect(redactUrl("https://x.test/a?api_key=test-dummy one two&b=2")).toBe("https://x.test/a?api_key=REDACTED&b=2");
  });

  it("leaves other names, empty values, the path and URLs without a query alone", () => {
    const untouched = [
      "https://x.test/a?keyword=solar&respondent=ERCO&periodStart=202609300000",
      "https://x.test/a?api_key=&b=2",
      "https://x.test/key=abc/token=def",
      "https://x.test/a",
      "",
    ];
    for (const u of untouched) expect(redactUrl(u)).toBe(u);
  });

  it("reads a long run of ? or & in linear time", () => {
    // With ? allowed inside a name, 100,000 of them took seconds: each one started a match that scanned the rest.
    for (const run of ["?", "&"]) {
      const url = `https://x.test/a${run.repeat(100_000)}b`;
      const started = performance.now();
      expect(redactUrl(url)).toBe(url);
      expect(performance.now() - started).toBeLessThan(1000);
    }
  });

  it("is idempotent and takes a URL object", () => {
    const once = redactUrl(`https://x.test/a?api_key=${EIA_KEY}&b=2`);
    expect(redactUrl(once)).toBe(once);
    expect(redactUrl(new URL(`https://x.test/a?securityToken=${ENTSOE_TOKEN}`))).toBe(
      "https://x.test/a?securityToken=REDACTED",
    );
  });
});

/** The Error a call rejects with; the assertions read its message and its stack. */
async function failureOf(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (err) {
    if (err instanceof Error) return err;
    throw err;
  }
  throw new Error("expected the call to reject");
}

describe("error messages quote the URL without its credential", () => {
  it.each([
    ["fetchJSON", fetchJSON],
    ["fetchText", fetchText],
    ["fetchBytes", fetchBytes],
  ])("%s, on an HTTP error", async (_name, fetcher) => {
    const err = await failureOf(
      fetcher(`${baseUrl}/status/403?api_key=${EIA_KEY}&frequency=hourly`, { retries: 0 }),
    );
    expect(err.message).toBe(`HTTP 403 Forbidden for ${baseUrl}/status/403?api_key=REDACTED&frequency=hourly`);
    expect(err.stack).not.toContain(EIA_KEY);
  });

  it("names the last failed attempt, not only the first, once retries are spent", async () => {
    const err = await failureOf(
      fetchJSON(`${baseUrl}/status/500?securityToken=${ENTSOE_TOKEN}`, { retries: 2, backoffBaseMs: 1 }),
    );
    expect(err.message).toBe(`HTTP 500 Internal Server Error for ${baseUrl}/status/500?securityToken=REDACTED`);
  });

  it("fetch skipped, once the loader's deadline has stopped fetching", async () => {
    abortInflightFetches("loader deadline 180s");
    const err = await failureOf(
      fetchJSON(`https://api.entsoe.test/api?securityToken=${ENTSOE_TOKEN}&documentType=A75`),
    );
    expect(err.message).toBe(
      "fetch skipped: loader deadline 180s (https://api.entsoe.test/api?securityToken=REDACTED&documentType=A75)",
    );
    expect(err.stack).not.toContain(ENTSOE_TOKEN);
  });

  describe("fetchHttp1Bytes", () => {
    it("on an HTTP error", async () => {
      const err = await failureOf(
        fetchHttp1Bytes(`https://kpx.test/status/503?serviceKey=${KPX_KEY}&ymd=20260930`, 2000),
      );
      expect(err.message).toBe("HTTP 503 for https://kpx.test/status/503?serviceKey=REDACTED&ymd=20260930");
      expect(err.stack).not.toContain(KPX_KEY);
    });

    it("keeps the 'HTTP 404 ' prefix that isNotFoundError reads", async () => {
      const err = await failureOf(fetchHttp1Bytes(`https://kpx.test/status/404?serviceKey=${KPX_KEY}`, 2000));
      expect(err.message).toBe("HTTP 404 for https://kpx.test/status/404?serviceKey=REDACTED");
    });

    it("on a timeout", async () => {
      const err = await failureOf(fetchHttp1Bytes(`https://kpx.test/slow?serviceKey=${KPX_KEY}`, 40));
      expect(err.message).toBe("timeout after 40ms for https://kpx.test/slow?serviceKey=REDACTED");
      expect(err.stack).not.toContain(KPX_KEY);
    });
  });
});
