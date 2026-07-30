import {
  POMODORO_TOTAL_CYCLES,
  clampPomodoroMultiplier,
  getNextPomodoroStep,
  type FaceId,
} from "./cube";

export { POMODORO_TOTAL_CYCLES };

/** `paused` mirrors the physical cube: screen up freezes, it does not cancel. */
type Paused = { paused?: boolean; remainingMs?: number };

export type Session =
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

export type ActiveSession = Exclude<Session, { kind: "idle" }>;

/**
 * A single shared instance, so a transition that changes nothing can return
 * the state it was given and let React skip the render.
 */
export const IDLE: Session = { kind: "idle" };

export type SessionAction =
  | {
      type: "start-countdown";
      minutes: number;
      label: string;
      faceId: FaceId | null;
      now: number;
    }
  | { type: "start-pomodoro"; workMultiplier: number; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
  /** A session reached zero: end it, or move the Pomodoro to its next block. */
  | { type: "advance"; workMultiplier: number; now: number }
  | { type: "reset"; now: number };

/**
 * What a transition did, in terms the caller can act on. The reducer stays
 * pure and the announcements, analytics and cube moves are left to the
 * component — they used to run inside the `setSession` updater, which React is
 * free to re-run or discard.
 */
export type SessionChange =
  | { kind: "none" }
  | { kind: "started"; mode: "countdown" | "pomodoro"; minutes: number }
  /** `label` names a countdown; a Pomodoro has none, so it is `null`. */
  | { kind: "resumed"; label: string | null }
  | { kind: "paused" }
  | {
      kind: "advanced";
      phase: "work" | "break";
      cycle: number;
      /** Only a finished work block counts towards the daily total. */
      workBlockCompleted: boolean;
    }
  | { kind: "finished"; mode: "countdown" | "pomodoro" }
  | { kind: "reset" };

/**
 * A session dropped before it reached zero. Completion rate needs a
 * denominator: without this we would know how many sessions finished but not
 * how many were started and walked away from.
 */
export type Abandonment = {
  mode: "countdown" | "pomodoro";
  minutes: number;
  elapsedRatio: number;
};

export type SessionResult = {
  session: Session;
  change: SessionChange;
  abandoned: Abandonment | null;
};

export function sessionMinutes(session: ActiveSession) {
  return Math.round(session.durationMs / 60_000);
}

/** Time left, reading the frozen remainder rather than draining while paused. */
export function remainingMsOf(session: Session, now: number) {
  if (session.kind === "idle") {
    return 0;
  }

  return session.paused
    ? (session.remainingMs ?? 0)
    : Math.max(0, session.endsAt - now);
}

export function abandonmentOf(session: Session, now: number): Abandonment | null {
  if (session.kind === "idle") {
    return null;
  }

  const remainingMs = remainingMsOf(session, now);

  // Already at zero: that is a completion, and it reports itself.
  if (remainingMs <= 0 || session.durationMs <= 0) {
    return null;
  }

  const elapsed = session.durationMs - remainingMs;

  return {
    mode: session.kind,
    minutes: sessionMinutes(session),
    elapsedRatio: Number((elapsed / session.durationMs).toFixed(3)),
  };
}

/**
 * The control that brings a paused session back, or `null` when there is
 * nothing to return to.
 *
 * Pomodoro is an action rather than a face: it poses `five` but only resumes
 * through `pomodoro`, so the pose the cube rests on is NOT enough to work out
 * what "put it back" means. That mismatch is why untipping out of a paused
 * Pomodoro used to start a fresh five-minute countdown over the top of it.
 *
 * A custom countdown is started from the panel and never poses the cube, so it
 * has no target at all — the panel keeps its own resume control for that.
 */
export function resumeTargetOf(session: Session): FaceId | null {
  if (session.kind === "idle" || !session.paused) {
    return null;
  }

  return session.kind === "pomodoro" ? "pomodoro" : session.faceId;
}

/** The dial face a target actually rests on — Pomodoro borrows the 5. */
export function posedFaceFor(faceId: FaceId): FaceId {
  return faceId === "pomodoro" ? "five" : faceId;
}

const unchanged = (session: Session): SessionResult => ({
  session,
  change: { kind: "none" },
  abandoned: null,
});

function resumeFrom(session: Session, now: number): SessionResult | null {
  if (session.kind === "idle" || !session.paused) {
    return null;
  }

  return {
    session: {
      ...session,
      paused: false,
      endsAt: now + (session.remainingMs ?? 0),
    },
    change: {
      kind: "resumed",
      label: session.kind === "countdown" ? session.label : null,
    },
    abandoned: null,
  };
}

export function sessionReducer(state: Session, action: SessionAction): SessionResult {
  switch (action.type) {
    case "pause": {
      if (state.kind === "idle" || state.paused) {
        return unchanged(state);
      }

      return {
        session: {
          ...state,
          paused: true,
          remainingMs: Math.max(0, state.endsAt - action.now),
        },
        change: { kind: "paused" },
        abandoned: null,
      };
    }

    case "resume":
      return resumeFrom(state, action.now) ?? unchanged(state);

    case "start-countdown": {
      const durationMs = action.minutes * 60 * 1000;

      return {
        session: {
          kind: "countdown",
          durationMs,
          endsAt: action.now + durationMs,
          label: action.label,
          faceId: action.faceId,
        },
        change: { kind: "started", mode: "countdown", minutes: action.minutes },
        abandoned: abandonmentOf(state, action.now),
      };
    }

    case "start-pomodoro": {
      // Asking for a Pomodoro while one is frozen means "carry on", not
      // "throw that away and open another".
      const resumed = state.kind === "pomodoro" ? resumeFrom(state, action.now) : null;
      if (resumed) {
        return resumed;
      }

      const step = getNextPomodoroStep({
        enabled: true,
        cycle: 0,
        phase: "idle",
        totalCycles: POMODORO_TOTAL_CYCLES,
        workMultiplier: clampPomodoroMultiplier(action.workMultiplier),
      });

      if (!step) {
        return unchanged(state);
      }

      return {
        session: {
          kind: "pomodoro",
          durationMs: step.durationMs,
          endsAt: action.now + step.durationMs,
          phase: "work",
          cycle: step.cycle,
        },
        change: {
          kind: "started",
          mode: "pomodoro",
          minutes: Math.round(step.durationMs / 60_000),
        },
        abandoned: abandonmentOf(state, action.now),
      };
    }

    case "advance": {
      if (state.kind === "idle") {
        return unchanged(state);
      }

      if (state.kind === "countdown") {
        return {
          session: IDLE,
          change: { kind: "finished", mode: "countdown" },
          abandoned: null,
        };
      }

      const step = getNextPomodoroStep({
        enabled: true,
        cycle: state.cycle,
        phase: state.phase,
        totalCycles: POMODORO_TOTAL_CYCLES,
        workMultiplier: clampPomodoroMultiplier(action.workMultiplier),
      });

      if (!step || step.phase === "done") {
        return {
          session: IDLE,
          change: { kind: "finished", mode: "pomodoro" },
          abandoned: null,
        };
      }

      const isBreak = step.phase !== "work";

      return {
        session: {
          kind: "pomodoro",
          durationMs: step.durationMs,
          endsAt: action.now + step.durationMs,
          phase: isBreak ? "break" : "work",
          cycle: step.cycle,
        },
        change: {
          kind: "advanced",
          phase: isBreak ? "break" : "work",
          cycle: step.cycle,
          workBlockCompleted: isBreak,
        },
        abandoned: null,
      };
    }

    case "reset": {
      if (state.kind === "idle") {
        return unchanged(state);
      }

      return {
        session: IDLE,
        change: { kind: "reset" },
        abandoned: abandonmentOf(state, action.now),
      };
    }
  }
}
