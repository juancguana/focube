import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  ALARM_LIMIT,
  type Alarm,
  TIP_ANGLES,
  appendAlarm,
  CUSTOM_MAX_MINUTES,
  CUSTOM_MIN_MINUTES,
  POMODORO_BREAK_MS,
  POMODORO_MULTIPLIERS,
  POMODORO_WORK_MS,
  clampPomodoroMultiplier,
  STOPWATCH_MAX_MS,
  clampCustomMinutes,
  clampStopwatchMs,
  detectTopFace,
  dialFaceForStep,
  dialStepForFace,
  faceForPose,
  findDueAlarm,
  formatClockTime,
  formatDigitalTime,
  formatWeekday,
  getFaceById,
  getInitialQuaternion,
  getModeForFace,
  getNextPomodoroStep,
  getQuaternionForTopFace,
  nearestTip,
  normalizeAlarms,
  orientationQuaternion,
  snapDialStep,
  tipForFace,
} from "./cube";

describe("face configuration", () => {
  it("expone las cinco caras alcanzables del cubo", () => {
    const ids = ["five", "ten", "thirty", "sixty", "screen"] as const;

    for (const id of ids) {
      expect(getFaceById(id)?.id).toBe(id);
    }
  });

  it("no expone Pomodoro como cara: es una acción", () => {
    expect(getFaceById("pomodoro")).toBeNull();
  });

  it("asigna a cada cara numérica su duración en minutos", () => {
    expect(getFaceById("five")?.minutes).toBe(5);
    expect(getFaceById("ten")?.minutes).toBe(10);
    expect(getFaceById("thirty")?.minutes).toBe(30);
    expect(getFaceById("sixty")?.minutes).toBe(60);
  });

  it("mapea cada cara a su modo", () => {
    expect(getModeForFace("five")).toBe("countdown");
    expect(getModeForFace("sixty")).toBe("countdown");
    expect(getModeForFace("pomodoro")).toBe("pomodoro");
    expect(getModeForFace("screen")).toBe("clock");
  });
});

describe("detectTopFace", () => {
  it("detecta la cara pantalla con la orientación de reposo", () => {
    const detected = detectTopFace(getQuaternionForTopFace("screen"));
    expect(detected?.face.id).toBe("screen");
  });

  it("detecta cada cara alcanzable cuando su preset la coloca arriba", () => {
    for (const id of ["five", "ten", "thirty", "sixty"] as const) {
      const detected = detectTopFace(getQuaternionForTopFace(id));
      expect(detected?.face.id).toBe(id);
    }
  });

  it("mantiene una orientación inicial válida para la escena", () => {
    expect(detectTopFace(getInitialQuaternion())).not.toBeNull();
  });
});

describe("pose model", () => {
  it("gira el dial en orden ascendente de minutos", () => {
    // Turning the dial one quarter at a time reads 5 -> 10 -> 30 -> 60.
    expect(dialFaceForStep(0)).toBe("five");
    expect(dialFaceForStep(1)).toBe("ten");
    expect(dialFaceForStep(2)).toBe("thirty");
    expect(dialFaceForStep(3)).toBe("sixty");
  });

  it("cicla el dial en ambos sentidos", () => {
    expect(dialFaceForStep(4)).toBe("five");
    expect(dialFaceForStep(-1)).toBe("sixty");
  });

  it("la única pose inclinada es el reloj, e ignora el dial", () => {
    for (const step of [0, 1, 2, 3]) {
      expect(faceForPose(step, "clock")).toBe("screen");
    }
  });

  it("cada cara alcanzable resuelve a la pose que la deja arriba", () => {
    for (const id of ["five", "ten", "thirty", "sixty", "screen"] as const) {
      const quaternion = orientationQuaternion(
        dialStepForFace(id) * (Math.PI / 2),
        TIP_ANGLES[tipForFace(id)],
      );

      expect(detectTopFace(quaternion)?.face.id).toBe(id);
    }
  });

  it("nunca coloca arriba la cara opuesta a la pantalla", () => {
    // Every reachable pose keeps the screen (+Z) at least partly toward the
    // camera, so the clock is always visible.
    const screenNormal = new THREE.Vector3(0, 0, 1);
    for (const tip of ["none", "clock"] as const) {
      for (let step = 0; step < 4; step += 1) {
        const q = orientationQuaternion(step * (Math.PI / 2), TIP_ANGLES[tip]);
        const worldScreen = screenNormal.clone().applyQuaternion(q);
        // +Z world points toward the camera; the screen must never face away.
        expect(worldScreen.z).toBeGreaterThan(0);
      }
    }
  });

  it("redondea el ángulo del dial al cuarto más cercano", () => {
    expect(snapDialStep(0.1)).toBe(0);
    expect(snapDialStep(Math.PI / 2 - 0.1)).toBe(1);
    expect(snapDialStep(Math.PI / 2 + 0.1)).toBe(1);
    expect(snapDialStep(-Math.PI / 2)).toBe(-1);
  });

  it("elige la inclinación por detente más cercano", () => {
    expect(nearestTip(0)).toBe("none");
    expect(nearestTip(0.2)).toBe("none");
    expect(nearestTip(TIP_ANGLES.clock)).toBe("clock");
  });
});

