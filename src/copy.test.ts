import { describe, expect, it } from "vitest";
import { copy } from "./copy";

/** Every leaf string, with functions resolved using sample arguments. */
function collectStrings(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (typeof node === "function") {
    // Every copy function takes numbers and/or strings; both sample sets are
    // safe because the arguments are only interpolated, never inspected.
    const fn = node as (...args: unknown[]) => string;
    const samples = [
      fn(1, 4),
      fn("5 min", "Trabajo"),
      fn(25),
      fn("10:30"),
    ].filter((value): value is string => typeof value === "string");
    return samples;
  }
  if (node && typeof node === "object") {
    return Object.values(node).flatMap(collectStrings);
  }
  return [];
}

const allStrings = collectStrings(copy);
const allText = allStrings.join(" | ").toLowerCase();

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
    expect(copy).toHaveProperty("title");
    expect(copy).toHaveProperty("brand");
  });
});

describe("copy.ts — canal de feedback público", () => {
  it("links.feedback apunta a GitHub Issues, sin mailto", () => {
    expect(copy.links.feedback).toMatch(/^https:\/\//);
    expect(copy.links.feedback).not.toContain("mailto:");
  });
});

describe("copy.ts — tarjeta de vista previa social (og)", () => {
  it("og expone title, description e imageAlt como texto no vacío", () => {
    expect(copy.og.title.length).toBeGreaterThan(0);
    expect(copy.og.description.length).toBeGreaterThan(0);
    expect(copy.og.imageAlt.length).toBeGreaterThan(0);
  });
});

describe("copy.ts — registro neutro latinoamericano", () => {
  /**
   * Voseo markers: imperatives and present forms stressed on the last
   * syllable. Any of these means the register slipped back to Rioplatense.
   */
  const voseoForms = [
    "girá",
    "soltá",
    "arrastrá",
    "usá",
    "hacé",
    "poné",
    "probá",
    "contanos",
    "cerrá",
    "tocá",
    "seguís",
    "necesitás",
    "querés",
    "respirá",
    "pausá",
    "vos ",
    " vos",
  ];

  it.each(voseoForms)("no usa la forma voseante %s", (form) => {
    expect(allText).not.toContain(form);
  });

  it("usa imperativos en tú en los textos clave", () => {
    expect(copy.hero.title).toContain("Gira");
    expect(copy.hero.subtitle).toContain("suelta");
    expect(copy.onboarding.hint).toContain("Gira");
    expect(copy.onboarding.cta).toContain("Prueba");
  });

  it("no deja jerga técnica de cara al usuario", () => {
    for (const term of ["countdown", "toggle", "display", "led"]) {
      expect(allText).not.toContain(term);
    }
  });

  it("no encadena signos de admiración", () => {
    for (const text of allStrings) {
      expect(text).not.toMatch(/!{2,}|¡{2,}/);
    }
  });
});

describe("copy.ts — interpolación", () => {
  it("timer.pomodoroStart genera string con ciclo", () => {
    const msg = copy.timer.pomodoroStart(1, 4);
    expect(msg).toContain("1");
    expect(msg).toContain("4");
    expect(msg).toContain("concentrarse");
  });

  it("timer.started incluye los minutos", () => {
    expect(copy.timer.started(25)).toContain("25");
  });

  it("notifications.phaseComplete nombra la fase", () => {
    expect(copy.notifications.phaseComplete("descanso")).toContain("descanso");
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

  it("panel.sessionsToday concuerda en número", () => {
    expect(copy.panel.sessionsToday(1)).toBe("1 sesión hoy");
    expect(copy.panel.sessionsToday(3)).toBe("3 sesiones hoy");
  });

  it("aria.readout describe tiempo y modo", () => {
    const msg = copy.aria.readout("24:59", "Trabajo");
    expect(msg).toContain("24:59");
    expect(msg).toContain("Trabajo");
  });

  it("panel.pomodoroAction refleja el bloque elegido", () => {
    expect(copy.panel.pomodoroAction(25)).toContain("25");
    expect(copy.panel.pomodoroAction(100)).toContain("100");
  });

  it("panel.pomodoroBlockOption nombra el multiplicador y los minutos", () => {
    const msg = copy.panel.pomodoroBlockOption(2, 50);
    expect(msg).toContain("2");
    expect(msg).toContain("50");
  });

  // The promise the setting makes: the break never grows with the block.
  it("panel.pomodoroBlockHint aclara que el descanso no cambia", () => {
    expect(copy.panel.pomodoroBlockHint.toLowerCase()).toContain("descanso");
  });

  it("aria.pomodoroBlock describe la opción para lectores de pantalla", () => {
    const msg = copy.aria.pomodoroBlock(3, 75);
    expect(msg).toContain("3");
    expect(msg).toContain("75");
  });

  describe("panel.pomodoroCaption", () => {
    it("nombra la fase y el ciclo", () => {
      const msg = copy.panel.pomodoroCaption(copy.panel.work, 1, 4);
      expect(msg).toContain(copy.panel.work);
      expect(msg).toContain("1");
      expect(msg).toContain("4");
    });

    /**
     * The whole point of moving the cycle here: on a seven-segment face
     * `01:04` is indistinguishable from a clock reading, which is exactly how
     * it was misread. A slash never is.
     */
    it("no usa dos puntos, que en el LED se leen como una hora", () => {
      expect(copy.panel.pomodoroCaption(copy.panel.work, 1, 4)).not.toContain(
        ":",
      );
    });

    it("no rellena con ceros a la izquierda", () => {
      expect(copy.panel.pomodoroCaption(copy.panel.break, 2, 4)).toContain(
        "2/4",
      );
    });
  });
});
