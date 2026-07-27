import { describe, expect, it } from "vitest";
import {
  SOUNDSCAPES,
  STEPS_PER_TICK,
  STEP_SECONDS,
  arpNoteAt,
  isTickStep,
  padRootAt,
  wantsMusic,
  wantsTicks,
} from "./focusAudio";

describe("soundscape modes", () => {
  it("expone las cuatro opciones", () => {
    expect(SOUNDSCAPES.map((option) => option.id)).toEqual([
      "off",
      "ticks",
      "focus",
      "both",
    ]);
  });

  it("resuelve qué capas pide cada modo", () => {
    expect(wantsTicks("ticks")).toBe(true);
    expect(wantsTicks("both")).toBe(true);
    expect(wantsTicks("focus")).toBe(false);
    expect(wantsTicks("off")).toBe(false);

    expect(wantsMusic("focus")).toBe(true);
    expect(wantsMusic("both")).toBe(true);
    expect(wantsMusic("ticks")).toBe(false);
    expect(wantsMusic("off")).toBe(false);
  });
});

describe("clock ticks", () => {
  it("cae exactamente una vez por segundo", () => {
    expect(STEP_SECONDS * STEPS_PER_TICK).toBe(1);
  });

  it("marca sólo los pasos pares", () => {
    expect(isTickStep(0)).toBe(true);
    expect(isTickStep(1)).toBe(false);
    expect(isTickStep(2)).toBe(true);
  });
});

describe("arpegio", () => {
  it("se mantiene dentro de la escala pentatónica", () => {
    const scale = [220, 261.63, 293.66, 329.63, 392];
    const allowed = new Set([...scale, ...scale.map((note) => note * 2)]);

    for (let step = 0; step < 64; step += 1) {
      expect(allowed.has(arpNoteAt(step))).toBe(true);
    }
  });

  it("repite el patrón una octava arriba en el segundo compás", () => {
    expect(arpNoteAt(8)).toBe(arpNoteAt(0) * 2);
    expect(arpNoteAt(16)).toBe(arpNoteAt(0));
  });
});

describe("pad", () => {
  it("cambia de acorde una vez por compás y cicla", () => {
    expect(padRootAt(0)).toBe(padRootAt(7));
    expect(padRootAt(8)).not.toBe(padRootAt(0));
    expect(padRootAt(32)).toBe(padRootAt(0));
  });
});
