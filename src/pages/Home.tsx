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
  Smartphone,
  Timer,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import * as THREE from "three";
import SevenSegment from "@/components/SevenSegment";
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
  type AlertType,
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

/** What landing on a face will actually do, phrased as an outcome. */
function describeFace(faceId: FaceId) {
  if (faceId === "screen") {
    return "Pausa / reloj";
  }

  if (faceId === "pomodoro") {
    return "Pomodoro 25/5";
  }

  return `${getFaceById(faceId)?.minutes} min`;
}

/** Destination name for a control (Pomodoro is an action, not a real face). */
function faceName(faceId: FaceId) {
  return faceId === "pomodoro" ? "Pomodoro" : (getFaceById(faceId)?.label ?? "—");
}

/** Short outcome line for a control, without repeating the face name. */
function faceActionLabel(faceId: FaceId) {
  if (faceId === "screen") {
    return "Pausa";
  }

  if (faceId === "pomodoro") {
    return "25 / 5 · 4";
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
}: {
  directions: Direction[];
  topFaceId: FaceId;
  onActivate: (faceId: FaceId) => void;
  compact?: boolean;
}) {
  return (
    <div className={`tk-dpad${compact ? " is-compact" : ""}`}>
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
  const [cubeColor, setCubeColor] = useState<CubeColor>("black");
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
  const [alertType, setAlertType] = useState<AlertType>("sound");

  const [screenTool, setScreenTool] = useState<ScreenTool>("clock");
  const [customMinutes, setCustomMinutes] = useState(25);
  const [stopwatch, setStopwatch] = useState({
    running: false,
    startedAt: 0,
    accumulatedMs: 0,
  });
  const [alarms, setAlarms] = useState<Alarm[]>([
    { id: "alarm-1", hour: 8, minute: 0, enabled: false },
  ]);

  const [now, setNow] = useState(() => Date.now());
  const [dragging, setDragging] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [soundscape, setSoundscape] = useState<SoundscapeId>("focus");
  const [liveMessage, setLiveMessage] = useState(
    "Cubo en modo reloj. Gira una cara hacia arriba.",
  );

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

  const alerting = now < alertUntil;
  /** Drives the paused blink; the screen is a texture, so it needs a tick. */
  const blinkOff = Math.floor(now / 550) % 2 === 1;
  // Pomodoro is a session, not a face, so it overrides the face-derived mode.
  const mode: CubeMode =
    session.kind === "pomodoro" ? "pomodoro" : getModeForFace(topFaceId);
  const currentDate = useMemo(() => new Date(now), [now]);

  // The active finish: the chosen colour normally, or the Pomodoro finish while
  // a Pomodoro runs so the whole cube signals work (red) vs break (green).
  const finish =
    session.kind === "pomodoro"
      ? POMODORO_FINISH[session.phase]
      : CUBE_PALETTES[cubeColor];

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
        navigator.vibrate?.([220, 120, 220, 120, 320]);
        return;
      }

      if (alertType === "silent") {
        return;
      }

      armAudioContext();
      const context = audioContextRef.current;
      if (!context) {
        return;
      }

      const startAt = context.currentTime;
      [0, 0.24, 0.48].forEach((offset, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = index === 1 ? "square" : "sine";
        oscillator.frequency.setValueAtTime(
          880 - index * 130,
          startAt + offset,
        );

        gain.gain.setValueAtTime(0.0001, startAt + offset);
        gain.gain.exponentialRampToValueAtTime(0.2, startAt + offset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.2);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startAt + offset);
        oscillator.stop(startAt + offset + 0.26);
      });
    },
    [alertType, armAudioContext],
  );

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

      // Pomodoro is an action, not a face: it runs the cycle and shows the 5
      // pose, mirroring the physical cube's "put 5 up and long-press".
      if (faceId === "pomodoro") {
        moveToFace("five");
        setSession((current) => {
          if (current.kind === "pomodoro" && current.paused) {
            setLiveMessage("Pomodoro reanudado.");
            return {
              ...current,
              paused: false,
              endsAt: Date.now() + (current.remainingMs ?? 0),
            };
          }

          setLiveMessage("Pomodoro iniciado. Bloque de trabajo 1 de 4.");
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

          setLiveMessage("Reloj arriba. Cuenta en pausa.");
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
          setLiveMessage(`Cuenta reanudada en ${face.label}.`);
          return {
            ...current,
            paused: false,
            endsAt: Date.now() + (current.remainingMs ?? 0),
          };
        }

        setLiveMessage(
          `Cara ${face.label} arriba. Cuenta regresiva de ${face.minutes} minutos.`,
        );
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
    [armAudioContext, moveToFace],
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

    if (session.kind === "pomodoro") {
      const step = getNextPomodoroStep({
        enabled: true,
        cycle: session.cycle,
        phase: session.phase,
        totalCycles: POMODORO_TOTAL_CYCLES,
      });

      if (!step || step.phase === "done") {
        fireAlert("Pomodoro completo. Volviendo a modo reloj.");
        setSession({ kind: "idle" });
        moveToFace("screen");
        return;
      }

      fireAlert(
        `Fase completa. Siguiente: ${step.phase === "work" ? "trabajo" : "descanso"} ${step.cycle} de ${POMODORO_TOTAL_CYCLES}.`,
      );
      setSession({
        kind: "pomodoro",
        durationMs: step.durationMs,
        endsAt: Date.now() + step.durationMs,
        phase: step.phase === "work" ? "work" : "break",
        cycle: step.cycle,
      });
      return;
    }

    fireAlert("Tiempo cumplido. Volviendo a modo reloj.");
    setSession({ kind: "idle" });

    window.setTimeout(() => moveToFace("screen"), 2600);
  }, [fireAlert, moveToFace, remainingMs, session]);

  /** Daily alarms ring regardless of the face that is currently up. */
  useEffect(() => {
    const due = findDueAlarm(alarms, currentDate);
    const key = due
      ? `${due.id}-${currentDate.getHours()}-${currentDate.getMinutes()}`
      : null;

    if (due && key && firedAlarmRef.current !== key) {
      firedAlarmRef.current = key;
      fireAlert(`Alarma ${formatClockTime(currentDate)}.`);
    }
  }, [alarms, currentDate, fireAlert]);

  // Both focus mode and the mini player are "focus"; the ambience follows them.
  const focusActive = isFocusMode || isMiniPlayer;

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
        caption: session.phase === "work" ? "Trabajo" : "Descanso",
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
        caption: "Cronómetro",
        accent: alerting ? ACCENTS.alert : ACCENTS.clock,
      };
    }

    return {
      primary: formatClockTime(currentDate),
      secondaryLabel: formatWeekday(currentDate),
      secondaryValue: formatCalendarDate(currentDate),
      caption: "Reloj",
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
    setLiveMessage("Cubo reiniciado en modo reloj.");
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

  const updateAlarm = useCallback((id: string, patch: Partial<Alarm>) => {
    setAlarms((current) =>
      current.map((alarm) =>
        alarm.id === id ? { ...alarm, ...patch } : alarm,
      ),
    );
  }, []);

  const topFace = getFaceById(topFaceId);

  return (
    <main className={`tk-app${isFocusMode ? " is-focus" : ""}`}>
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <section className="tk-hero">
        <span className="tk-eyebrow">Focube</span>
        <h1>El cubo Pomodoro que se controla volteándolo.</h1>
        <p>
          Gira el dial y suelta: la cara que queda arriba define el modo y
          arranca sola. La cara del reloj pausa la cuenta y volver a la misma
          cara la reanuda.
        </p>
      </section>

      <section className="tk-layout">
        <div
          ref={sceneShellRef}
          aria-label="Cubo Focube interactivo. Arrastra para voltearlo. Teclas 5, 1, 3, 6 para las caras numéricas, P para pomodoro y C para el reloj."
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
              <span>Arriba</span>
              <strong>{topFace?.label ?? "—"}</strong>
            </div>
            <div className="tk-chip">
              <span>Estado</span>
              <strong>
                {session.kind !== "idle" && session.paused
                  ? "En pausa"
                  : mode === "clock"
                    ? "Reloj"
                    : mode === "pomodoro"
                      ? "Pomodoro"
                      : "Cuenta regresiva"}
              </strong>
            </div>
            {/* Says what will happen before you commit — the drag used to be a
                guess until you released. */}
            {dragging ? (
              <div className="tk-chip tk-chip--live">
                <span>Soltar</span>
                <strong>{describeFace(previewFaceId)}</strong>
              </div>
            ) : hoverFaceId && hoverFaceId !== topFaceId ? (
              <div className="tk-chip tk-chip--live">
                <span>Clic</span>
                <strong>{describeFace(hoverFaceId)}</strong>
              </div>
            ) : null}
          </div>

          <div className="tk-legend">
            Usa las <b>flechas</b> para girar el cubo — cada una dice a qué cara
            va y qué hace · también <b>arrastra</b> o haz <b>clic</b> en una cara
          </div>

          <div className="tk-stage-tools">
            {pipSupported ? (
              <button
                aria-pressed={isMiniPlayer}
                className="tk-tool-btn"
                onClick={() => (isMiniPlayer ? closeMiniPlayer() : void openMiniPlayer())}
                type="button"
              >
                <PictureInPicture2 size={16} />
                Mini
              </button>
            ) : null}
            <button
              aria-pressed={isFocusMode}
              className="tk-tool-btn"
              onClick={() => void toggleFocusMode()}
              type="button"
            >
              {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {isFocusMode ? "Salir" : "Focus"}
            </button>
          </div>

          {isMiniPlayer ? (
            <div className="tk-pip-placeholder">
              <PictureInPicture2 size={26} />
              <strong>Cubo en el mini reproductor</strong>
              <span>Cierra la ventana flotante para traerlo de vuelta.</span>
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
                onActivate={activateFace}
                topFaceId={session.kind === "pomodoro" ? "pomodoro" : topFaceId}
              />
            </div>
          </div>
        </div>

        <aside className="tk-panel">
          <div className="tk-readout">
            <span>{screenContent.caption}</span>
            <SevenSegment
              className="tk-readout__value"
              color={screenContent.accent}
              value={screenContent.primary}
            />
            {session.kind === "pomodoro" ? (
              <small>
                Ciclo {session.cycle}/{POMODORO_TOTAL_CYCLES} ·{" "}
                {session.phase === "work" ? "Trabajo" : "Descanso"}
              </small>
            ) : (
              <small>
                {formatWeekday(currentDate)} {formatCalendarDate(currentDate)}
              </small>
            )}
          </div>

          <div className="tk-card">
            <h2>Voltear a una cara</h2>
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
                <strong>Pomodoro</strong>
                <span>25 / 5 · 4 ciclos</span>
              </button>
              <button
                className={`tk-face-button tk-face-button--wide${topFaceId === "screen" ? " is-active" : ""}`}
                onClick={() => activateFace("screen")}
                type="button"
              >
                <strong>Reloj</strong>
                <span>Pausa la cuenta</span>
              </button>
            </div>
          </div>

          <div className="tk-card">
            <h2>Desde la cara del reloj</h2>
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
                      ? "Reloj"
                      : tool === "custom"
                        ? "Personalizado"
                        : tool === "stopwatch"
                          ? "Cronómetro"
                          : "Alarmas"}
                  </button>
                ),
              )}
            </div>

            {screenTool === "clock" ? (
              <p className="tk-hint">
                La cara del reloj muestra hora, día y fecha, y pausa cualquier
                conteo en curso.
              </p>
            ) : null}

            {screenTool === "custom" ? (
              <div className="tk-tool">
                <label htmlFor="custom-minutes">
                  Cuenta regresiva personalizada ({CUSTOM_MIN_MINUTES}–
                  {CUSTOM_MAX_MINUTES} min)
                </label>
                <input
                  id="custom-minutes"
                  max={CUSTOM_MAX_MINUTES}
                  min={CUSTOM_MIN_MINUTES}
                  onChange={(event) =>
                    setCustomMinutes(
                      clampCustomMinutes(Number(event.target.value)),
                    )
                  }
                  type="range"
                  value={customMinutes}
                />
                <div className="tk-tool__row">
                  <SevenSegment
                    className="tk-tool__value"
                    value={String(customMinutes).padStart(2, "0")}
                  />
                  <button
                    className="tk-button tk-button--primary"
                    onClick={() => {
                      startCountdownMinutes(
                        customMinutes,
                        `${customMinutes} min`,
                        null,
                      );
                      setLiveMessage(
                        `Cuenta regresiva personalizada de ${customMinutes} minutos.`,
                      );
                    }}
                    type="button"
                  >
                    Iniciar
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
                    {stopwatch.running ? "Pausar" : "Iniciar"}
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
                    Reiniciar
                  </button>
                </div>
                <p className="tk-hint">
                  Cuenta hacia arriba hasta {STOPWATCH_MAX_MS / 60_000} minutos.
                </p>
              </div>
            ) : null}

            {screenTool === "alarms" ? (
              <div className="tk-tool">
                {alarms.map((alarm) => (
                  <div className="tk-alarm" key={alarm.id}>
                    <input
                      aria-label={`Activar alarma ${alarm.id}`}
                      checked={alarm.enabled}
                      onChange={(event) =>
                        updateAlarm(alarm.id, { enabled: event.target.checked })
                      }
                      type="checkbox"
                    />
                    <input
                      aria-label={`Hora de la alarma ${alarm.id}`}
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
                      aria-label={`Eliminar alarma ${alarm.id}`}
                      className="tk-icon-button"
                      onClick={() =>
                        setAlarms((list) =>
                          list.filter((item) => item.id !== alarm.id),
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
                    setAlarms((list) =>
                      appendAlarm(list, {
                        id: `alarm-${Date.now()}-${list.length}`,
                        hour: 8,
                        minute: 0,
                        enabled: true,
                      }),
                    )
                  }
                  type="button"
                >
                  <Plus size={15} />
                  Añadir alarma ({alarms.length}/{ALARM_LIMIT})
                </button>
              </div>
            ) : null}
          </div>

          <div className="tk-card">
            <h2>Modo focus</h2>
            <div className="tk-tabs">
              {SOUNDSCAPES.map((option) => (
                <button
                  key={option.id}
                  className={`tk-tab${soundscape === option.id ? " is-active" : ""}`}
                  onClick={() => {
                    setSoundscape(option.id);
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
              ))}
            </div>
            <p className="tk-hint">
              Pantalla completa sólo con el cubo. El ambiente suena mientras Focus está activo.
            </p>
          </div>

          <div className="tk-card">
            <h2>Tipo de alerta</h2>
            <div className="tk-tabs">
              {(
                [
                  { id: "sound", label: "Sonido", icon: <Volume2 size={15} /> },
                  {
                    id: "vibration",
                    label: "Vibración",
                    icon: <Smartphone size={15} />,
                  },
                  {
                    id: "silent",
                    label: "Silencioso",
                    icon: <BellOff size={15} />,
                  },
                ] as Array<{ id: AlertType; label: string; icon: JSX.Element }>
              ).map((option) => (
                <button
                  key={option.id}
                  className={`tk-tab${alertType === option.id ? " is-active" : ""}`}
                  onClick={() => {
                    setAlertType(option.id);
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
          </div>

          <div className="tk-card">
            <h2>Acabado</h2>
            <div className="tk-colors">
              {Object.entries(CUBE_PALETTES).map(([key, palette]) => (
                <button
                  key={key}
                  aria-label={palette.name}
                  className={`tk-swatch${cubeColor === key ? " is-active" : ""}`}
                  onClick={() => setCubeColor(key as CubeColor)}
                  style={{ background: palette.body }}
                  type="button"
                />
              ))}
            </div>
            <div className="tk-tool__row">
              <button className="tk-button" onClick={resetAll} type="button">
                <RotateCcw size={15} />
                Reiniciar
              </button>
              <button
                className="tk-button"
                onClick={() => activateFace("pomodoro")}
                type="button"
              >
                <AlarmClock size={15} />
                Pomodoro
              </button>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
