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

  it("parses the March 2026 CSV into clustered regional point series", () => {
    const points = parseOnsCurtailmentCsv(csv);
    expect(points["brazil-rn"].length).toBeGreaterThan(100);
  });

  it("keeps unique timestamps within each regional cluster", () => {
    const points = parseOnsCurtailmentCsv(csv);
    for (const regionPoints of Object.values(points) as Array<Array<any>>) {
      const ts = new Set(regionPoints.map((p: any) => p.utcTimestamp));
      expect(ts.size).toBe(regionPoints.length);
    }
  });

  it("emits UTC ISO timestamps ending in Z", () => {
    const points = parseOnsCurtailmentCsv(csv);
    for (const p of points["brazil-rn"].slice(0, 10)) {
      expect(p.utcTimestamp).toMatch(/Z$/);
    }
  });

  it("all MW values non-negative", () => {
    const points = parseOnsCurtailmentCsv(csv);
    for (const regionPoints of Object.values(points) as Array<Array<any>>) {
      for (const p of regionPoints) expect(p.mw).toBeGreaterThanOrEqual(0);
    }
  });

  it("treats blank curtailed values as zero and converts Brazil local time to UTC", () => {
    const sample = [
      "id_subsistema;nom_subsistema;id_estado;nom_estado;nom_usina;id_ons;ceg;din_instante;val_geracao;val_geracaolimitada;val_disponibilidade;val_geracaoreferencia;val_geracaoreferenciafinal;cod_razaorestricao;cod_origemrestricao;dsc_restricao",
      "N;NORTE;MA;MARANHAO;PLANT A;A;-;2026-03-01 00:00:00;12.757;;389.1;20.721;;;;",
      "N;NORTE;MA;MARANHAO;PLANT B;B;-;2026-03-01 00:00:00;7.593;1.5;386.265;20.27;;;;",
    ].join("\n");
    const points = parseOnsCurtailmentCsv(sample);
    expect(points["brazil-maranhao"]).toEqual([{ utcTimestamp: "2026-03-01T03:00:00.000Z", mw: 1.5 }]);
  });

  it("breaks out Paraiba and Maranhao from the residual ONS bucket", () => {
    const sample = [
      "id_subsistema;nom_subsistema;id_estado;nom_estado;nom_usina;id_ons;ceg;din_instante;val_geracao;val_geracaolimitada;val_disponibilidade;val_geracaoreferencia;val_geracaoreferenciafinal;cod_razaorestricao;cod_origemrestricao;dsc_restricao",
      "NE;NORDESTE;PB;PARAIBA;PLANT PB;A;-;2026-03-01 00:00:00;12;2.5;389.1;20.721;;;;",
      "N;NORTE;MA;MARANHAO;PLANT MA;B;-;2026-03-01 00:00:00;7;1.5;386.265;20.27;;;;",
      "S;SUL;SC;SANTA CATARINA;PLANT SC;C;-;2026-03-01 00:00:00;3;0.5;100;4;;;;",
    ].join("\n");
    const points = parseOnsCurtailmentCsv(sample);
    expect(points["brazil-paraiba"]).toEqual([{ utcTimestamp: "2026-03-01T03:00:00.000Z", mw: 2.5 }]);
    expect(points["brazil-maranhao"]).toEqual([{ utcTimestamp: "2026-03-01T03:00:00.000Z", mw: 1.5 }]);
    expect(points["brazil-other"]).toEqual([{ utcTimestamp: "2026-03-01T03:00:00.000Z", mw: 0.5 }]);
  });

  it("timestamps are chronological within each cluster", () => {
    const points = parseOnsCurtailmentCsv(csv);
    for (const regionPoints of Object.values(points) as Array<Array<any>>) {
      for (let i = 1; i < regionPoints.length; i++) {
        expect(new Date(regionPoints[i].utcTimestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(regionPoints[i - 1].utcTimestamp).getTime()
        );
      }
    }
  });
});
