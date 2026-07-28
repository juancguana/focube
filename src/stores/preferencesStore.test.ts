import { describe, expect, it, beforeEach } from "vitest";
import { usePreferencesStore } from "./preferencesStore";

describe("preferencesStore", () => {
  beforeEach(() => {
    // Reset store between tests
    usePreferencesStore.setState({
      cubeFinish: "black",
      alertType: "sound",
      soundscape: "focus",
      customMinutes: 25,
      alarms: [{ id: "alarm-1", hour: 8, minute: 0, enabled: false }],
      hasSeenOnboarding: false,
      panelSectionsCollapsed: { alertType: false, finish: false },
      dailySessions: 0,
      dailySessionsDate: "2000-01-01",
      streakDays: 0,
      lastStreakDate: "",
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

  it("togglePanelSectionCollapsed cambia estado de sección", () => {
    expect(
      usePreferencesStore.getState().panelSectionsCollapsed.alertType,
    ).toBe(false);
    usePreferencesStore
      .getState()
      .togglePanelSectionCollapsed("alertType");
    expect(
      usePreferencesStore.getState().panelSectionsCollapsed.alertType,
    ).toBe(true);
  });
});
