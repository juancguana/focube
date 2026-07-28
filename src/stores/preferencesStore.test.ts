import { describe, expect, it, beforeEach } from "vitest";
import {
  initialPreferences,
  isStreakVisible,
  usePreferencesStore,
} from "./preferencesStore";

describe("preferencesStore", () => {
  beforeEach(() => {
    // Reset store between tests
    usePreferencesStore.setState({
      ...initialPreferences,
      alarms: [{ id: "alarm-1", hour: 8, minute: 0, enabled: false }],
      dailySessionsDate: "2000-01-01",
    });
  });

  it("inicializa con valores por defecto", () => {
    const state = usePreferencesStore.getState();
    expect(state.cubeFinish).toBe("black");
    expect(state.alertType).toBe("sound");
    expect(state.customMinutes).toBe(25);
    expect(state.hasSeenOnboarding).toBe(false);
  });

  it("setCubeFinish actualiza el acabado", () => {
    usePreferencesStore.getState().setCubeFinish("lavender");
    expect(usePreferencesStore.getState().cubeFinish).toBe("lavender");
  });

  it("setAlertType actualiza tipo de alerta", () => {
    usePreferencesStore.getState().setAlertType("vibration");
    expect(usePreferencesStore.getState().alertType).toBe("vibration");
  });

  it("setSoundscape actualiza soundscape", () => {
    usePreferencesStore.getState().setSoundscape("ticks");
    expect(usePreferencesStore.getState().soundscape).toBe("ticks");
  });

  it("setCustomMinutes actualiza minutos", () => {
    usePreferencesStore.getState().setCustomMinutes(45);
    expect(usePreferencesStore.getState().customMinutes).toBe(45);
  });

  describe("pomodoroMultiplier", () => {
    it("arranca en x1, el pomodoro clásico", () => {
      expect(usePreferencesStore.getState().pomodoroMultiplier).toBe(1);
    });

    it("setPomodoroMultiplier actualiza el multiplicador", () => {
      usePreferencesStore.getState().setPomodoroMultiplier(3);
      expect(usePreferencesStore.getState().pomodoroMultiplier).toBe(3);
    });

    // The setter is reachable from a deep link, so it guards its own range
    // instead of trusting every caller to have clamped first.
    it.each([
      ["por encima del rango", 7, 4],
      ["por debajo del rango", 0, 1],
      ["basura", Number.NaN, 1],
    ])("corrige un valor %s antes de guardarlo", (_label, input, expected) => {
      usePreferencesStore.getState().setPomodoroMultiplier(input);
      expect(usePreferencesStore.getState().pomodoroMultiplier).toBe(expected);
    });

    it("sanea un multiplicador fuera de rango que venía guardado", () => {
      const merge = usePreferencesStore.persist.getOptions().merge!;
      const merged = merge(
        { pomodoroMultiplier: 12 },
        usePreferencesStore.getState(),
      ) as { pomodoroMultiplier: number };

      expect(merged.pomodoroMultiplier).toBe(4);
    });

    it("conserva x1 cuando no había nada guardado", () => {
      const merge = usePreferencesStore.persist.getOptions().merge!;
      const merged = merge({}, usePreferencesStore.getState()) as {
        pomodoroMultiplier: number;
      };

      expect(merged.pomodoroMultiplier).toBe(1);
    });
  });

  it("markOnboardingSeen marca como visto", () => {
    expect(usePreferencesStore.getState().hasSeenOnboarding).toBe(false);
    usePreferencesStore.getState().markOnboardingSeen();
    expect(usePreferencesStore.getState().hasSeenOnboarding).toBe(true);
  });

  it("updateAlarm modifica parcialmente una alarma", () => {
    const alarm = usePreferencesStore.getState().alarms[0];
    expect(alarm.enabled).toBe(false);
    usePreferencesStore.getState().updateAlarm(alarm.id, { enabled: true });
    expect(usePreferencesStore.getState().alarms[0].enabled).toBe(true);
  });

  it("setAlarms reemplaza la lista completa", () => {
    usePreferencesStore
      .getState()
      .setAlarms([{ id: "new", hour: 10, minute: 30, enabled: true }]);
    expect(usePreferencesStore.getState().alarms).toHaveLength(1);
    expect(usePreferencesStore.getState().alarms[0].hour).toBe(10);
  });

  it("las secciones secundarias arrancan colapsadas", () => {
    const { panelSectionsCollapsed } = usePreferencesStore.getState();
    expect(panelSectionsCollapsed).toEqual({
      screenTools: true,
      focusMode: true,
      alertType: true,
      finish: true,
    });
  });

  it("togglePanelSectionCollapsed cambia estado de sección", () => {
    expect(
      usePreferencesStore.getState().panelSectionsCollapsed.alertType,
    ).toBe(true);
    usePreferencesStore.getState().togglePanelSectionCollapsed("alertType");
    expect(
      usePreferencesStore.getState().panelSectionsCollapsed.alertType,
    ).toBe(false);
  });

  it("setNotificationsEnabled guarda el opt-in", () => {
    expect(usePreferencesStore.getState().notificationsEnabled).toBe(false);
    usePreferencesStore.getState().setNotificationsEnabled(true);
    expect(usePreferencesStore.getState().notificationsEnabled).toBe(true);
  });

  it("incrementDailySession suma sesiones del día y abre racha", () => {
    usePreferencesStore.getState().incrementDailySession();
    const first = usePreferencesStore.getState();
    expect(first.dailySessions).toBe(1);
    expect(first.streakDays).toBe(1);

    usePreferencesStore.getState().incrementDailySession();
    expect(usePreferencesStore.getState().dailySessions).toBe(2);
    // Same day must not inflate the streak.
    expect(usePreferencesStore.getState().streakDays).toBe(1);
  });

  it("arranca con firstVisitDate y streakHiddenDate en sus valores por defecto", () => {
    const state = usePreferencesStore.getState();
    expect(state.firstVisitDate).toBe("");
    expect(state.streakHiddenDate).toBeNull();
  });

  it("markFirstVisit escribe una sola vez", () => {
    usePreferencesStore.getState().markFirstVisit("2026-07-27");
    expect(usePreferencesStore.getState().firstVisitDate).toBe("2026-07-27");

    // A second call on a later day must not overwrite the first visit.
    usePreferencesStore.getState().markFirstVisit("2026-07-28");
    expect(usePreferencesStore.getState().firstVisitDate).toBe("2026-07-27");
  });

  it("hideStreakForToday guarda la fecha de hoy", () => {
    expect(usePreferencesStore.getState().streakHiddenDate).toBeNull();
    usePreferencesStore.getState().hideStreakForToday("2026-07-27");
    expect(usePreferencesStore.getState().streakHiddenDate).toBe("2026-07-27");
  });

  describe("isStreakVisible", () => {
    it("se oculta el mismo día en que se descarta", () => {
      expect(isStreakVisible(1, "2026-07-27", "2026-07-27")).toBe(false);
    });

    it("vuelve a mostrarse al día siguiente", () => {
      expect(isStreakVisible(1, "2026-07-27", "2026-07-28")).toBe(true);
    });

    it("se muestra si nunca se descartó", () => {
      expect(isStreakVisible(1, null, "2026-07-27")).toBe(true);
    });

    it("se oculta cuando no hay sesiones hoy, sin importar el descarte", () => {
      expect(isStreakVisible(0, null, "2026-07-27")).toBe(false);
    });
  });

  it("los campos nuevos sobreviven a un payload persistido que no los tiene, sin romper el deep-merge de panelSectionsCollapsed", () => {
    const legacyPersisted = {
      cubeFinish: "blue",
      panelSectionsCollapsed: { finish: false },
      // firstVisitDate / streakHiddenDate intentionally absent — pre-change payload.
    };

    const merged = usePreferencesStore.persist.getOptions().merge!(
      legacyPersisted,
      usePreferencesStore.getState(),
    ) as ReturnType<typeof usePreferencesStore.getState>;

    expect(merged.firstVisitDate).toBe("");
    expect(merged.streakHiddenDate).toBeNull();
    expect(merged.firstVisitDate).not.toBeUndefined();
    expect(merged.streakHiddenDate).not.toBeUndefined();
    // The custom deep-merge for panelSectionsCollapsed must still hold.
    expect(merged.panelSectionsCollapsed).toEqual({
      screenTools: true,
      focusMode: true,
      alertType: true,
      finish: false,
    });
  });
});
