import { describe, expect, it } from "vitest";
import { parseOnsCurtailmentCsv } from "../../src/data/brazil-ne.json";

describe("brazil-rs ONS routing", () => {
  it("routes Rio Grande do Sul rows to brazil-rs", () => {
    const csv = [
      "id_subsistema;nom_subsistema;id_estado;nom_estado;nom_usina;id_ons;ceg;din_instante;val_geracao;val_geracaolimitada;val_disponibilidade;val_geracaoreferencia;val_geracaoreferenciafinal;cod_razaorestricao;cod_origemrestricao;dsc_restricao",
      "S;SUL;RS;RIO GRANDE DO SUL;PLANT;A;-;2026-03-01 00:00:00;0;2.5;0;0;;;;",
    ].join("\n");
    expect(parseOnsCurtailmentCsv(csv)["brazil-rs"][0].mw).toBe(2.5);
  });
});
