import { describe, expect, it } from "vitest";
import { buildSetupParams, parseSetupParams } from "./useUrlState";

describe("parseSetupParams — links compartidos (P1.2)", () => {
  it("lee un setup completo", () => {
    const setup = parseSetupParams("?finish=blue&sound=ticks&min=45");
    expect(setup).toEqual({
      finish: "blue",
      soundscape: "ticks",
      customMinutes: 45,
      mode: null,
      pomodoroMultiplier: null,
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
      mode: null,
      pomodoroMultiplier: null,
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
      mode: null,
      pomodoroMultiplier: 1,
    });
  });
});

describe("multiplicador del bloque compartido", () => {
  it("acepta cada multiplicador que ofrece la UI", () => {
    for (const multiplier of [1, 2, 3, 4]) {
      expect(parseSetupParams(`?block=${multiplier}`).pomodoroMultiplier).toBe(
        multiplier,
      );
    }
  });

  // Untrusted input: a link must never produce a block the UI cannot offer.
  it.each(["0", "5", "-2", "2.5", "abc", "", "%3Cscript%3E"])(
    "descarta el valor inválido %j",
    (raw) => {
      expect(parseSetupParams(`?block=${raw}`).pomodoroMultiplier).toBeNull();
    },
  );

  it("viaja de ida y vuelta en el link", () => {
    const params = buildSetupParams("black", "focus", 25, "pomodoro", 3);
    expect(parseSetupParams(`?${params.toString()}`)).toEqual({
      finish: "black",
      soundscape: "focus",
      customMinutes: 25,
      mode: "pomodoro",
      pomodoroMultiplier: 3,
    });
  });
});

describe("mode compartido — deep link (Slice B)", () => {
  it("acepta cada modo válido", () => {
    for (const mode of ["five", "ten", "thirty", "sixty", "pomodoro"]) {
      expect(parseSetupParams(`?mode=${mode}`).mode).toBe(mode);
    }
  });

  it("descarta valores desconocidos o maliciosos (entrada no confiable)", () => {
    expect(parseSetupParams("?mode=screen").mode).toBeNull();
    expect(parseSetupParams("?mode=").mode).toBeNull();
    expect(parseSetupParams("?mode=FIVE").mode).toBeNull();
    expect(parseSetupParams("?mode=%3Cscript%3E").mode).toBeNull();
  });

  it("sin mode en la URL no propone nada", () => {
    expect(parseSetupParams("?finish=blue").mode).toBeNull();
  });

  it("buildSetupParams omite mode cuando es null o se omite", () => {
    const withoutArg = buildSetupParams("blue", "ticks", 25);
    const withNull = buildSetupParams("blue", "ticks", 25, null);
    expect(withoutArg.has("mode")).toBe(false);
    expect(withNull.has("mode")).toBe(false);
    expect(withoutArg.toString()).not.toContain("mode=");
  });

  it("buildSetupParams incluye mode cuando se pasa", () => {
    const params = buildSetupParams("blue", "ticks", 25, "pomodoro");
    expect(parseSetupParams(`?${params.toString()}`).mode).toBe("pomodoro");
  });

  it("el modo compartido sobrevive aunque el resto del setup cambie (regresión del efecto de sincronización)", () => {
    // El efecto de sincronización de useUrlState reconstruye la URL en cada
    // cambio del store; si no recibiera el modo actual como argumento en
    // cada llamada, `mode` desaparecería de la URL apenas cambiara el
    // acabado, el sonido o los minutos, rompiendo el re-compartido del link.
    const first = buildSetupParams("black", "off", 25, "pomodoro");
    const second = buildSetupParams("blue", "both", 45, "pomodoro");
    expect(parseSetupParams(`?${first.toString()}`).mode).toBe("pomodoro");
    expect(parseSetupParams(`?${second.toString()}`).mode).toBe("pomodoro");
  });
});
