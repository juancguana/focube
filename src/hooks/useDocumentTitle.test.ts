import { describe, expect, it } from "vitest";
import { formatTabTitle } from "./useDocumentTitle";

describe("formatTabTitle — tiempo restante en la pestaña (P0.2)", () => {
  it("en reposo muestra solo la marca", () => {
    expect(formatTabTitle(0, null, false, true)).toBe("Focube");
  });

  it("muestra mm:ss y el modo mientras corre", () => {
    expect(formatTabTitle(24 * 60_000 + 59_000, "pomodoro", false, false)).toBe(
      "24:59 · Trabajo — Focube",
    );
    expect(formatTabTitle(5 * 60_000, "countdown", false, false)).toBe(
      "05:00 · Temporizador — Focube",
    );
  });

  it("mantiene el tiempo visible en pausa", () => {
    expect(formatTabTitle(90_000, "countdown", true, false)).toBe(
      "01:30 · En pausa — Focube",
    );
  });

  it("redondea hacia arriba el segundo en curso", () => {
    expect(formatTabTitle(1_200, "countdown", false, false)).toContain("00:02");
  });

  it("nunca muestra tiempo negativo", () => {
    expect(formatTabTitle(-500, "countdown", false, false)).toContain("00:00");
  });

  it("supera los 60 minutos sin romper el formato", () => {
    expect(formatTabTitle(90 * 60_000, "countdown", false, false)).toContain(
      "90:00",
    );
  });
});
