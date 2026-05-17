import { describe, expect, it } from "vitest";
import { parseOnsCurtailmentCsv } from "../../src/data/brazil-ne.json";

describe("brazil-mt ONS routing", () => {
  it("routes Mato Grosso rows to brazil-mt", () => {
    const csv = [
      "id_subsistema;nom_subsistema;id_estado;nom_estado;nom_usina;id_ons;ceg;din_instante;val_geracao;val_geracaolimitada;val_disponibilidade;val_geracaoreferencia;val_geracaoreferenciafinal;cod_razaorestricao;cod_origemrestricao;dsc_restricao",
      "SE;SUDESTE;MT;MATO GROSSO;PLANT;A;-;2026-03-01 00:00:00;0;2.5;0;5;;;;",
    ].join("\n");
    expect(parseOnsCurtailmentCsv(csv)["brazil-mt"][0].mw).toBe(2.5);
  });
});
