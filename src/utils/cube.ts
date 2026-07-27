import * as THREE from "three";

export type ModeFaceId = "five" | "ten" | "thirty" | "sixty" | "pomodoro";
export type FaceId = ModeFaceId | "screen";
export type CubeMode = "clock" | "countdown" | "pomodoro";
export type PomodoroPhase = "idle" | "work" | "break" | "done";
export type CubeColor = "black" | "white" | "blue" | "lavender";
export type AlertType = "sound" | "vibration" | "silent";

/** Secondary tools reachable from the screen face. */
export type ScreenTool = "clock" | "custom" | "stopwatch" | "alarms";

export type FaceConfig = {
  id: FaceId;
  label: string;
  /** Face normal in cube-local space. */
  normal: [number, number, number];
  position: [number, number, number];
  rotation: [number, number, number];
  minutes?: number;
};

export type PomodoroState = {
  enabled: boolean;
  cycle: number;
  phase: PomodoroPhase;
  totalCycles: number;
};

export type Alarm = {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
};

export const POMODORO_WORK_MS = 25 * 60 * 1000;
export const POMODORO_BREAK_MS = 5 * 60 * 1000;
export const POMODORO_TOTAL_CYCLES = 4;

export const CUSTOM_MIN_MINUTES = 1;
export const CUSTOM_MAX_MINUTES = 99;
export const STOPWATCH_MAX_MS = 99 * 60 * 1000;
export const ALARM_LIMIT = 3;

const HALF = 0.61;

/**
 * The screen sits on +Z and the four dial faces ring it, so turning the cube
 * about the screen axis swaps which number is up while the panel keeps facing
 * you — the way you actually operate the physical cube. Dial order is chosen so
 * a quarter turn reads 5 -> 10 -> 30. `sixty` takes the face opposite the
 * screen (reached by tipping) because it is the set-and-walk-away timer.
 */
/**
 * The four numbers ring the screen axis (+Z), so turning the dial always keeps
 * the screen facing the viewer. The face opposite the screen (-Z) would point
 * the screen away, so it is left blank and is never a landing pose — that is
 * the deliberate limit that keeps the clock visible in every reachable move.
 * Pomodoro is an action (like the real cube's "5 + long-press"), not a face.
 */
export const FACE_CONFIGS: FaceConfig[] = [
  {
    id: "screen",
    label: "Reloj",
    normal: [0, 0, 1],
    position: [0, 0, HALF],
    rotation: [0, 0, 0],
  },
  {
    id: "five",
    label: "5",
    normal: [0, 1, 0],
    position: [0, HALF, 0],
    rotation: [-Math.PI / 2, 0, 0],
    minutes: 5,
  },
  {
    id: "ten",
    label: "10",
    normal: [1, 0, 0],
    position: [HALF, 0, 0],
    rotation: [0, Math.PI / 2, 0],
    minutes: 10,
  },
  {
    id: "thirty",
    label: "30",
    normal: [0, -1, 0],
    position: [0, -HALF, 0],
    rotation: [Math.PI / 2, 0, 0],
    minutes: 30,
  },
  {
    id: "sixty",
    label: "60",
    normal: [-1, 0, 0],
    position: [-HALF, 0, 0],
    rotation: [0, -Math.PI / 2, 0],
    minutes: 60,
  },
];

/** Dial faces in the order a positive quarter turn brings them up: 5→10→30→60. */
export const DIAL_FACES = ["five", "ten", "thirty", "sixty"] as const;

export type TipState = "none" | "clock";

/**
 * 40° off the pole: enough to keep the tipped face clearly on top (cos 40° =
 * 0.77, above the detection threshold and ahead of the next face at 0.64) while
 * angling the panel toward the viewer like a propped-up desk clock.
 */
const TIP_ANGLE = 0.698;

export const TIP_ANGLES: Record<TipState, number> = {
  none: 0,
  clock: -Math.PI / 2 + TIP_ANGLE,
};

export const QUARTER_TURN = Math.PI / 2;

/**
 * Orientation is fully described by how far the dial is turned and how far the
 * cube is tipped. Building the quaternion from those two numbers means every
 * reachable pose is a meaningful one — free tumbling could land nowhere.
 */
export function orientationQuaternion(dialAngle: number, tipAngle: number) {
  const dial = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    dialAngle,
  );
  const tip = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    tipAngle,
  );

  return tip.multiply(dial);
}

export function snapDialStep(dialAngle: number) {
  return Math.round(dialAngle / QUARTER_TURN);
}

export function dialFaceForStep(step: number): FaceId {
  const index = ((step % DIAL_FACES.length) + DIAL_FACES.length) % DIAL_FACES.length;
  return DIAL_FACES[index];
}

export function dialStepForFace(faceId: FaceId) {
  const index = DIAL_FACES.indexOf(faceId as (typeof DIAL_FACES)[number]);
  return index >= 0 ? index : 0;
}

