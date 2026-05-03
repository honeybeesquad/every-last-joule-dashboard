import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fetchJSON } from "../lib/fetch.js";

/**
 * Build-time loader: fetches the latest published version of the Every Last
 * Joule dataset from Zenodo via the concept-record endpoint, which always
 * resolves to the most recent version. Used by the dashboard header to keep
 * the displayed version string in sync with Zenodo (so a CITATION.cff bump
 * that has not yet been uploaded to Zenodo is *not* shown — the live site
 * tracks reality, not intent).
 *
 * Fallback order: Zenodo API → CITATION.cff (with a build-log warning).
 */

const CONCEPT_RECORD_ID = "19835411"; // Zenodo concept record (always-latest)
const CONCEPT_DOI = `10.5281/zenodo.${CONCEPT_RECORD_ID}`;
const ZENODO_VERSIONS_LATEST_URL = `https://zenodo.org/api/records/${CONCEPT_RECORD_ID}/versions/latest`;
const CITATION_PATH = join(process.cwd(), "dataset", "CITATION.cff");

export interface ZenodoVersion {
  /** Version string without leading "v" (e.g. "1.1.1"). */
  version: string;
  /** Versioned DOI (e.g. "10.5281/zenodo.19991315") when available, else concept DOI. */
  doi: string;
  /** HTML page for this record on Zenodo. */
  recordUrl: string;
  /** Where this record came from. */
  source: "zenodo" | "citation-cff";
}

interface ZenodoRecord {
  id: number;
  doi: string;
  metadata?: { version?: string };
  links?: { self_html?: string; latest_html?: string };
}

/** Strip a leading "v" or "V" if present. Idempotent. */
export function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v/i, "");
}

export function parseZenodoRecord(rec: ZenodoRecord): ZenodoVersion {
  const rawVersion = rec.metadata?.version;
  if (!rawVersion) {
    throw new Error(`Zenodo record ${rec.id} has no metadata.version`);
  }
  return {
    version: normalizeVersion(rawVersion),
    doi: rec.doi,
    recordUrl: rec.links?.self_html ?? `https://zenodo.org/records/${rec.id}`,
    source: "zenodo",
  };
}

/**
 * Parse a CITATION.cff string for the version + Zenodo archival DOI. Used as
 * an offline fallback when the Zenodo API is unreachable at build time.
 */
export function parseCitationCff(text: string): ZenodoVersion {
  const versionMatch = text.match(/^version:\s*(\S+)/m);
  if (!versionMatch) {
    throw new Error("CITATION.cff has no top-level `version:` field");
  }
  const version = normalizeVersion(versionMatch[1]);

  // Look for the archival (versioned) Zenodo DOI in identifiers; fall back
  // to the concept DOI if not present.
  const archivalDoiMatch = text.match(
    /-\s*type:\s*doi\s*[\r\n]+\s*value:\s*"?(10\.5281\/zenodo\.\d+)"?\s*[\r\n]+\s*description:\s*"Zenodo archival DOI/,
  );
  const doi = archivalDoiMatch?.[1] ?? CONCEPT_DOI;
  return {
    version,
    doi,
    recordUrl: `https://doi.org/${doi}`,
    source: "citation-cff",
  };
}

async function loadFromZenodo(): Promise<ZenodoVersion> {
  const rec = await fetchJSON<ZenodoRecord>(ZENODO_VERSIONS_LATEST_URL);
  return parseZenodoRecord(rec);
}

function loadFromCitationCff(): ZenodoVersion {
  if (!existsSync(CITATION_PATH)) {
    throw new Error(`CITATION.cff not found at ${CITATION_PATH}`);
  }
  return parseCitationCff(readFileSync(CITATION_PATH, "utf8"));
}

async function run(): Promise<ZenodoVersion> {
  try {
    return await loadFromZenodo();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[zenodo-version] live fetch failed (${msg}); falling back to dataset/CITATION.cff`,
    );
    return loadFromCitationCff();
  }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  run()
    .then((data) => {
      process.stdout.write(JSON.stringify(data));
    })
    .catch((err) => {
      console.error("[zenodo-version] all fallbacks failed:", err);
      process.exit(1);
    });
}