describe("formatDigitalTime", () => {
  it("formatea minutos y segundos", () => {
    expect(formatDigitalTime(3 * 60 * 1000 + 12 * 1000)).toBe("03:12");
  });

  it("formatea horas cuando se solicita", () => {
    expect(formatDigitalTime(60 * 60 * 1000, { includeHours: true })).toBe("01:00:00");
  });

  it("nunca devuelve tiempos negativos", () => {
    expect(formatDigitalTime(-5000)).toBe("00:00");
  });
});

describe("reloj", () => {
  it("formatea la hora en 24h con dos dígitos", () => {
    expect(formatClockTime(new Date(2026, 6, 23, 9, 5))).toBe("09:05");
    expect(formatClockTime(new Date(2026, 6, 23, 21, 40))).toBe("21:40");
  });

  it("abrevia el día de la semana en dos letras", () => {
    expect(formatWeekday(new Date(2026, 6, 21))).toBe("Tu");
    expect(formatWeekday(new Date(2026, 6, 22))).toBe("We");
  });
});

describe("cuenta regresiva personalizada", () => {
  it("acepta valores dentro del rango 1-99", () => {
    expect(clampCustomMinutes(25)).toBe(25);
    expect(clampCustomMinutes(CUSTOM_MIN_MINUTES)).toBe(1);
    expect(clampCustomMinutes(CUSTOM_MAX_MINUTES)).toBe(99);
  });

  it("recorta valores fuera de rango", () => {
    expect(clampCustomMinutes(0)).toBe(1);
    expect(clampCustomMinutes(140)).toBe(99);
  });

  it("descarta entradas no numéricas", () => {
    expect(clampCustomMinutes(Number.NaN)).toBe(1);
  });
});

describe("cronómetro", () => {
  it("cuenta hacia arriba hasta el tope de 99 minutos", () => {
    expect(clampStopwatchMs(42_000)).toBe(42_000);
    expect(clampStopwatchMs(STOPWATCH_MAX_MS + 60_000)).toBe(STOPWATCH_MAX_MS);
    expect(clampStopwatchMs(-10)).toBe(0);
  });
});

describe("getNextPomodoroStep", () => {
  it("inicia la primera fase de trabajo", () => {
    const next = getNextPomodoroStep({
      enabled: true,
      cycle: 0,
      phase: "idle",
      totalCycles: 4,
      workMultiplier: 1,
    });

    expect(next).toEqual({ cycle: 1, phase: "work", durationMs: POMODORO_WORK_MS });
  });

  it("pasa de trabajo a descanso dentro del mismo ciclo", () => {
    const next = getNextPomodoroStep({
      enabled: true,
      cycle: 2,
      phase: "work",
      totalCycles: 4,
      workMultiplier: 1,
    });

    expect(next).toEqual({ cycle: 2, phase: "break", durationMs: POMODORO_BREAK_MS });
  });

  it("cierra la secuencia al terminar el cuarto ciclo", () => {
    const next = getNextPomodoroStep({
      enabled: true,
      cycle: 4,
      phase: "work",
      totalCycles: 4,
      workMultiplier: 1,
    });

    expect(next).toEqual({ cycle: 4, phase: "done", durationMs: 0 });
  });
});

