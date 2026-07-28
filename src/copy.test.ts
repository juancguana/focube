import { describe, expect, it } from "vitest";
import { copy } from "./copy";

describe("copy.ts — string centralization", () => {
  it("tiene todas las categorías principales", () => {
    expect(copy).toHaveProperty("hero");
    expect(copy).toHaveProperty("states");
    expect(copy).toHaveProperty("timer");
    expect(copy).toHaveProperty("controls");
    expect(copy).toHaveProperty("onboarding");
    expect(copy).toHaveProperty("aria");
    expect(copy).toHaveProperty("notifications");
    expect(copy).toHaveProperty("panel");
    expect(copy).toHaveProperty("chips");
    expect(copy).toHaveProperty("brand");
  });

  it("no contiene formas de 'tú' (gira, suelta, arrastra, usa, haz)", () => {
    const allText = JSON.stringify(copy);
    const tuForms = ["gira ", " suelta ", " arrastra ", " usa ", " haz "];
    for (const form of tuForms) {
      expect(allText.toLowerCase()).not.toContain(form);
    }
  });

  it("usa voseo en textos clave (girá, soltá)", () => {
    const allText = JSON.stringify(copy);
    expect(allText.toLowerCase()).toContain("girá");
    expect(allText.toLowerCase()).toContain("soltá");
  });

  it("hero.title es el esperado", () => {
    expect(copy.hero.title).toBe("Girá el cubo. El tiempo arranca solo.");
  });

  it("timer.pomodoroStart genera string con ciclo", () => {
    const msg = copy.timer.pomodoroStart(1, 4);
    expect(msg).toContain("1");
    expect(msg).toContain("4");
    expect(msg).toContain("concentrarse");
  });

  it("timer.customStarted incluye los minutos", () => {
    const msg = copy.timer.customStarted(25);
    expect(msg).toContain("25");
  });

  it("notifications.timerComplete incluye modo y minutos", () => {
    const msg = copy.notifications.timerComplete("Trabajo", 25);
    expect(msg).toContain("25");
    expect(msg).toContain("Trabajo");
  });

  it("controls.addAlarm muestra contador", () => {
    const msg = copy.controls.addAlarm(1, 3);
    expect(msg).toContain("1");
    expect(msg).toContain("3");
  });

  it("panel.customRange incluye min/max", () => {
    const msg = copy.panel.customRange(1, 99);
    expect(msg).toContain("1");
    expect(msg).toContain("99");
  });
});
