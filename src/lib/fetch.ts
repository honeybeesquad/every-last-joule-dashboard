import { request as httpsRequest, type RequestOptions as HttpsRequestOptions } from "node:https";

export interface FetchJSONOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;      // default LOADER_FETCH_TIMEOUT_MS, else 30000
  retries?: number;        // default LOADER_FETCH_RETRIES, else 3
  backoffBaseMs?: number;  // default 1000 (linear backoff)
  method?: string;
  body?: BodyInit | null;
}

/**
 * Build-time knobs. The pre-build runner (scripts/build/prefetch-loaders.ts)
 * sets these lower than the interactive defaults, because every loader has a
 * last-good snapshot to fall back to and a deploy must not wait on a dead
 * upstream: 30 s × 4 attempts per URL is what turned an ENTSO-E stall into a
 * 46-minute failed build (2026-09-10).
 */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
export const DEFAULT_TIMEOUT_MS = () => envInt("LOADER_FETCH_TIMEOUT_MS", 30000);
export const DEFAULT_RETRIES = () => envInt("LOADER_FETCH_RETRIES", 3);

/**
 * Every in-flight fetch registers its AbortController here so that
 * `abortInflightFetches()` — called by withFallback when a loader hits its
 * wall-clock deadline — can stop the sockets immediately instead of letting
 * them run to their own timeouts. Once tripped, new attempts fail fast.
 */
const inflight = new Set<AbortController>();
let deadlineTripped: string | null = null;

export function abortInflightFetches(reason: string): number {
  deadlineTripped = reason;
  const n = inflight.size;
  for (const c of inflight) c.abort();
  inflight.clear();
  return n;
}

/** Test hook: clear the tripped state between cases. */
export function resetFetchDeadlineForTests(): void {
  deadlineTripped = null;
  inflight.clear();
}

async function withRetries<T>(
  url: string,
  opts: FetchJSONOptions,
  read: (res: Response) => Promise<T>,
): Promise<T> {
  const {
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS(),
    retries = DEFAULT_RETRIES(),
    backoffBaseMs = 1000,
    method = "GET",
    body,
  } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (deadlineTripped) throw new Error(`fetch skipped: ${deadlineTripped} (${url})`);
    const controller = new AbortController();
    inflight.add(controller);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers, body, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`.trimEnd());
      const data = await read(res);
      return data;
    } catch (err) {
      lastErr = err;
      if (deadlineTripped) break;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffBaseMs * (attempt + 1)));
      }
    } finally {
      clearTimeout(timer);
      inflight.delete(controller);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Fetch JSON with retries and linear backoff. Throws if all retries fail. */
export async function fetchJSON<T = unknown>(url: string, opts: FetchJSONOptions = {}): Promise<T> {
  return withRetries(url, opts, (res) => res.json() as Promise<T>);
}

/** Fetch CSV/XML/HTML as text with retries. */
export async function fetchText(url: string, opts: FetchJSONOptions = {}): Promise<string> {
  return withRetries(url, opts, (res) => res.text());
}

/**
 * Fetch a URL via `node:https` forcing HTTP/1.1 via ALPN with a browser-style
 * TLS fingerprint. Used for Japanese utility portals that use Scutum WAF or
 * similar that reject Node's default undici/HTTP2 ClientHello.
 *
 * Accepts TLS 1.2 + CHACHA20-first cipher list + http/1.1 ALPN (same profile
 * as curl's default). Returns the response body as `Uint8Array`; non-2xx maps
 * to a thrown Error.
 */
export function fetchHttp1Bytes(url: string, timeoutMs: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts: HttpsRequestOptions & {
      ALPNProtocols?: string[];
      minVersion?: string;
      maxVersion?: string;
      ciphers?: string;
      ecdhCurve?: string;
    } = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: "GET",
      ALPNProtocols: ["http/1.1"],
      minVersion: "TLSv1.2",
      maxVersion: "TLSv1.2",
      ciphers: [
        "ECDHE-ECDSA-CHACHA20-POLY1305",
        "ECDHE-RSA-CHACHA20-POLY1305",
        "ECDHE-ECDSA-AES128-GCM-SHA256",
        "ECDHE-RSA-AES128-GCM-SHA256",
        "ECDHE-ECDSA-AES256-GCM-SHA384",
        "ECDHE-RSA-AES256-GCM-SHA384",
      ].join(":"),
      ecdhCurve: "X25519:prime256v1:secp384r1",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/csv,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: timeoutMs,
    };
    const req = httpsRequest(
      opts,
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode ?? "?"} for ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error(`timeout after ${timeoutMs}ms for ${url}`)));
    req.on("error", reject);
    req.end();
  });
}
