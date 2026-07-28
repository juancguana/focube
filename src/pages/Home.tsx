import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import { flushSync } from "react-dom";
import {
  AlarmClock,
  BellOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Maximize2,
  Minimize2,
  Music,
  PictureInPicture2,
  Plus,
  RotateCcw,
  Share2,
  Smartphone,
  Timer,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import * as THREE from "three";
import SevenSegment from "@/components/SevenSegment";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { copy } from "@/copy";
import { createLedScreenTexture } from "@/utils/ledScreen";
import { drawSevenSegmentText, measureText } from "@/utils/sevenSegment";
import {
  FocusSoundscape,
  SOUNDSCAPES,
  type SoundscapeId,
} from "@/utils/focusAudio";
import {
  ALARM_LIMIT,
  CUSTOM_MAX_MINUTES,
  CUSTOM_MIN_MINUTES,
  FACE_CONFIGS,
  POMODORO_TOTAL_CYCLES,
  QUARTER_TURN,
  STOPWATCH_MAX_MS,
  TIP_ANGLES,
  type Alarm,
  type CubeColor,
  type CubeMode,
  type FaceConfig,
  type FaceId,
  type ModeFaceId,
  type ScreenTool,
  appendAlarm,
  clampCustomMinutes,
  clampStopwatchMs,
  dialStepForFace,
  faceForPose,
  findDueAlarm,
  formatCalendarDate,
  formatClockTime,
  formatDigitalTime,
  formatWeekday,
  getFaceById,
  getModeForFace,
  getNextPomodoroStep,
  nearestTip,
  orientationQuaternion,
  snapDialStep,
  tipForFace,
} from "@/utils/cube";
import {
  isStreakVisible,
  usePreferencesStore,
  type AlertType,
  type CubeFinish,
} from "@/stores/preferencesStore";
import { todayKey } from "@/utils/dates";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useUrlState } from "@/hooks/useUrlState";
import {
  getNotificationSupport,
  requestNotificationPermission,
  useNotifications,
} from "@/hooks/useNotifications";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type QuaternionTuple = [number, number, number, number];

/** `paused` mirrors the physical cube: screen up freezes, it does not cancel. */
type Paused = { paused?: boolean; remainingMs?: number };

type Session =
  | { kind: "idle" }
  | ({
      kind: "countdown";
      durationMs: number;
      endsAt: number;
      label: string;
      faceId: FaceId | null;
    } & Paused)
  | ({
      kind: "pomodoro";
      durationMs: number;
      endsAt: number;
      phase: "work" | "break";
      cycle: number;
    } & Paused);

const CUBE_PALETTES: Record<
  CubeColor,
  { name: string; body: string; shadow: string; ink: string }
> = {
  black: { name: "Negro", body: "#1c1e22", shadow: "#0c0e11", ink: "#f2f5f9" },
  white: { name: "Blanco", body: "#eeece6", shadow: "#c9c5bb", ink: "#20222a" },
  blue: { name: "Azul", body: "#5f7ff0", shadow: "#39519e", ink: "#f4f8ff" },
  lavender: {
    name: "Lavanda",
    body: "#c6bcf5",
    shadow: "#8a7fc4",
    ink: "#25233a",
  },
};

/**
 * Ring colours follow the physical dial: warm reds down the right side,
 * cool greens and cyans back up the left.
 */
const RING_SEGMENTS = [
  "#ff3b30",
  "#ff4f2a",
  "#ff6a26",
  "#ff8021",
  "#ff951d",
  "#ffa81a",
  "#ffbb18",
  "#fdcd1a",
  "#e8d420",
  "#c8d92b",
  "#a3d838",
  "#7ed24a",
  "#58c95d",
  "#3fbf74",
  "#2fb894",
  "#26b0b4",
  "#22a6cf",
  "#2b98e0",
  "#3f8ae8",
  "#4d7ef0",
];

const ACCENTS: Record<string, string> = {
  clock: "#4dd0e1",
  countdown: "#f4f7fb",
  work: "#ff6a3d",
  break: "#3ce79f",
  alert: "#ff4d4d",
};

/**
 * While a Pomodoro runs, the whole cube takes a distinct finish so the mode is
 * unmistakable at a glance: warm red for work, calm green for the break. It
 * overrides the chosen finish only for the duration of the session.
 */
const POMODORO_FINISH: Record<
  "work" | "break",
  { body: string; shadow: string; ink: string }
> = {
  work: { body: "#c43d2c", shadow: "#7d2116", ink: "#fff3f0" },
  break: { body: "#2f9e5f", shadow: "#1b5d38", ink: "#f0fff7" },
};

// ---------------------------------------------------------------------------
// Face textures
// ---------------------------------------------------------------------------

