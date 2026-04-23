import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface ProbeResult {
  label: string;
  url: string;
  status: string;
  contentType?: string;
  bytes?: number;
  note?: string;
}

const ERCOT_URLS = [
  ["ERCOT NP6-970 current HTML", "https://www.ercot.com/content/cdr/html/current_np6-970-cd-5min_table.html"],
  ["ERCOT HSL/HDL current HTML", "https://www.ercot.com/content/cdr/html/hb_hsl_curr.html"],
  ["ERCOT NP6-970 product page", "https://www.ercot.com/mp/data-products/data-product-details?id=NP6-970-CD"],
  ["ERCOT market reports directory", "https://www.ercot.com/mktrpt/"],
  ["ERCOT current day wind actual/forecast", "https://www.ercot.com/content/cdr/html/CURRENT_DAYWGRPP.html"],
] as const;

const CHILE_URLS = [
  ["energiaabierta.cl", "https://www.energiaabierta.cl/"],
  ["infotecnica.coordinador.cl", "https://infotecnica.coordinador.cl/"],
  ["api.coordinador.cl", "https://api.coordinador.cl/"],
  ["sic.coordinadorelectrico.cl", "https://sic.coordinadorelectrico.cl/"],
  ["datos.gob.cl", "https://datos.gob.cl/"],
  ["generadoras.cl", "https://www.generadoras.cl/"],
  [
    "Coordinador direct Feb 2026 XLSX",
    "https://www.coordinador.cl/wp-content/uploads/2026/03/Reducciones-de-Energia-Eolica-Solar-Hidro-en-el-SEN_Febrero-26-PE-PFV_Publicar.xlsx",
  ],
] as const;

async function probe(label: string, url: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "*/*",
        "user-agent": "Mozilla/5.0 chile-ercot-csv-spike",
      },
    });
    const bytes = Number(res.headers.get("content-length") ?? 0) || (await res.clone().arrayBuffer()).byteLength;
    const text = (res.headers.get("content-type") ?? "").includes("text") ? await res.text() : "";
    return {
      label,
      url: res.url,
      status: `HTTP ${res.status} ${res.statusText}`,
      contentType: res.headers.get("content-type") ?? undefined,
      bytes,
      note: summarize(label, text),
    };
  } catch (err) {
    return { label, url, status: "ERROR", note: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

function summarize(label: string, text: string): string | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes("just a moment") || lower.includes("incapsula")) return "challenge/WAF page";
  if (label.includes("NP6-970 product") && lower.includes("rtd indicative lmps")) {
    return "reachable, but product is RTD indicative LMPs, not curtailment";
  }
  if (label.includes("wind") && lower.includes("wind power production")) return "reachable wind actual/forecast page";
  return text.replace(/\s+/g, " ").slice(0, 180);
}

async function main() {
  const ercot = await Promise.all(ERCOT_URLS.map(([label, url]) => probe(label, url)));
  const chile = await Promise.all(CHILE_URLS.map(([label, url]) => probe(label, url)));
  const generatedAt = new Date().toISOString();
  const lines = [
    `# Chile/ERCOT CSV Spike Probe`,
    ``,
    `Generated: ${generatedAt}`,
    `Runner: ${process.env.GITHUB_ACTIONS ? "github-actions-ubuntu" : "local"}`,
    ``,
    `## ERCOT`,
    ...ercot.map(formatResult),
    ``,
    `## Chile`,
    ...chile.map(formatResult),
    ``,
  ];
  const dir = join(process.cwd(), "docs", "spikes");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "chile-ercot-csv-probe.md"), lines.join("\n"));
  process.stdout.write(lines.join("\n"));
}

function formatResult(result: ProbeResult): string {
  return `- ${result.label}: ${result.status}; type=${result.contentType ?? "n/a"}; bytes=${result.bytes ?? 0}; url=${result.url}${result.note ? `; note=${result.note}` : ""}`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
