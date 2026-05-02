import { request as httpsRequest, type RequestOptions as HttpsRequestOptions } from "node:https";

export interface FetchJSONOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;      // default 30000
  retries?: number;        // default 3
  backoffBaseMs?: number;  // default 1000 (linear backoff)
  method?: string;
  body?: BodyInit | null;
}

/** Fetch JSON with 3 retries and linear backoff. Throws if all retries fail. */
export async function fetchJSON<T = unknown>(
  url: string,
  opts: FetchJSONOptions = {}
): Promise<T> {
  const {
    headers = {},
    timeoutMs = 30000,
    retries = 3,
    backoffBaseMs = 1000,
    method = "GET",
    body
  } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers, body, signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      }
      const data = (await res.json()) as T;
      clearTimeout(timer);
      return data;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, backoffBaseMs * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Fetch CSV as text with retries. */
export async function fetchText(
  url: string,
  opts: FetchJSONOptions = {}
): Promise<string> {
  const {
    headers = {},
    timeoutMs = 30000,
    retries = 3,
    backoffBaseMs = 1000,
    method = "GET",
    body
  } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers, body, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const text = await res.text();
      clearTimeout(timer);
      return text;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, backoffBaseMs * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
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
