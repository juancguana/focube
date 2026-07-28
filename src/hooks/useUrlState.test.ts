import { describe, expect, it } from "vitest";
import { buildSetupParams, parseSetupParams } from "./useUrlState";

describe("parseSetupParams — links compartidos (P1.2)", () => {
  it("lee un setup completo", () => {
    const setup = parseSetupParams("?finish=blue&sound=ticks&min=45");
    expect(setup).toEqual({
      finish: "blue",
      soundscape: "ticks",
      customMinutes: 45,
    });
  });

  it("ignora un acabado desconocido", () => {
    expect(parseSetupParams("?finish=gold").finish).toBeNull();
  });

  it("ignora un soundscape desconocido", () => {
    expect(parseSetupParams("?sound=jazz").soundscape).toBeNull();
  });

  it("descarta minutos fuera de rango", () => {
    expect(parseSetupParams("?min=0").customMinutes).toBeNull();
    expect(parseSetupParams("?min=121").customMinutes).toBeNull();
    expect(parseSetupParams("?min=-30").customMinutes).toBeNull();
  });

  it("descarta minutos no enteros o no numéricos", () => {
    expect(parseSetupParams("?min=25.5").customMinutes).toBeNull();
    expect(parseSetupParams("?min=25min").customMinutes).toBeNull();
    expect(parseSetupParams("?min=").customMinutes).toBeNull();
  });

  it("acepta los extremos del rango", () => {
    expect(parseSetupParams("?min=1").customMinutes).toBe(1);
    expect(parseSetupParams("?min=120").customMinutes).toBe(120);
  });

  it("sin parámetros no propone nada", () => {
    expect(parseSetupParams("")).toEqual({
      finish: null,
      soundscape: null,
      customMinutes: null,
    });
  });
});

describe("buildSetupParams", () => {
  it("produce un link que se vuelve a leer igual", () => {
    const params = buildSetupParams("lavender", "both", 15);
    expect(parseSetupParams(`?${params.toString()}`)).toEqual({
      finish: "lavender",
      soundscape: "both",
      customMinutes: 15,
    });
  });
});
