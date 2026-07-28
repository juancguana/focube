/**
 * How hard the app is allowed to work at any given moment.
 *
 * A focus timer sits open for hours, so the expensive question is not "can we
 * hit 60fps" but "are we spending anything at all when nothing is moving".
 * Both predicates below answer that, and both are pure so they can be tested
 * without a canvas.
 */

/** The 3D canvas repaints on demand unless one of these is genuinely animating. */
export type MotionState = {
  /** The user is dragging the cube right now. */
  dragging: boolean;
  /** The alarm pulse is running. */
  alerting: boolean;
  /** The cube is still easing onto its face. */
  settling: boolean;
  /** `prefers-reduced-motion`: nothing animates, so nothing needs free frames. */
  reducedMotion: boolean;
};

/**
 * Whether the render loop should run free (`frameloop="always"`) instead of
 * repainting on demand.
 *
 * A running countdown is deliberately NOT on this list. The readout is a
 * texture rebuilt on a React commit, and a commit already invalidates the
 * canvas — so a live session repaints exactly as often as its digits change.
 * Keeping the loop free for the whole session rendered a motionless cube at
 * 60fps for 25 minutes straight.
 */
export function needsContinuousRender(state: MotionState): boolean {
  if (state.reducedMotion) {
    return false;
  }

  return state.dragging || state.alerting || state.settling;
}

/** Everything the wall-clock tick has to keep up with. */
export type ClockDemand = {
  /** A countdown, pomodoro or paused session is on screen. */
  sessionActive: boolean;
  /** The stopwatch is counting. */
  stopwatchRunning: boolean;
  /** The alarm pulse is running. */
  alerting: boolean;
  /** The cube is still easing onto its face. */
  settling: boolean;
};

/** Sub-second cadence: fast enough for a countdown and the pause blink. */
export const FAST_TICK_MS = 200;
/** At rest the readout is HH:MM, so a second of granularity is already generous. */
export const IDLE_TICK_MS = 1000;

/**
 * How often to resample the clock.
 *
 * The tick drives a re-render of the whole page, which in turn repaints the
 * canvas. At rest that bought us nothing: the readout shows HH:MM and changes
 * once a minute, yet we were redrawing the scene five times a second.
 */
export function clockTickMs(demand: ClockDemand): number {
  const needsFastTick =
    demand.sessionActive ||
    demand.stopwatchRunning ||
    demand.alerting ||
    demand.settling;

  return needsFastTick ? FAST_TICK_MS : IDLE_TICK_MS;
}
