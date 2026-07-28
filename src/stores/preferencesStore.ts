import { create } from "zustand";
import { persist } from "zustand/middleware";
import { todayKey } from "@/utils/dates";
import { clampPomodoroMultiplier } from "@/utils/cube";

export type CubeFinish = "black" | "white" | "blue" | "lavender";
export type AlertType = "sound" | "vibration" | "silent";
export type SoundscapeId = "off" | "ticks" | "focus" | "both";

export interface AlarmConfig {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
}

export interface PanelSectionsCollapsed {
  screenTools: boolean;
  focusMode: boolean;
  alertType: boolean;
  finish: boolean;
}

export interface PreferencesState {
  // Cube appearance
  cubeFinish: CubeFinish;

  // Alert
  alertType: AlertType;

  // Focus soundscape
  soundscape: SoundscapeId;

  // Custom countdown
  customMinutes: number;

  // Pomodoro work-block length, in whole multiples of 25 min. The break never
  // scales with it.
  pomodoroMultiplier: number;

  // Alarms
  alarms: AlarmConfig[];

  // Onboarding
  hasSeenOnboarding: boolean;

  // Browser notifications (P1.3) — explicit opt-in, never assumed
  notificationsEnabled: boolean;

  // Panel collapsible state (P1.5)
  panelSectionsCollapsed: PanelSectionsCollapsed;

  // Session counter (P2.1)
  dailySessions: number;
  dailySessionsDate: string; // YYYY-MM-DD
  streakDays: number;
  lastStreakDate: string; // YYYY-MM-DD

  // First-ever visit (P... feedback/streak dismissal) — "" sentinel for
  // "not yet persisted". Never undefined: merge() relies on that.
  firstVisitDate: string;
  // Per-day streak dismissal — null means "never dismissed".
  streakHiddenDate: string | null;

  // Actions
  setCubeFinish: (finish: CubeFinish) => void;
  setAlertType: (type: AlertType) => void;
  setSoundscape: (soundscape: SoundscapeId) => void;
  setCustomMinutes: (minutes: number) => void;
  setPomodoroMultiplier: (multiplier: number) => void;
  setAlarms: (alarms: AlarmConfig[]) => void;
  updateAlarm: (id: string, patch: Partial<AlarmConfig>) => void;
  markOnboardingSeen: () => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  togglePanelSectionCollapsed: (section: keyof PanelSectionsCollapsed) => void;
  setPanelSectionsCollapsed: (state: PanelSectionsCollapsed) => void;
  incrementDailySession: () => void;
  markFirstVisit: (today?: string) => void;
  hideStreakForToday: (today?: string) => void;
  resetStore: () => void;
}

/**
 * Single source of truth for the streak-visibility rule: visible only when
 * there is at least one session today AND today hasn't been dismissed.
 */
export function isStreakVisible(
  dailySessions: number,
  streakHiddenDate: string | null,
  today: string,
): boolean {
  if (dailySessions === 0) return false;
  return streakHiddenDate !== today;
}

const defaultAlarms: AlarmConfig[] = [
  { id: "alarm-1", hour: 8, minute: 0, enabled: false },
];

/**
 * Secondary panel sections start collapsed so a first contact only sees the
 * readout and "Voltear a una cara" — progressive disclosure (P1.5).
 */
const defaultSectionsCollapsed: PanelSectionsCollapsed = {
  screenTools: true,
  focusMode: true,
  alertType: true,
  finish: true,
};