describe("multiplicador del bloque de trabajo", () => {
  it.each(POMODORO_MULTIPLIERS)(
    "multiplica el primer bloque de trabajo por x%i",
    (multiplier) => {
      const next = getNextPomodoroStep({
        enabled: true,
        cycle: 0,
        phase: "idle",
        totalCycles: 4,
        workMultiplier: multiplier,
      });

      expect(next?.durationMs).toBe(POMODORO_WORK_MS * multiplier);
    },
  );

  it("multiplica también los bloques de trabajo posteriores al descanso", () => {
    const next = getNextPomodoroStep({
      enabled: true,
      cycle: 2,
      phase: "break",
      totalCycles: 4,
      workMultiplier: 3,
    });

    expect(next).toEqual({
      cycle: 3,
      phase: "work",
      durationMs: POMODORO_WORK_MS * 3,
    });
  });

  // The whole point of the feature: longer focus, same short breather.
  it.each(POMODORO_MULTIPLIERS)(
    "deja el descanso intacto con x%i",
    (multiplier) => {
      const next = getNextPomodoroStep({
        enabled: true,
        cycle: 1,
        phase: "work",
        totalCycles: 4,
        workMultiplier: multiplier,
      });

      expect(next?.durationMs).toBe(POMODORO_BREAK_MS);
    },
  );

  it("ofrece x1 a x4 y nada más", () => {
    expect(POMODORO_MULTIPLIERS).toEqual([1, 2, 3, 4]);
  });

  describe("clampPomodoroMultiplier", () => {
    it.each(POMODORO_MULTIPLIERS)("acepta x%i tal cual", (multiplier) => {
      expect(clampPomodoroMultiplier(multiplier)).toBe(multiplier);
    });

    it.each([
      ["por debajo del rango", 0, 1],
      ["negativo", -3, 1],
      ["por encima del rango", 9, 4],
      ["fraccionario", 2.7, 2],
    ])("corrige un valor %s", (_label, input, expected) => {
      expect(clampPomodoroMultiplier(input)).toBe(expected);
    });

    // Deep links and localStorage are untrusted input, so garbage must land
    // on the default rather than produce a NaN-length session.
    it.each([
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
    ])("cae en x1 ante %s", (_label, input) => {
      expect(clampPomodoroMultiplier(input)).toBe(1);
    });
  });
});

describe("alarmas", () => {
  it("limita la cantidad de alarmas a tres", () => {
    const alarms = normalizeAlarms([
      { id: "a", hour: 7, minute: 0, enabled: true },
      { id: "b", hour: 8, minute: 30, enabled: true },
      { id: "c", hour: 9, minute: 15, enabled: true },
      { id: "d", hour: 10, minute: 0, enabled: true },
    ]);

    expect(alarms).toHaveLength(ALARM_LIMIT);
  });

  it("nunca supera el límite al añadir de a una, aun en ráfaga", () => {
    let alarms: Alarm[] = [];

    for (let index = 0; index < 6; index += 1) {
      alarms = appendAlarm(alarms, { id: `a-${index}`, hour: 8, minute: 0, enabled: true });
    }

    expect(alarms).toHaveLength(ALARM_LIMIT);
  });

  it("recorta horas y minutos inválidos", () => {
    const [alarm] = normalizeAlarms([{ id: "a", hour: 30, minute: 88, enabled: true }]);
    expect(alarm.hour).toBe(23);
    expect(alarm.minute).toBe(59);
  });

  it("encuentra la alarma activa que coincide con la hora actual", () => {
    const alarms = [
      { id: "a", hour: 7, minute: 0, enabled: false },
      { id: "b", hour: 9, minute: 30, enabled: true },
    ];

    expect(findDueAlarm(alarms, new Date(2026, 6, 23, 9, 30, 0))?.id).toBe("b");
  });

  it("ignora alarmas desactivadas y horas que no coinciden", () => {
    const alarms = [{ id: "a", hour: 7, minute: 0, enabled: false }];

    expect(findDueAlarm(alarms, new Date(2026, 6, 23, 7, 0, 0))).toBeNull();
    expect(findDueAlarm(alarms, new Date(2026, 6, 23, 8, 0, 0))).toBeNull();
  });

  it("sólo dispara durante el primer segundo del minuto", () => {
    const alarms = [{ id: "b", hour: 9, minute: 30, enabled: true }];

    expect(findDueAlarm(alarms, new Date(2026, 6, 23, 9, 30, 0))?.id).toBe("b");
    expect(findDueAlarm(alarms, new Date(2026, 6, 23, 9, 30, 30))).toBeNull();
  });
});