export function tipForFace(faceId: FaceId): TipState {
  return faceId === "screen" ? "clock" : "none";
}

export function faceForPose(dialStep: number, tip: TipState): FaceId {
  return tip === "clock" ? "screen" : dialFaceForStep(dialStep);
}

/** Resolves a mid-drag tip angle to the closest detent. */
export function nearestTip(tipAngle: number): TipState {
  return (Object.keys(TIP_ANGLES) as TipState[]).reduce((best, candidate) =>
    Math.abs(TIP_ANGLES[candidate] - tipAngle) < Math.abs(TIP_ANGLES[best] - tipAngle)
      ? candidate
      : best,
  );
}

export function getInitialQuaternion() {
  return getQuaternionForTopFace("screen");
}

export function getFaceById(id: FaceId | null) {
  return FACE_CONFIGS.find((face) => face.id === id) ?? null;
}

export function getModeForFace(id: FaceId): CubeMode {
  if (id === "screen") {
    return "clock";
  }

  return id === "pomodoro" ? "pomodoro" : "countdown";
}

export function getQuaternionForTopFace(faceId: FaceId) {
  return orientationQuaternion(
    dialStepForFace(faceId) * QUARTER_TURN,
    TIP_ANGLES[tipForFace(faceId)],
  );
}

export function detectTopFace(quaternion: THREE.Quaternion, threshold = 0.72) {
  const worldUp = new THREE.Vector3(0, 1, 0);

  const best = FACE_CONFIGS.map((face) => ({
    face,
    alignment: new THREE.Vector3(...face.normal)
      .applyQuaternion(quaternion)
      .normalize()
      .dot(worldUp),
  })).sort((left, right) => right.alignment - left.alignment)[0];

  if (!best || best.alignment < threshold) {
    return null;
  }

  return best;
}

export function formatDigitalTime(ms: number, options?: { includeHours?: boolean }) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const includeHours = options?.includeHours ?? hours > 0;

  if (includeHours) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  return [totalMinutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function formatClockTime(date: Date) {
  return [date.getHours(), date.getMinutes()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function formatWeekday(date: Date) {
  return WEEKDAYS[date.getDay()] ?? "--";
}

export function formatCalendarDate(date: Date) {
  return [date.getMonth() + 1, date.getDate()]
    .map((value) => String(value).padStart(2, "0"))
    .join("/");
}

export function clampCustomMinutes(minutes: number) {
  if (!Number.isFinite(minutes)) {
    return CUSTOM_MIN_MINUTES;
  }

  return Math.min(CUSTOM_MAX_MINUTES, Math.max(CUSTOM_MIN_MINUTES, Math.round(minutes)));
}

export function clampStopwatchMs(ms: number) {
  if (!Number.isFinite(ms)) {
    return 0;
  }

  return Math.min(STOPWATCH_MAX_MS, Math.max(0, ms));
}

export function getNextPomodoroStep(state: PomodoroState) {
  if (!state.enabled) {
    return null;
  }

  if (state.phase === "idle") {
    return { cycle: 1, phase: "work" as const, durationMs: POMODORO_WORK_MS };
  }

  if (state.phase === "work") {
    if (state.cycle >= state.totalCycles) {
      return { cycle: state.totalCycles, phase: "done" as const, durationMs: 0 };
    }

    return { cycle: state.cycle, phase: "break" as const, durationMs: POMODORO_BREAK_MS };
  }

  if (state.phase === "break") {
    return {
      cycle: Math.min(state.cycle + 1, state.totalCycles),
      phase: "work" as const,
      durationMs: POMODORO_WORK_MS,
    };
  }

  return null;
}

/**
 * Appends an alarm while enforcing the cap inside the update itself. A disabled
 * button only guards at render boundaries, so a burst of clicks would otherwise
 * queue several appends against the same state and overshoot the limit.
 */
export function appendAlarm(alarms: Alarm[], alarm: Alarm): Alarm[] {
  if (alarms.length >= ALARM_LIMIT) {
    return alarms;
  }

  return normalizeAlarms([...alarms, alarm]);
}

export function normalizeAlarms(alarms: Alarm[]): Alarm[] {
  return alarms.slice(0, ALARM_LIMIT).map((alarm) => ({
    ...alarm,
    hour: Math.min(23, Math.max(0, Math.round(alarm.hour) || 0)),
    minute: Math.min(59, Math.max(0, Math.round(alarm.minute) || 0)),
  }));
}

/**
 * Returns the alarm that should ring right now. Restricted to the first second
 * of the minute so a single alarm fires once instead of for 60 seconds.
 */
export function findDueAlarm(alarms: Alarm[], date: Date): Alarm | null {
  if (date.getSeconds() > 1) {
    return null;
  }

  return (
    alarms.find(
      (alarm) =>
        alarm.enabled && alarm.hour === date.getHours() && alarm.minute === date.getMinutes(),
    ) ?? null
  );
}