export const initialPreferences = {
  cubeFinish: "black" as CubeFinish,
  alertType: "sound" as AlertType,
  soundscape: "focus" as SoundscapeId,
  customMinutes: 25,
  pomodoroMultiplier: 1,
  alarms: defaultAlarms,
  hasSeenOnboarding: false,
  notificationsEnabled: false,
  panelSectionsCollapsed: defaultSectionsCollapsed,
  dailySessions: 0,
  dailySessionsDate: todayKey(),
  streakDays: 0,
  lastStreakDate: "",
  firstVisitDate: "",
  streakHiddenDate: null,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      ...initialPreferences,

      setCubeFinish: (finish) => set({ cubeFinish: finish }),
      setAlertType: (type) => set({ alertType: type }),
      setSoundscape: (soundscape) => set({ soundscape }),
      setCustomMinutes: (minutes) => set({ customMinutes: minutes }),

      // Clamped here rather than at the call sites: a deep link can reach this
      // with anything, and one guard at the write beats four at the readers.
      setPomodoroMultiplier: (multiplier) =>
        set({ pomodoroMultiplier: clampPomodoroMultiplier(multiplier) }),
      setAlarms: (alarms) => set({ alarms }),

      updateAlarm: (id, patch) =>
        set((state) => ({
          alarms: state.alarms.map((a) =>
            a.id === id ? { ...a, ...patch } : a,
          ),
        })),

      // Guarded: called from every first interaction, so it must be a no-op
      // once the hint is gone.
      markOnboardingSeen: () => {
        if (get().hasSeenOnboarding) return;
        set({ hasSeenOnboarding: true });
      },

      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),

      togglePanelSectionCollapsed: (section) =>
        set((state) => ({
          panelSectionsCollapsed: {
            ...state.panelSectionsCollapsed,
            [section]: !state.panelSectionsCollapsed[section],
          },
        })),

      setPanelSectionsCollapsed: (state) =>
        set({ panelSectionsCollapsed: state }),

      incrementDailySession: () => {
        const today = todayKey();
        const state = get();

        if (state.dailySessionsDate !== today) {
          // New day: check if yesterday had sessions to extend streak
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

          const hadSessionsYesterday =
            state.lastStreakDate === yesterdayKey ||
            state.dailySessionsDate === yesterdayKey;

          set({
            dailySessions: 1,
            dailySessionsDate: today,
            streakDays: hadSessionsYesterday ? state.streakDays + 1 : 1,
            lastStreakDate: today,
          });
        } else {
          set({
            dailySessions: state.dailySessions + 1,
            lastStreakDate: today,
          });
        }
      },

      // Guarded write-once, mirroring markOnboardingSeen: the first call
      // wins, later calls (even on a later day) must not overwrite it.
      markFirstVisit: (today = todayKey()) => {
        if (get().firstVisitDate) return;
        set({ firstVisitDate: today });
      },

      hideStreakForToday: (today = todayKey()) =>
        set({ streakHiddenDate: today }),

      resetStore: () =>
        set({
          ...initialPreferences,
          hasSeenOnboarding: true, // Don't re-show onboarding after reset
        }),
    }),
    {
      name: "focube-preferences",
      partialize: (state) => ({
        cubeFinish: state.cubeFinish,
        alertType: state.alertType,
        soundscape: state.soundscape,
        customMinutes: state.customMinutes,
        pomodoroMultiplier: state.pomodoroMultiplier,
        alarms: state.alarms,
        hasSeenOnboarding: state.hasSeenOnboarding,
        notificationsEnabled: state.notificationsEnabled,
        panelSectionsCollapsed: state.panelSectionsCollapsed,
        dailySessions: state.dailySessions,
        dailySessionsDate: state.dailySessionsDate,
        streakDays: state.streakDays,
        lastStreakDate: state.lastStreakDate,
        firstVisitDate: state.firstVisitDate,
        streakHiddenDate: state.streakHiddenDate,
      }),
      // Sections are a nested object: a shallow merge would drop keys added
      // after a visitor's preferences were already stored.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PreferencesState>;
        return {
          ...current,
          ...saved,
          panelSectionsCollapsed: {
            ...defaultSectionsCollapsed,
            ...(saved.panelSectionsCollapsed ?? {}),
          },
          // Stored preferences outlive the code that wrote them: a multiplier
          // saved by a build with a wider range, or edited by hand, must not
          // come back as a session length this build never offers.
          pomodoroMultiplier: clampPomodoroMultiplier(
            saved.pomodoroMultiplier ?? current.pomodoroMultiplier,
          ),
        };
      },
    },
  ),
);