function createFaceTexture(face: FaceConfig, inkColor: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = inkColor;

  if (face.id === "pomodoro") {
    // Tomato glyph keeps its own colours so it reads on every cube finish.
    context.fillStyle = "#e8402a";
    context.beginPath();
    context.arc(512, 530, 188, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#3f9d4a";
    context.beginPath();
    context.ellipse(512, 330, 118, 44, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(512, 300, 30, 54, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = inkColor;
    context.textAlign = "center";
    context.font = '700 84px "Arial", system-ui, sans-serif';
    context.fillText("POMODORO", 512, 830);
    return finalizeTexture(canvas);
  }

  const digits = String(face.minutes ?? "");
  const digitHeight = 400;
  const totalWidth = measureText(digits, digitHeight, 40);
  const startX = 512 - totalWidth / 2 + 40;

  drawSevenSegmentText(context, digits, startX, 300, digitHeight, {
    color: inkColor,
    gap: 40,
  });

  // Vertical "MIN" tag to the left, like the printed cube face.
  context.save();
  context.translate(startX - 70, 500);
  context.rotate(-Math.PI / 2);
  context.textAlign = "center";
  context.font = '700 76px "Arial", system-ui, sans-serif';
  context.fillText("MIN", 0, 0);
  context.restore();

  return finalizeTexture(canvas);
}

function finalizeTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.anisotropy = 8;
  return texture;
}

function FaceDecal({
  face,
  texture,
}: {
  face: FaceConfig;
  texture: THREE.Texture | null;
}) {
  if (!texture) {
    return null;
  }

  return (
    <mesh position={face.position} rotation={face.rotation} renderOrder={2}>
      <planeGeometry args={[0.92, 0.92]} />
      <meshBasicMaterial
        alphaTest={0.05}
        map={texture}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Screen face
// ---------------------------------------------------------------------------

function LedRing({
  progressRatio,
  accent,
}: {
  progressRatio: number;
  accent: string;
}) {
  const normalized = Math.min(Math.max(progressRatio, 0), 1);

  const segments = useMemo(() => {
    const radius = 0.3;
    return RING_SEGMENTS.map((color, index) => {
      const angle = (index / RING_SEGMENTS.length) * Math.PI * 2;
      return {
        color,
        angle,
        position: [
          Math.sin(angle) * radius,
          Math.cos(angle) * radius,
          0.022,
        ] as [number, number, number],
      };
    });
  }, []);

  return (
    <group>
      {segments.map((segment, index) => {
        const lit = index / segments.length < normalized;
        const color = lit ? segment.color : "#171a20";

        return (
          <mesh
            key={`${segment.color}-${index}`}
            position={segment.position}
            rotation={[0, 0, -segment.angle]}
          >
            <boxGeometry args={[0.038, 0.076, 0.012]} />
            <meshStandardMaterial
              color={color}
              emissive={lit ? segment.color : accent}
              emissiveIntensity={lit ? 1.6 : 0.02}
              roughness={0.45}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

type ScreenContent = {
  primary: string;
  secondaryLabel: string;
  secondaryValue: string;
  caption: string;
  accent: string;
};

function CubeScreen({
  content,
  alarms,
  alertType,
  mode,
  alerting,
  paused,
  blinkOff,
  screenSpin,
  progressRatio,
}: {
  content: ScreenContent;
  alarms: Alarm[];
  alertType: AlertType;
  mode: CubeMode;
  alerting: boolean;
  paused: boolean;
  blinkOff: boolean;
  screenSpin: number;
  progressRatio: number;
}) {
  // Repainted only when the readout actually changes, not every frame.
  const texture = useMemo(
    () =>
      createLedScreenTexture({
        primary: content.primary,
        secondaryLabel: content.secondaryLabel,
        secondaryValue: content.secondaryValue,
        caption: content.caption,
        accent: content.accent,
        alarmCount: alarms.length,
        alarmsEnabled: [0, 1, 2].map((index) => Boolean(alarms[index]?.enabled)),
        muted: alertType === "silent",
        vibrate: alertType === "vibration",
        showHourglass: mode === "countdown",
        showTomato: mode === "pomodoro",
        dimPrimary: paused && blinkOff,
        alerting,
      }),
    [
      alarms,
      alertType,
      alerting,
      blinkOff,
      content.accent,
      content.caption,
      content.primary,
      content.secondaryLabel,
      content.secondaryValue,
      mode,
      paused,
    ],
  );

  useEffect(() => () => texture?.dispose(), [texture]);

  return (
    <group position={[0, 0, 0.588]} rotation={[0, 0, screenSpin]}>
      {/* The screen is baked into the texture (rounded, transparent margins) and
          drawn on a single flat plane — no geometry edge to cast a hard black
          line on light or coloured finishes. */}
      <LedRing accent={content.accent} progressRatio={progressRatio} />

      {texture ? (
        <mesh position={[0, 0, 0.018]}>
          <planeGeometry args={[0.86, 0.86]} />
          <meshBasicMaterial map={texture} toneMapped={false} transparent />
        </mesh>
      ) : null}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Cube
// ---------------------------------------------------------------------------

/** Green calyx + stem that sits on top of the cube during Pomodoro. */
function TomatoStem() {
  const leaves = [0, 1, 2, 3, 4];
  return (
    <group position={[0, 0.6, 0]}>
      <mesh position={[0, 0.09, 0]} rotation={[0, 0, 0.14]}>
        <cylinderGeometry args={[0.022, 0.03, 0.16, 8]} />
        <meshStandardMaterial color="#5c7d34" roughness={0.7} />
      </mesh>
      {leaves.map((index) => {
        const angle = (index / leaves.length) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[Math.sin(angle) * 0.12, 0.01, Math.cos(angle) * 0.12]}
            rotation={[Math.PI / 2.6, angle, 0]}
          >
            <coneGeometry args={[0.055, 0.2, 4]} />
            <meshStandardMaterial color="#4a9a3f" roughness={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

function FocubeCube({
  quaternion,
  bodyColor,
  shadowColor,
  inkColor,
  settleToken,
  alerting,
  reducedMotion,
  tomato,
  screenProps,
  onPickFace,
  onHoverFace,
}: {
  quaternion: QuaternionTuple;
  bodyColor: string;
  shadowColor: string;
  inkColor: string;
  settleToken: number;
  alerting: boolean;
  reducedMotion: boolean;
  tomato: boolean;
  screenProps: Omit<Parameters<typeof CubeScreen>[0], "alerting">;
  onPickFace: (faceId: FaceId) => void;
  onHoverFace: (faceId: FaceId | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetQuaternion = useMemo(
    () => new THREE.Quaternion(...quaternion),
    [quaternion],
  );

  const faceTextures = useMemo(() => {
    const entries = FACE_CONFIGS.filter((face) => face.id !== "screen").map(
      (face) => [face.id, createFaceTexture(face, inkColor)],
    );

    return Object.fromEntries(entries) as Record<
      ModeFaceId,
      THREE.Texture | null
    >;
  }, [inkColor]);

  const springStartRef = useRef(new THREE.Quaternion());
  const springRef = useRef({ value: 1, velocity: 0 });
  const springActiveRef = useRef(false);
  const lastTokenRef = useRef(settleToken);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    if (settleToken !== lastTokenRef.current) {
      lastTokenRef.current = settleToken;
      springStartRef.current.copy(group.quaternion);
      springRef.current = { value: 0, velocity: 0 };
      springActiveRef.current = true;
    }

    // Reduced motion: land on the face without the travel, and hold a steady
    // scale so the alarm never pulses.
    if (reducedMotion) {
      springActiveRef.current = false;
      group.quaternion.copy(targetQuaternion);
      group.scale.set(1, 1, 1);
      return;
    }

    if (springActiveRef.current) {
      const settle = springRef.current;
      settle.value = Math.min(1, settle.value + delta / SETTLE_SECONDS);

      if (settle.value >= 1) {
        springActiveRef.current = false;
        group.quaternion.copy(targetQuaternion);
      } else {
        // Ease-out cubic: firm, lands once, no wobble to second-guess.
        const t = 1 - Math.pow(1 - settle.value, 3);
        group.quaternion
          .copy(springStartRef.current)
          .slerp(targetQuaternion, t);
      }
    } else {
      group.quaternion.slerp(targetQuaternion, 1 - Math.exp(-delta * 16));
    }

    const pulse = alerting
      ? 1 + Math.sin(state.clock.elapsedTime * 12) * 0.028
      : 1;
    group.scale.lerp(
      new THREE.Vector3(pulse, pulse, pulse),
      1 - Math.exp(-delta * 9),
    );
  });

  return (
    <group ref={groupRef}>
      {/* Rounder during Pomodoro so the red cube reads as a tomato. Keyed so
          the geometry rebuilds when the radius changes. */}
      <RoundedBox
        key={tomato ? "tomato" : "cube"}
        args={[1.2, 1.2, 1.2]}
        castShadow
        receiveShadow
        // Rounder for the tomato, but not so round the flat front shrinks away
        // and the screen loses contact with the surface.
        radius={tomato ? 0.3 : 0.22}
        smoothness={10}
      >
        <meshStandardMaterial
          color={bodyColor}
          // Only glow on the alarm pulse; a steady shadow-tinted emissive made
          // light finishes look dull and dirty.
          emissive={alerting ? ACCENTS.alert : shadowColor}
          emissiveIntensity={alerting ? 0.22 : 0}
          metalness={0.04}
          roughness={0.62}
        />
      </RoundedBox>

      {tomato ? <TomatoStem /> : null}

      {FACE_CONFIGS.filter((face) => face.id !== "screen").map((face) => (
        <FaceDecal
          key={face.id}
          face={face}
          texture={faceTextures[face.id as ModeFaceId]}
        />
      ))}

      <CubeScreen {...screenProps} alerting={alerting} />

      {/* Invisible hit targets: clicking a face you can see brings it up. */}
      {FACE_CONFIGS.map((face) => (
        <mesh
          key={`pick-${face.id}`}
          onClick={(event) => {
            event.stopPropagation();
            onPickFace(face.id);
          }}
          onPointerOver={() => onHoverFace(face.id)}
          onPointerOut={() => onHoverFace(null)}
          position={face.position}
          rotation={face.rotation}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial depthWrite={false} opacity={0} transparent />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Three-note chime that closes a session. Shared by the real alert and the
 * "Probar alarma" preview so what you hear is exactly what will ring.
 */
function playChime(context: AudioContext) {
  const startAt = context.currentTime;

  [0, 0.24, 0.48].forEach((offset, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = index === 1 ? "square" : "sine";
    oscillator.frequency.setValueAtTime(880 - index * 130, startAt + offset);

    gain.gain.setValueAtTime(0.0001, startAt + offset);
    gain.gain.exponentialRampToValueAtTime(0.2, startAt + offset + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.2);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt + offset);
    oscillator.stop(startAt + offset + 0.26);
  });
}

const VIBRATION_PATTERN = [220, 120, 220, 120, 320];

/** What landing on a face will actually do, phrased as an outcome. */
function describeFace(faceId: FaceId) {
  if (faceId === "screen") {
    return `${copy.chips.reloj} / ${String(getFaceById("five")?.minutes)} min`;
  }

  if (faceId === "pomodoro") {
    return `${copy.controls.pomodoro} 25/5`;
  }

  return `${getFaceById(faceId)?.minutes} min`;
}

/** Destination name for a control (Pomodoro is an action, not a real face). */
function faceName(faceId: FaceId) {
  return faceId === "pomodoro"
    ? copy.controls.pomodoro
    : (getFaceById(faceId)?.label ?? copy.panel.faceUnknown);
}

/** Short outcome line for a control, without repeating the face name. */
function faceActionLabel(faceId: FaceId) {
  if (faceId === "screen") {
    return copy.panel.pauseAction;
  }

  if (faceId === "pomodoro") {
    return copy.panel.pomodoroAction;
  }

  return `${getFaceById(faceId)?.minutes} min`;
}

type Direction = {
  id: "up" | "down" | "left" | "right";
  icon: JSX.Element;
  target: FaceId;
};

/**
 * Directional pad around the cube. Each arrow names the face it will bring up
 * and what that face does, so the move is known before it is made — the drag
 * left that as a guess until release.
 */
function CubeControls({
  directions,
  topFaceId,
  onActivate,
  compact = false,
  highlight = false,
}: {
  directions: Direction[];
  topFaceId: FaceId;
  onActivate: (faceId: FaceId) => void;
  compact?: boolean;
  /** First visit: the arrows pulse so the one gesture that matters is obvious. */
  highlight?: boolean;
}) {
  return (
    <div
      className={`tk-dpad${compact ? " is-compact" : ""}${highlight ? " is-highlighted" : ""}`}
    >
      {directions.map((direction) => {
        const isCurrent = direction.target === topFaceId;
        return (
          <button
            key={direction.id}
            className={`tk-dpad__btn tk-dpad__btn--${direction.id}${isCurrent ? " is-current" : ""}`}
            // data-face lets a native listener drive these in the PiP window,
            // where React's delegated events (bound to the main document) never
            // fire.
            data-face={direction.target}
            disabled={isCurrent}
            onClick={() => onActivate(direction.target)}
            type="button"
          >
            <span className="tk-dpad__arrow">{direction.icon}</span>
            <span className="tk-dpad__face">{faceName(direction.target)}</span>
            <small className="tk-dpad__action">{faceActionLabel(direction.target)}</small>
          </button>
        );
      })}
    </div>
  );
}

const MODE_FACES = FACE_CONFIGS.filter(
  (face) => face.id !== "screen" && face.id !== "pomodoro",
) as Array<FaceConfig & { id: ModeFaceId; minutes: number }>;

/** A quarter turn costs this many pixels of horizontal drag. */
const DIAL_PIXELS_PER_QUARTER = 150;
const TIP_PIXELS_PER_DETENT = 130;
/** Movement needed before a drag commits to being a turn or a tip. */
const AXIS_LOCK_THRESHOLD = 7;
/** Settle duration, inside the 300-500ms window that reads as deliberate. */
const SETTLE_SECONDS = 0.38;

type Pose = { dialAngle: number; tipAngle: number };

export default function Home() {
  // Store-driven preferences
  const cubeFinish = usePreferencesStore((s) => s.cubeFinish);
  const setCubeFinish = usePreferencesStore((s) => s.setCubeFinish);
  const alertType = usePreferencesStore((s) => s.alertType);
  const setAlertType = usePreferencesStore((s) => s.setAlertType);
  const soundscape = usePreferencesStore((s) => s.soundscape);
  const setSoundscape = usePreferencesStore((s) => s.setSoundscape);
  const customMinutesStore = usePreferencesStore((s) => s.customMinutes);
  const setCustomMinutesStore = usePreferencesStore((s) => s.setCustomMinutes);
  const alarms = usePreferencesStore((s) => s.alarms);
  const hasSeenOnboarding = usePreferencesStore((s) => s.hasSeenOnboarding);
  const markOnboardingSeen = usePreferencesStore((s) => s.markOnboardingSeen);
  const updateAlarmStore = usePreferencesStore((s) => s.updateAlarm);
  const setAlarms = usePreferencesStore((s) => s.setAlarms);
  const incrementDailySession = usePreferencesStore(
    (s) => s.incrementDailySession,
  );
  const panelSectionsCollapsed = usePreferencesStore(
    (s) => s.panelSectionsCollapsed,
  );
  const togglePanelSectionCollapsed = usePreferencesStore(
    (s) => s.togglePanelSectionCollapsed,
  );
  const dailySessions = usePreferencesStore((s) => s.dailySessions);
  const streakDays = usePreferencesStore((s) => s.streakDays);
  const streakHiddenDate = usePreferencesStore((s) => s.streakHiddenDate);
  const hideStreakForToday = usePreferencesStore(
    (s) => s.hideStreakForToday,
  );
  const markFirstVisit = usePreferencesStore((s) => s.markFirstVisit);
  const notificationsEnabled = usePreferencesStore(
    (s) => s.notificationsEnabled,
  );
  const setNotificationsEnabled = usePreferencesStore(
    (s) => s.setNotificationsEnabled,
  );

  const reducedMotion = useReducedMotion();
  const notificationsSupported = getNotificationSupport() !== "unsupported";

  const [pose, setPose] = useState<Pose>({
    dialAngle: 0,
    tipAngle: TIP_ANGLES.clock,
  });
  const [topFaceId, setTopFaceId] = useState<FaceId>("screen");
  /** Remembered dial-ring face, so the arrows and untip know where "back" is. */
  const [dialFaceId, setDialFaceId] = useState<FaceId>("five");
  const [hoverFaceId, setHoverFaceId] = useState<FaceId | null>(null);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [settleToken, setSettleToken] = useState(0);

  const [session, setSession] = useState<Session>({ kind: "idle" });
  const [alertUntil, setAlertUntil] = useState(0);
  /** The last completed session: drives the celebration and the notification. */
  const [completion, setCompletion] = useState<{
    at: number;
    message: string;
    notification: string;
  } | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  /** `?mode=pomodoro` deep link: highlights the CTA instead of posing the
   * cube — posing would misleadingly show the "5 min" face. Cleared on the
   * first `activateFace` or after 8s. */
  const [pomodoroSuggested, setPomodoroSuggested] = useState(false);
  /** Live for as long as the cube is easing into place — see `settleUntil`. */
  const [settleUntil, setSettleUntil] = useState(0);

  const [screenTool, setScreenTool] = useState<ScreenTool>("clock");
  const [stopwatch, setStopwatch] = useState({
    running: false,
    startedAt: 0,
    accumulatedMs: 0,
  });

  const [now, setNow] = useState(() => Date.now());
  const [dragging, setDragging] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [liveMessage, setLiveMessage] = useState<string>(copy.states.idle);

  const sceneShellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    active: false,
    axis: null as "dial" | "tip" | null,
    startX: 0,
    startY: 0,
    startPose: { dialAngle: 0, tipAngle: TIP_ANGLES.clock } as Pose,
  });
  const dialMemoryRef = useRef(0);
  const committedTipRef = useRef(TIP_ANGLES.clock);
  const pipSceneRef = useRef<HTMLDivElement>(null);
  const pipSlotRef = useRef<HTMLDivElement>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const activateFaceRef = useRef<(faceId: FaceId) => void>(() => {});
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundscapeRef = useRef<FocusSoundscape | null>(null);
  const firedAlarmRef = useRef<string | null>(null);
  const completionRef = useRef<number | null>(null);
  const previewRef = useRef<FocusSoundscape | null>(null);
  const previewTimersRef = useRef<number[]>([]);

  const alerting = now < alertUntil;
  /** Drives the paused blink; the screen is a texture, so it needs a tick. */
  const blinkOff = Math.floor(now / 550) % 2 === 1;
  // Pomodoro is a session, not a face, so it overrides the face-derived mode.
  const mode: CubeMode =
    session.kind === "pomodoro" ? "pomodoro" : getModeForFace(topFaceId);
  // The mode reported to useUrlState for the shareable link (P1.2/Slice B):
  // `null` while resting on the clock face, otherwise the current face/session.
  const currentMode: ModeFaceId | null =
    session.kind === "pomodoro"
      ? "pomodoro"
      : topFaceId === "screen"
        ? null
        : topFaceId;
  const currentDate = useMemo(() => new Date(now), [now]);

  // The active finish: the chosen colour normally, or the Pomodoro finish while
  // a Pomodoro runs so the whole cube signals work (red) vs break (green).
  const finish =
    session.kind === "pomodoro"
      ? POMODORO_FINISH[session.phase]
      : CUBE_PALETTES[cubeFinish];

  /** Where the cube would land if you let go right now. */
  const previewFaceId = faceForPose(
    snapDialStep(pose.dialAngle),
    nearestTip(pose.tipAngle),
  );
  const quaternion = useMemo<QuaternionTuple>(() => {
    const q = orientationQuaternion(pose.dialAngle, pose.tipAngle);
    return [q.x, q.y, q.z, q.w];
  }, [pose.dialAngle, pose.tipAngle]);

  // Arrow targets: left/right step the dial ring from the remembered position,
  // up is always Reloj (pause), down is always 60.
  const dialBase = dialStepForFace(dialFaceId);
  const directions = useMemo<Direction[]>(
    () => [
      { id: "up", icon: <ChevronUp size={20} />, target: "screen" },
      { id: "left", icon: <ChevronLeft size={20} />, target: faceForPose(dialBase - 1, "none") },
      { id: "right", icon: <ChevronRight size={20} />, target: faceForPose(dialBase + 1, "none") },
      { id: "down", icon: <ChevronDown size={20} />, target: "pomodoro" },
    ],
    [dialBase],
  );

  const remainingMs =
    session.kind === "idle"
      ? 0
      : session.paused
        ? // Frozen: reading endsAt while paused would keep draining the display.
          (session.remainingMs ?? 0)
        : Math.max(0, session.endsAt - now);
  const progressRatio =
    session.kind === "idle" || session.durationMs === 0
      ? 0
      : remainingMs / session.durationMs;

  const stopwatchMs = clampStopwatchMs(
    stopwatch.accumulatedMs +
      (stopwatch.running ? now - stopwatch.startedAt : 0),
  );

  // -- audio / haptics ------------------------------------------------------

  const armAudioContext = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }

    if (audioContextRef.current?.state === "suspended") {
      void audioContextRef.current.resume();
    }
  }, []);

  const fireAlert = useCallback(
    (message: string) => {
      setAlertUntil(Date.now() + 4200);
      setLiveMessage(message);

      if (alertType === "vibration") {
        navigator.vibrate?.(VIBRATION_PATTERN);
        return;
      }

      if (alertType === "silent") {
        return;
      }

      armAudioContext();
      const context = audioContextRef.current;
      if (context) {
        playChime(context);
      }
    },
    [alertType, armAudioContext],
  );

  /** Plays the alert exactly as it will ring, without waiting for a session. */
  const previewAlert = useCallback(() => {
    if (alertType === "vibration") {
      navigator.vibrate?.(VIBRATION_PATTERN);
      return;
    }

    armAudioContext();
    const context = audioContextRef.current;
    if (context) {
      playChime(context);
    }
  }, [alertType, armAudioContext]);

  // -- orientation ----------------------------------------------------------

  const startCountdownMinutes = useCallback(
    (minutes: number, label: string, faceId: FaceId | null) => {
      const durationMs = minutes * 60 * 1000;
      completionRef.current = null;
      setSession({
        kind: "countdown",
        durationMs,
        endsAt: Date.now() + durationMs,
        label,
        faceId,
      });
    },
    [],
  );

  const moveToFace = useCallback((faceId: FaceId) => {
    setPose((current) => {
      const tip = tipForFace(faceId);

      if (tip !== "none") {
        // Square the dial while tipped. Carrying a quarter turn into a tipped
        // pose left the cube sitting on a diagonal instead of on a detent.
        // The chosen number is remembered so tipping back restores it.
        dialMemoryRef.current = snapDialStep(current.dialAngle);
        return { dialAngle: 0, tipAngle: TIP_ANGLES[tip] };
      }

      // Turn to the target along the shortest path instead of unwinding.
      const currentStep = snapDialStep(current.dialAngle);
      const targetStep = dialStepForFace(faceId);
      let delta = (targetStep - currentStep) % 4;
      if (delta > 2) delta -= 4;
      if (delta < -2) delta += 4;

      return {
        dialAngle: (currentStep + delta) * QUARTER_TURN,
        tipAngle: TIP_ANGLES.none,
      };
    });

    committedTipRef.current = TIP_ANGLES[tipForFace(faceId)];
    if (tipForFace(faceId) === "none") {
      dialMemoryRef.current = dialStepForFace(faceId);
      setDialFaceId(faceId);
    }

    setSettleToken((token) => token + 1);
    // Keeps the render loop awake just long enough for the cube to land.
    setSettleUntil(Date.now() + SETTLE_SECONDS * 1000 + 120);
    setTopFaceId(faceId);
  }, []);

  /**
   * Landing a face on top drives everything, like the gravity sensor.
   * The screen face pauses rather than cancels — returning to the same face
   * resumes, matching the physical cube.
   */
  const activateFace = useCallback(
    (faceId: FaceId) => {
      armAudioContext();
      // Any first move — arrow, drag, click or key — retires the hint.
      markOnboardingSeen();
      // Any gesture also retires a `?mode=pomodoro` deep-link suggestion.
      setPomodoroSuggested(false);

      // Pomodoro is an action, not a face: it runs the cycle and shows the 5
      // pose, mirroring the physical cube's "put 5 up and long-press".
      if (faceId === "pomodoro") {
        moveToFace("five");
        setSession((current) => {
          if (current.kind === "pomodoro" && current.paused) {
            setLiveMessage(copy.timer.pomodoroResumed);
            return {
              ...current,
              paused: false,
              endsAt: Date.now() + (current.remainingMs ?? 0),
            };
          }

          setLiveMessage(copy.timer.pomodoroStart(1, POMODORO_TOTAL_CYCLES));
          const step = getNextPomodoroStep({
            enabled: true,
            cycle: 0,
            phase: "idle",
            totalCycles: POMODORO_TOTAL_CYCLES,
          });
          completionRef.current = null;
          return step
            ? {
                kind: "pomodoro" as const,
                durationMs: step.durationMs,
                endsAt: Date.now() + step.durationMs,
                phase: "work" as const,
                cycle: step.cycle,
              }
            : current;
        });
        return;
      }

      const face = getFaceById(faceId);
      if (!face) {
        return;
      }

      moveToFace(faceId);

      // Screen up pauses whatever is running, like the physical cube.
      if (faceId === "screen") {
        setSession((current) => {
          if (current.kind === "idle" || current.paused) {
            return current;
          }

          setLiveMessage(copy.timer.paused);
          return {
            ...current,
            paused: true,
            remainingMs: Math.max(0, current.endsAt - Date.now()),
          };
        });
        return;
      }

      setSession((current) => {
        // Coming back to the face that was paused resumes it.
        if (
          current.kind === "countdown" &&
          current.paused &&
          current.faceId === faceId
        ) {
          setLiveMessage(copy.timer.resumed(face.label));
          return {
            ...current,
            paused: false,
            endsAt: Date.now() + (current.remainingMs ?? 0),
          };
        }

        setLiveMessage(copy.timer.started(face.minutes ?? 0));
        completionRef.current = null;
        return {
          kind: "countdown" as const,
          durationMs: (face.minutes ?? 0) * 60 * 1000,
          endsAt: Date.now() + (face.minutes ?? 0) * 60 * 1000,
          label: `${face.minutes} min`,
          faceId,
        };
      });
    },
    [armAudioContext, markOnboardingSeen, moveToFace],
  );

  // Keep the PiP native listener pointing at the current activateFace.
  activateFaceRef.current = activateFace;

  /** Snaps the live pose to its detents and commits whatever landed on top. */
  const commitPose = useCallback(() => {
    const tip = nearestTip(pose.tipAngle);
    // Coming back down from a tipped pose returns to the number you had
    // chosen, rather than resetting the dial to its first position.
    const wasTipped = nearestTip(committedTipRef.current) !== "none";
    const step =
      tip === "none" && wasTipped
        ? dialMemoryRef.current
        : snapDialStep(pose.dialAngle);

    activateFace(faceForPose(step, tip));
  }, [activateFace, pose.dialAngle, pose.tipAngle]);

  /** Steps the dial by whole quarter turns — used by the arrow keys. */
  const stepDial = useCallback(
    (direction: number) => {
      const base =
        nearestTip(pose.tipAngle) === "none"
          ? snapDialStep(pose.dialAngle)
          : dialMemoryRef.current;

      activateFace(faceForPose(base + direction, "none"));
    },
    [activateFace, pose.dialAngle, pose.tipAngle],
  );

  // -- ticking --------------------------------------------------------------

  // Write-once first-visit marker, feeds days_since_first_visit later.
  useEffect(() => {
    markFirstVisit();
  }, [markFirstVisit]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  /** Countdown reaching zero: alert, then advance pomodoro or fall back to clock. */
  useEffect(() => {
    if (session.kind === "idle" || session.paused || remainingMs > 0) {
      return;
    }

    if (completionRef.current === session.endsAt) {
      return;
    }

    completionRef.current = session.endsAt;
    const at = Date.now();

    if (session.kind === "pomodoro") {
      const step = getNextPomodoroStep({
        enabled: true,
        cycle: session.cycle,
        phase: session.phase,
        totalCycles: POMODORO_TOTAL_CYCLES,
      });

      if (!step || step.phase === "done") {
        setCompletion({
          at,
          message: copy.timer.pomodoroDone,
          notification: copy.notifications.pomodoroDone,
        });
        fireAlert(copy.timer.pomodoroDone);
        incrementDailySession();
        setSession({ kind: "idle" });
        moveToFace("screen");
        return;
      }

      const isBreak = step.phase !== "work";
      const phaseName = isBreak ? copy.timer.rest : copy.timer.work;

      setCompletion({
        at,
        // A finished work block is the win worth celebrating; the break that
        // follows is announced, not applauded.
        message: isBreak
          ? copy.timer.break(step.cycle, POMODORO_TOTAL_CYCLES)
          : copy.timer.pomodoroStart(step.cycle, POMODORO_TOTAL_CYCLES),
        notification: copy.notifications.phaseComplete(phaseName),
      });
      fireAlert(
        isBreak
          ? copy.timer.break(step.cycle, POMODORO_TOTAL_CYCLES)
          : copy.timer.pomodoroStart(step.cycle, POMODORO_TOTAL_CYCLES),
      );
      if (isBreak) {
        // Only completed work blocks count as focus sessions.
        incrementDailySession();
      }
      setSession({
        kind: "pomodoro",
        durationMs: step.durationMs,
        endsAt: Date.now() + step.durationMs,
        phase: isBreak ? "break" : "work",
        cycle: step.cycle,
      });
      return;
    }

    setCompletion({
      at,
      message: copy.timer.countdownDone,
      notification: copy.notifications.countdownDone,
    });
    fireAlert(copy.timer.countdownDone);
    incrementDailySession();
    setSession({ kind: "idle" });

    window.setTimeout(() => moveToFace("screen"), 2600);
  }, [fireAlert, incrementDailySession, moveToFace, remainingMs, session]);

  /** Daily alarms ring regardless of the face that is currently up. */
  useEffect(() => {
    const due = findDueAlarm(alarms, currentDate);
    const key = due
      ? `${due.id}-${currentDate.getHours()}-${currentDate.getMinutes()}`
      : null;

    if (due && key && firedAlarmRef.current !== key) {
      firedAlarmRef.current = key;
      fireAlert(copy.notifications.alarm(formatClockTime(currentDate)));
    }
  }, [alarms, currentDate, fireAlert]);

  // Both focus mode and the mini player are "focus"; the ambience follows them.
  const focusActive = isFocusMode || isMiniPlayer;
  /**
   * The render loop only runs free while something is actually moving: a live
   * session, a drag, the alarm pulse or a cube still settling. At rest the
   * canvas repaints on demand — React commits (a new clock texture) still
   * invalidate it, so nothing goes stale (P2.4).
   */
  const needsContinuousRender =
    !reducedMotion &&
    ((session.kind !== "idle" && !session.paused) ||
      dragging ||
      alerting ||
      now < settleUntil);

  /** The soundscape is the point of focus mode, so it follows that state. */
  useEffect(() => {
    if (!focusActive) {
      soundscapeRef.current?.setMode("off");
      return;
    }

    armAudioContext();
    const context = audioContextRef.current;
    if (!context) {
      return;
    }

    if (!soundscapeRef.current) {
      soundscapeRef.current = new FocusSoundscape(context);
    }

    soundscapeRef.current.setMode(soundscape);
  }, [armAudioContext, focusActive, soundscape]);

  useEffect(() => {
    return () => {
      soundscapeRef.current?.dispose();
      pipWindowRef.current?.close();
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  // -- screen content -------------------------------------------------------

  const screenContent = useMemo<ScreenContent>(() => {
    if (session.kind === "pomodoro") {
      return {
        primary: formatDigitalTime(remainingMs),
        secondaryLabel: session.phase === "work" ? "WK" : "BR",
        secondaryValue: `0${session.cycle}:0${POMODORO_TOTAL_CYCLES}`,
        caption: session.phase === "work" ? copy.panel.work : copy.panel.break,
        accent: alerting ? ACCENTS.alert : ACCENTS[session.phase],
      };
    }

    if (session.kind === "countdown") {
      return {
        primary: formatDigitalTime(remainingMs),
        secondaryLabel: formatWeekday(currentDate),
        secondaryValue: formatClockTime(currentDate),
        caption: session.label,
        accent: alerting ? ACCENTS.alert : ACCENTS.countdown,
      };
    }

    if (screenTool === "stopwatch" && (stopwatch.running || stopwatchMs > 0)) {
      return {
        primary: formatDigitalTime(stopwatchMs),
        secondaryLabel: formatWeekday(currentDate),
        secondaryValue: formatClockTime(currentDate),
        caption: copy.panel.stopwatch,
        accent: alerting ? ACCENTS.alert : ACCENTS.clock,
      };
    }

    return {
      primary: formatClockTime(currentDate),
      secondaryLabel: formatWeekday(currentDate),
      secondaryValue: formatCalendarDate(currentDate),
      caption: copy.panel.clock,
      accent: alerting ? ACCENTS.alert : ACCENTS.clock,
    };
  }, [
    alerting,
    currentDate,
    remainingMs,
    screenTool,
    session,
    stopwatch.running,
    stopwatchMs,
  ]);

  /** The readout is segments, so screen readers get it as prose in context. */
  const readoutLabel =
    session.kind !== "idle"
      ? copy.aria.readout(screenContent.primary, screenContent.caption)
      : screenTool === "stopwatch" && (stopwatch.running || stopwatchMs > 0)
        ? copy.aria.readoutStopwatch(screenContent.primary)
        : copy.aria.readoutClock(screenContent.primary);

  // At rest the dial sits fully lit like the physical clock; a running session
  // drains it, and the stopwatch sweeps it once per minute.
  const ringRatio =
    session.kind === "idle"
      ? screenTool === "stopwatch" && stopwatchMs > 0
        ? (stopwatchMs % 60_000) / 60_000
        : 1
      : progressRatio;

  // -- controls -------------------------------------------------------------

  const toggleFocusMode = useCallback(async () => {
    const next = !isFocusMode;
    flushSync(() => setIsFocusMode(next));

    try {
      if (!next && document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (next) {
        await sceneShellRef.current?.requestFullscreen?.();
      }
    } catch {
      // Visual focus mode still applies without real fullscreen.
    }
  }, [isFocusMode]);

  const pipSupported =
    typeof window !== "undefined" && "documentPictureInPicture" in window;

  const closeMiniPlayer = useCallback(() => {
    const pip = pipWindowRef.current;
    pipWindowRef.current = null;
    // Return the live scene to its slot before React reconciles the subtree.
    if (pipSceneRef.current && pipSlotRef.current) {
      pipSlotRef.current.appendChild(pipSceneRef.current);
    }
    setIsMiniPlayer(false);
    pip?.close();
  }, []);

  const openMiniPlayer = useCallback(async () => {
    const api = (
      window as typeof window & {
        documentPictureInPicture?: {
          requestWindow: (options?: {
            width?: number;
            height?: number;
          }) => Promise<Window>;
        };
      }
    ).documentPictureInPicture;

    if (!api || !pipSceneRef.current) {
      return;
    }

    armAudioContext();
    const pip = await api.requestWindow({ width: 340, height: 480 });
    pipWindowRef.current = pip;

    // The PiP window starts blank; carry over our stylesheets.
    document
      .querySelectorAll('style, link[rel="stylesheet"]')
      .forEach((node) => pip.document.head.appendChild(node.cloneNode(true)));
    pip.document.body.classList.add("tk-pip-body");

    // Move the actual canvas — a captured stream could not host the controls.
    pip.document.body.appendChild(pipSceneRef.current);
    setIsMiniPlayer(true);

    // React's synthetic events are bound to the main document, so clicks in the
    // PiP window never reach the onClick handlers. A native delegated listener
    // on the PiP document drives the arrows instead.
    pip.document.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest("[data-face]");
      const face = button?.getAttribute("data-face");
      if (face) {
        activateFaceRef.current(face as FaceId);
      }
    });

    pip.addEventListener("pagehide", closeMiniPlayer, { once: true });
  }, [armAudioContext, closeMiniPlayer]);

  const resetAll = useCallback(() => {
    setSession({ kind: "idle" });
    setAlertUntil(0);
    setStopwatch({ running: false, startedAt: 0, accumulatedMs: 0 });
    activateFace("screen");
    setLiveMessage(copy.timer.reset);
  }, [activateFace]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const key = event.key.toLowerCase();
      const byKey: Record<string, FaceId> = {
        "5": "five",
        "1": "ten",
        "3": "thirty",
        "6": "sixty",
        p: "pomodoro",
        c: "screen",
      };

      if (byKey[key]) {
        event.preventDefault();
        activateFace(byKey[key]);
        return;
      }

      // Arrows drive the dial the same way the drag does.
      if (key === "arrowright") {
        event.preventDefault();
        stepDial(1);
        return;
      }

      if (key === "arrowleft") {
        event.preventDefault();
        stepDial(-1);
        return;
      }

      if (key === "f") {
        event.preventDefault();
        void toggleFocusMode();
        return;
      }

      if (key === "r") {
        event.preventDefault();
        resetAll();
      }
    },
    [activateFace, resetAll, stepDial, toggleFocusMode],
  );

  const updateAlarm = useCallback(
    (id: string, patch: Partial<Alarm>) => {
      updateAlarmStore(id, patch);
    },
    [updateAlarmStore],
  );

  useDocumentTitle(
    remainingMs,
    session.kind === "idle" ? null : mode,
    session.kind !== "idle" && Boolean(session.paused),
    session.kind === "idle",
  );

  // URL deep link state (P1.2 / Slice B: ?mode=... preselect)
  const { getShareableUrl, sharedMode } = useUrlState(currentMode);

  // Apply an incoming `?mode=...` link once on mount. A shared link only
  // preselects: it never starts a timer and never touches the AudioContext.
  // `pomodoro` is special — `activateFace("pomodoro")` poses the "five" face
  // internally, so posing it here would misleadingly read as "5 min";
  // instead we just highlight the CTA.
  useEffect(() => {
    if (sharedMode === null) return;

    if (sharedMode === "pomodoro") {
      setPomodoroSuggested(true);
      const timeout = window.setTimeout(
        () => setPomodoroSuggested(false),
        8000,
      );
      return () => window.clearTimeout(timeout);
    }

    moveToFace(sharedMode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Browser notifications when a session ends and the tab is hidden (P1.3)
  useNotifications(
    notificationsEnabled,
    completion?.at ?? null,
    completion?.notification ?? "",
  );

  const topFace = getFaceById(topFaceId);

  const dismissCelebration = useCallback(() => {
    setCompletion(null);
  }, []);

  /** Turning the toggle on is the moment the permission prompt earns itself. */
  const toggleNotifications = useCallback(async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      return;
    }

    const permission = await requestNotificationPermission();
    setNotificationsEnabled(permission === "granted");
    if (permission === "denied") {
      setLiveMessage(copy.controls.notifyDenied);
    }
  }, [notificationsEnabled, setNotificationsEnabled]);

  const shareSetup = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(getShareableUrl());
      setShareCopied(true);
      setLiveMessage(copy.controls.shareMessage);
      window.setTimeout(() => setShareCopied(false), 2200);
    } catch {
      // Clipboard denied: the URL bar already carries the same setup.
    }
  }, [getShareableUrl]);

  // Sound previews are transient objects; leaving the page must not strand one
  // playing in the audio graph.
  useEffect(() => {
    return () => {
      previewTimersRef.current.forEach((id) => window.clearTimeout(id));
      previewRef.current?.dispose();
    };
  }, []);

  const previewSoundscape = useCallback(
    (id: SoundscapeId) => {
      armAudioContext();
      const context = audioContextRef.current;
      if (!context) {
        return;
      }

      // A second click restarts the preview instead of stacking a new layer.
      previewTimersRef.current.forEach((timerId) =>
        window.clearTimeout(timerId),
      );
      previewTimersRef.current = [];
      previewRef.current?.dispose();

      const preview = new FocusSoundscape(context);
      previewRef.current = preview;
      preview.setMode(id);

      previewTimersRef.current.push(
        window.setTimeout(() => {
          preview.setMode("off");
          // Let the fade finish before tearing the nodes down.
          previewTimersRef.current.push(
            window.setTimeout(() => {
              preview.dispose();
              if (previewRef.current === preview) {
                previewRef.current = null;
              }
            }, 300),
          );
        }, 2500),
      );
    },
    [armAudioContext],
  );

  return (
    <main className={`tk-app${isFocusMode ? " is-focus" : ""}`}>
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <section className="tk-hero">
        <span className="tk-eyebrow">{copy.hero.eyebrow}</span>
        <h1>{copy.hero.title}</h1>
        <p>{copy.hero.subtitle}</p>
      </section>

      {!hasSeenOnboarding ? (
        <OnboardingOverlay
          onStartTimer={() => {
            markOnboardingSeen();
            activateFace("pomodoro");
          }}
        />
      ) : null}

      <CelebrationOverlay
        startedAt={completion?.at ?? 0}
        message={completion?.message}
        onDismiss={dismissCelebration}
      />

      <section className="tk-layout">
        <div
          ref={sceneShellRef}
          aria-label={copy.aria.cube}
          className={`tk-stage${dragging ? " is-dragging" : ""}${isFocusMode ? " is-fullscreen" : ""}`}
          role="group"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onPointerDown={(event) => {
            // Overlaid controls and the 3D face pickers keep their own clicks.
            if ((event.target as HTMLElement).closest("button, input, a")) {
              return;
            }

            armAudioContext();
            dragRef.current = {
              active: true,
              axis: null,
              startX: event.clientX,
              startY: event.clientY,
              startPose: pose,
            };
            setDragging(true);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag.active) {
              return;
            }

            const deltaX = event.clientX - drag.startX;
            const deltaY = event.clientY - drag.startY;

            // Lock to one axis so a gesture is either a turn or a tip, never a
            // tumble into an orientation nobody asked for.
            if (
              drag.axis === null &&
              Math.hypot(deltaX, deltaY) > AXIS_LOCK_THRESHOLD
            ) {
              drag.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "dial" : "tip";
            }

            if (drag.axis === "dial") {
              setPose({
                dialAngle:
                  drag.startPose.dialAngle +
                  (deltaX / DIAL_PIXELS_PER_QUARTER) * QUARTER_TURN,
                tipAngle: drag.startPose.tipAngle,
              });
              return;
            }

            if (drag.axis === "tip") {
              // Tipping only ranges between the dial plane and screen-up; the
              // screen-away pose is intentionally unreachable.
              const next =
                drag.startPose.tipAngle +
                (deltaY / TIP_PIXELS_PER_DETENT) * TIP_ANGLES.clock;

              setPose({
                dialAngle: drag.startPose.dialAngle,
                tipAngle: Math.max(
                  TIP_ANGLES.clock,
                  Math.min(TIP_ANGLES.none, next),
                ),
              });
            }
          }}
          onPointerUp={() => {
            if (!dragRef.current.active) {
              return;
            }

            const moved = dragRef.current.axis !== null;
            dragRef.current.active = false;
            dragRef.current.axis = null;
            setDragging(false);

            // A click with no drag is handled by the 3D face pickers.
            if (moved) {
              commitPose();
            }
          }}
          onPointerLeave={() => {
            if (dragRef.current.active) {
              dragRef.current.active = false;
              dragRef.current.axis = null;
              setDragging(false);
              commitPose();
            }
          }}
        >
          <div className="tk-hud">
            <div className="tk-chip">
              <span>{copy.chips.arriba}</span>
              <strong>{topFace?.label ?? copy.panel.faceUnknown}</strong>
            </div>
            <div className="tk-chip">
              <span>{copy.chips.estado}</span>
              <strong>
                {session.kind !== "idle" && session.paused
                  ? copy.chips.enPausa
                  : mode === "clock"
                    ? copy.chips.reloj
                    : mode === "pomodoro"
                      ? copy.chips.pomodoro
                      : copy.chips.cuentaRegresiva}
              </strong>
            </div>
            {dragging ? (
              <div className="tk-chip tk-chip--live">
                <span>{copy.chips.soltar}</span>
                <strong>{describeFace(previewFaceId)}</strong>
              </div>
            ) : hoverFaceId && hoverFaceId !== topFaceId ? (
              <div className="tk-chip tk-chip--live">
                <span>{copy.chips.clic}</span>
                <strong>{describeFace(hoverFaceId)}</strong>
              </div>
            ) : null}
          </div>

          <div className="tk-legend">{copy.states.legend}</div>

          <div className="tk-stage-tools">
            {pipSupported ? (
              <button
                aria-pressed={isMiniPlayer}
                className="tk-tool-btn"
                onClick={() => (isMiniPlayer ? closeMiniPlayer() : void openMiniPlayer())}
                type="button"
              >
                <PictureInPicture2 size={16} />
                {copy.controls.mini}
              </button>
            ) : null}
            <button
              aria-pressed={isFocusMode}
              className="tk-tool-btn"
              onClick={() => void toggleFocusMode()}
              type="button"
            >
              {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {isFocusMode ? copy.controls.exit : copy.controls.focus}
            </button>
          </div>

          {isMiniPlayer ? (
            <div className="tk-pip-placeholder">
              <PictureInPicture2 size={26} />
              <strong>{copy.states.pipPlaceholderTitle}</strong>
              <span>{copy.states.pipPlaceholderDesc}</span>
            </div>
          ) : null}

          {/* This whole node moves into the PiP window and back, so the canvas
              and its arrow controls travel together. */}
          <div ref={pipSlotRef} className="tk-scene-slot">
            <div
              ref={pipSceneRef}
              className={`tk-scene-host${isMiniPlayer ? " is-pip" : ""}`}
            >
              <div className="tk-canvas">
                <Canvas
                  frameloop={needsContinuousRender ? "always" : "demand"}
                  camera={{
                    fov: focusActive ? 29 : 34,
                    position: focusActive
                      ? [1.9, 1.5, 2.55]
                      : [2.3, 1.85, 3.0],
                  }}
                  shadows
                >
                  <color
                    args={[focusActive ? "#080a0f" : "#eceff3"]}
                    attach="background"
                  />
              <ambientLight intensity={1.15} />
              <directionalLight
                castShadow
                intensity={2.1}
                position={[4, 6, 5]}
                shadow-bias={-0.00015}
                shadow-mapSize-height={2048}
                shadow-mapSize-width={2048}
              />
              <spotLight
                angle={0.45}
                intensity={0.6}
                penumbra={1}
                position={[-3, 5, -2]}
              />

              <group position={[0, 0.16, 0]}>
                <FocubeCube
                  alerting={alerting}
                  bodyColor={finish.body}
                  shadowColor={finish.shadow}
                  inkColor={finish.ink}
                  onHoverFace={setHoverFaceId}
                  onPickFace={activateFace}
                  quaternion={quaternion}
                  reducedMotion={reducedMotion}
                  tomato={session.kind === "pomodoro"}
                  screenProps={{
                    alarms,
                    alertType,
                    content: screenContent,
                    mode,
                    blinkOff: blinkOff,
                    paused: session.kind !== "idle" && Boolean(session.paused),
                    progressRatio: ringRatio,
                    // Stepped, not continuous: the panel turns with the cube
                    // and the content re-orients on the detent, like a real
                    // accelerometer display flipping.
                    screenSpin: -snapDialStep(pose.dialAngle) * QUARTER_TURN,
                  }}
                  settleToken={settleToken}
                />
              </group>

              <mesh
                position={[0, -0.72, 0]}
                receiveShadow
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[10, 10]} />
                <shadowMaterial opacity={0.16} />
              </mesh>
              <ContactShadows
                blur={2.4}
                color="#5f6a76"
                frames={1}
                opacity={0.4}
                position={[0, -0.7, 0]}
                scale={5.5}
              />
                </Canvas>
              </div>

              <CubeControls
                compact={isMiniPlayer}
                directions={directions}
                highlight={!hasSeenOnboarding}
                onActivate={activateFace}
                topFaceId={session.kind === "pomodoro" ? "pomodoro" : topFaceId}
              />
            </div>
          </div>
        </div>

        <aside className="tk-panel">
          <div className="tk-readout">
            <span>{screenContent.caption}</span>
            {/* The readout is drawn as segments, so screen readers get the
                value as text instead. */}
            <p className="sr-only">{readoutLabel}</p>
            <SevenSegment
              className="tk-readout__value"
              color={screenContent.accent}
              label={null}
              value={screenContent.primary}
            />
            {session.kind === "pomodoro" ? (
              <small>
                {copy.panel.cycle(session.cycle, POMODORO_TOTAL_CYCLES)} ·{" "}
                {session.phase === "work" ? copy.panel.work : copy.panel.break}
              </small>
            ) : (
              <small>
                {formatWeekday(currentDate)} {formatCalendarDate(currentDate)}
              </small>
            )}

            {/* Daily focus counter (P2.1) — visible without opening anything,
                dismissible for the rest of the day. */}
            {isStreakVisible(dailySessions, streakHiddenDate, todayKey()) ? (
              <div className="tk-streak">
                <span>{copy.panel.sessionsToday(dailySessions)}</span>
                {streakDays > 1 ? (
                  <span className="tk-streak__days">
                    · {copy.panel.streakDays(streakDays)}
                  </span>
                ) : null}
                <button
                  className="tk-streak__dismiss"
                  onClick={() => hideStreakForToday()}
                  type="button"
                >
                  {copy.panel.streakDismiss}
                </button>
              </div>
            ) : null}
          </div>

          <div className="tk-card">
            <h2>{copy.panel.flipToFace}</h2>
            <div className="tk-faces">
              {MODE_FACES.map((face) => (
                <button
                  key={face.id}
                  className={`tk-face-button${topFaceId === face.id ? " is-active" : ""}`}
                  onClick={() => activateFace(face.id)}
                  type="button"
                >
                  <strong>{face.minutes}</strong>
                  <span>min</span>
                </button>
              ))}
              <button
                className={`tk-face-button tk-face-button--wide${topFaceId === "pomodoro" ? " is-active" : ""}`}
                onClick={() => activateFace("pomodoro")}
                type="button"
              >
                <strong>{copy.controls.pomodoro}</strong>
                <span>{copy.panel.pomodoroAction}</span>
              </button>
              <button
                className={`tk-face-button tk-face-button--wide${topFaceId === "screen" ? " is-active" : ""}`}
                onClick={() => activateFace("screen")}
                type="button"
              >
                <strong>{copy.panel.clock}</strong>
                <span>{copy.panel.clockAction}</span>
              </button>
            </div>
          </div>

          <div className="tk-card">
            <button
              aria-expanded={!panelSectionsCollapsed.screenTools}
              className="tk-card__header"
              onClick={() => togglePanelSectionCollapsed("screenTools")}
              type="button"
            >
              <h2>{copy.panel.fromClockFace}</h2>
              {panelSectionsCollapsed.screenTools ? (
                <ChevronDown size={15} />
              ) : (
                <ChevronUp size={15} />
              )}
            </button>
            {!panelSectionsCollapsed.screenTools ? (
              <>
            <div className="tk-tabs">
              {(["clock", "custom", "stopwatch", "alarms"] as ScreenTool[]).map(
                (tool) => (
                  <button
                    key={tool}
                    className={`tk-tab${screenTool === tool ? " is-active" : ""}`}
                    onClick={() => setScreenTool(tool)}
                    type="button"
                  >
                    {tool === "clock"
                      ? copy.panel.clock
                      : tool === "custom"
                        ? copy.panel.custom
                        : tool === "stopwatch"
                          ? copy.panel.stopwatch
                          : copy.panel.alarms}
                  </button>
                ),
              )}
            </div>

            {screenTool === "clock" ? (
              <p className="tk-hint">{copy.panel.clockHint}</p>
            ) : null}

            {screenTool === "custom" ? (
              <div className="tk-tool">
                <label htmlFor="custom-minutes">
                  {copy.panel.customRange(CUSTOM_MIN_MINUTES, CUSTOM_MAX_MINUTES)}
                </label>
                <input
                  id="custom-minutes"
                  max={CUSTOM_MAX_MINUTES}
                  min={CUSTOM_MIN_MINUTES}
                  onChange={(event) =>
                    setCustomMinutesStore(
                      clampCustomMinutes(Number(event.target.value)),
                    )
                  }
                  type="range"
                  value={customMinutesStore}
                />
                <div className="tk-tool__row">
                  <SevenSegment
                    className="tk-tool__value"
                    label={`${customMinutesStore} min`}
                    value={String(customMinutesStore).padStart(2, "0")}
                  />
                  <button
                    className="tk-button tk-button--primary"
                      onClick={() => {
                        startCountdownMinutes(
                          customMinutesStore,
                          `${customMinutesStore} min`,
                          null,
                        );
                      setLiveMessage(copy.timer.started(customMinutesStore));
                    }}
                    type="button"
                  >
                    {copy.controls.start}
                  </button>
                </div>
              </div>
            ) : null}

            {screenTool === "stopwatch" ? (
              <div className="tk-tool">
                <SevenSegment
                  className="tk-tool__value"
                  value={formatDigitalTime(stopwatchMs)}
                />
                <div className="tk-tool__row">
                  <button
                    className="tk-button tk-button--primary"
                    onClick={() =>
                      setStopwatch((current) =>
                        current.running
                          ? {
                              running: false,
                              startedAt: 0,
                              accumulatedMs: clampStopwatchMs(
                                current.accumulatedMs +
                                  (Date.now() - current.startedAt),
                              ),
                            }
                          : {
                              ...current,
                              running: true,
                              startedAt: Date.now(),
                            },
                      )
                    }
                    type="button"
                  >
                    {stopwatch.running ? copy.controls.pause : copy.controls.start}
                  </button>
                  <button
                    className="tk-button"
                    onClick={() =>
                      setStopwatch({
                        running: false,
                        startedAt: 0,
                        accumulatedMs: 0,
                      })
                    }
                    type="button"
                  >
                    {copy.controls.reset}
                  </button>
                </div>
                <p className="tk-hint">
                  {copy.panel.stopwatchHint(STOPWATCH_MAX_MS / 60_000)}
                </p>
              </div>
            ) : null}

            {screenTool === "alarms" ? (
              <div className="tk-tool">
                {alarms.map((alarm) => (
                  <div className="tk-alarm" key={alarm.id}>
                    <input
                      aria-label={copy.aria.activateAlarm(alarm.id)}
                      checked={alarm.enabled}
                      onChange={(event) =>
                        updateAlarm(alarm.id, { enabled: event.target.checked })
                      }
                      type="checkbox"
                    />
                    <input
                      aria-label={copy.aria.alarmTime(alarm.id)}
                      onChange={(event) => {
                        const [hour, minute] = event.target.value
                          .split(":")
                          .map(Number);
                        updateAlarm(alarm.id, {
                          hour: hour || 0,
                          minute: minute || 0,
                        });
                      }}
                      type="time"
                      value={`${String(alarm.hour).padStart(2, "0")}:${String(alarm.minute).padStart(2, "0")}`}
                    />
                    <button
                      aria-label={copy.aria.deleteAlarm(alarm.id)}
                      className="tk-icon-button"
                      onClick={() =>
                        setAlarms(
                          alarms.filter((item) => item.id !== alarm.id),
                        )
                      }
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}

                <button
                  className="tk-button"
                  disabled={alarms.length >= ALARM_LIMIT}
                  onClick={() =>
                    setAlarms(
                      appendAlarm(alarms, {
                        id: `alarm-${Date.now()}-${alarms.length}`,
                        hour: 8,
                        minute: 0,
                        enabled: true,
                      }),
                    )
                  }
                  type="button"
                >
                  <Plus size={15} />
                  {copy.controls.addAlarm(alarms.length, ALARM_LIMIT)}
                </button>
              </div>
            ) : null}
              </>
            ) : null}
          </div>

          <div className="tk-card">
            <button
              aria-expanded={!panelSectionsCollapsed.focusMode}
              className="tk-card__header"
              onClick={() => togglePanelSectionCollapsed("focusMode")}
              type="button"
            >
              <h2>{copy.panel.focusMode}</h2>
              {panelSectionsCollapsed.focusMode ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
            {!panelSectionsCollapsed.focusMode ? (
              <>
                <div className="tk-tabs">
                  {SOUNDSCAPES.map((option) => (
                    <div key={option.id} className="tk-tab-wrap">
                      <button
                        className={`tk-tab${soundscape === option.id ? " is-active" : ""}`}
                        onClick={() => {
                          setSoundscape(option.id as SoundscapeId);
                          armAudioContext();
                        }}
                        type="button"
                      >
                        {option.id === "off" ? (
                          <VolumeX size={15} />
                        ) : option.id === "ticks" ? (
                          <Timer size={15} />
                        ) : (
                          <Music size={15} />
                        )}
                        {option.label}
                      </button>
                      {option.id !== "off" ? (
                        <button
                          aria-label={copy.aria.previewSound(option.label)}
                          className="tk-tab__preview"
                          onClick={() =>
                            previewSoundscape(option.id as SoundscapeId)
                          }
                          type="button"
                        >
                          <Volume2 size={12} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <p className="tk-hint">{copy.states.focusHint}</p>
              </>
            ) : null}
          </div>

          <div className="tk-card">
            <button
              aria-expanded={!panelSectionsCollapsed.alertType}
              className="tk-card__header"
              onClick={() => togglePanelSectionCollapsed("alertType")}
              type="button"
            >
              <h2>{copy.panel.alertType}</h2>
              {panelSectionsCollapsed.alertType ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
            {!panelSectionsCollapsed.alertType ? (
              <>
                <div className="tk-tabs">
                  {(
                    [
                      { id: "sound" as const, label: copy.panel.sound, icon: <Volume2 size={15} /> },
                      {
                        id: "vibration" as const,
                        label: copy.panel.vibration,
                        icon: <Smartphone size={15} />,
                      },
                      {
                        id: "silent" as const,
                        label: copy.panel.silent,
                        icon: <BellOff size={15} />,
                      },
                    ] as Array<{ id: AlertType; label: string; icon: JSX.Element }>
                  ).map((option) => (
                    <button
                      key={option.id}
                      className={`tk-tab${alertType === option.id ? " is-active" : ""}`}
                      onClick={() => {
                        setAlertType(option.id as AlertType);
                        if (option.id === "sound") {
                          armAudioContext();
                        }
                      }}
                      type="button"
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="tk-tool__row">
                  {alertType !== "silent" ? (
                    <button
                      className="tk-button tk-button--small"
                      onClick={previewAlert}
                      type="button"
                    >
                      {copy.controls.testAlert}
                    </button>
                  ) : null}

                  {/* Explicit opt-in (P1.3): the permission prompt only ever
                      appears because this was switched on. */}
                  {notificationsSupported ? (
                    <label className="tk-switch">
                      <input
                        checked={notificationsEnabled}
                        onChange={() => void toggleNotifications()}
                        type="checkbox"
                      />
                      <span>{copy.controls.notify}</span>
                    </label>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <div className="tk-card">
            <button
              aria-expanded={!panelSectionsCollapsed.finish}
              className="tk-card__header"
              onClick={() => togglePanelSectionCollapsed("finish")}
              type="button"
            >
              <h2>{copy.panel.finish}</h2>
              {panelSectionsCollapsed.finish ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
            {!panelSectionsCollapsed.finish ? (
              <>
                <div className="tk-colors">
                  {Object.entries(CUBE_PALETTES).map(([key, palette]) => (
                    <button
                      key={key}
                      aria-label={palette.name}
                      className={`tk-swatch${cubeFinish === key ? " is-active" : ""}`}
                      onClick={() => setCubeFinish(key as CubeFinish)}
                      style={{ background: palette.body }}
                      type="button"
                    />
                  ))}
                </div>
                <div className="tk-tool__row">
                  <button className="tk-button" onClick={resetAll} type="button">
                    <RotateCcw size={15} />
                    {copy.controls.reset}
                  </button>
                  <button
                    className="tk-button"
                    onClick={() => void shareSetup()}
                    type="button"
                  >
                    <Share2 size={15} />
                    {shareCopied
                      ? copy.controls.shareCopied
                      : copy.controls.share}
                  </button>
                  <button
                    className={`tk-button${pomodoroSuggested ? " is-suggested" : ""}`}
                    onClick={() => activateFace("pomodoro")}
                    type="button"
                  >
                    <AlarmClock size={15} />
                    {copy.controls.pomodoro}
                  </button>
                </div>

                {/* Feedback & pro teaser (P2.2, P2.3) */}
                <div className="tk-tool__row">
                  <a
                    className="tk-button tk-button--small"
                    href={copy.links.feedback}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {copy.controls.feedback}
                  </a>
                  <span className="tk-teaser">{copy.controls.proTeaser}</span>
                </div>
              </>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
