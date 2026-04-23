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
