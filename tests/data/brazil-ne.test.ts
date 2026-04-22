import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(
  join(__dirname, "../fixtures/ons-brazil-2026-03.csv"),
  "utf8"
);

let parseOnsCurtailmentCsv: any;

describe("brazil-ne parser", () => {
  beforeAll(async () => {
    const module = await import("../../src/data/brazil-ne.json.js");
    parseOnsCurtailmentCsv = module.parseOnsCurtailmentCsv;
  });

  it("parses the March 2026 CSV into timestamped points", () => {
    const points = parseOnsCurtailmentCsv(csv);
    expect(points.length).toBeGreaterThan(100);
  });

  it("sums val_geracaolimitada across plants per timestamp (unique timestamps)", () => {
    const points = parseOnsCurtailmentCsv(csv);
    const ts = new Set(points.map((p: any) => p.utcTimestamp));
    expect(ts.size).toBe(points.length);
  });

  it("emits UTC ISO timestamps ending in Z", () => {
    const points = parseOnsCurtailmentCsv(csv);
    for (const p of points.slice(0, 10)) {
      expect(p.utcTimestamp).toMatch(/Z$/);
    }
  });

  it("all MW values non-negative", () => {
    const points = parseOnsCurtailmentCsv(csv);
    for (const p of points) expect(p.mw).toBeGreaterThanOrEqual(0);
  });

  it("treats blank curtailed values as zero and converts Brazil local time to UTC", () => {
    const sample = [
      "id_subsistema;nom_subsistema;id_estado;nom_estado;nom_usina;id_ons;ceg;din_instante;val_geracao;val_geracaolimitada;val_disponibilidade;val_geracaoreferencia;val_geracaoreferenciafinal;cod_razaorestricao;cod_origemrestricao;dsc_restricao",
      "N;NORTE;MA;MARANHAO;PLANT A;A;-;2026-03-01 00:00:00;12.757;;389.1;20.721;;;;",
      "N;NORTE;MA;MARANHAO;PLANT B;B;-;2026-03-01 00:00:00;7.593;1.5;386.265;20.27;;;;",
    ].join("\n");
    const points = parseOnsCurtailmentCsv(sample);
    expect(points).toEqual([
      { utcTimestamp: "2026-03-01T03:00:00.000Z", mw: 1.5 },
    ]);
  });

  it("timestamps are chronological", () => {
    const points = parseOnsCurtailmentCsv(csv);
    for (let i = 1; i < points.length; i++) {
      expect(new Date(points[i].utcTimestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(points[i - 1].utcTimestamp).getTime()
      );
    }
  });
});
