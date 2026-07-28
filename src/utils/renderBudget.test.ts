import { describe, expect, it } from "vitest";

import {
  FAST_TICK_MS,
  IDLE_TICK_MS,
  clockTickMs,
  needsContinuousRender,
  type ClockDemand,
  type MotionState,
} from "./renderBudget";

const atRest: MotionState = {
  dragging: false,
  alerting: false,
  settling: false,
  reducedMotion: false,
};

const idleClock: ClockDemand = {
  sessionActive: false,
  stopwatchRunning: false,
  alerting: false,
  settling: false,
};

describe("needsContinuousRender", () => {
  it("stays on demand when nothing is moving", () => {
    expect(needsContinuousRender(atRest)).toBe(false);
  });

  it.each([
    ["dragging", { dragging: true }],
    ["alerting", { alerting: true }],
    ["settling", { settling: true }],
  ] as const)("runs free while %s", (_label, motion) => {
    expect(needsContinuousRender({ ...atRest, ...motion })).toBe(true);
  });

  it("never runs free under reduced motion, whatever else is happening", () => {
    expect(
      needsContinuousRender({
        dragging: true,
        alerting: true,
        settling: true,
        reducedMotion: true,
      }),
    ).toBe(false);
  });
});

describe("clockTickMs", () => {
  it("idles at one second when nothing needs sub-second updates", () => {
    expect(clockTickMs(idleClock)).toBe(IDLE_TICK_MS);
  });

  it.each([
    ["a session is on screen", { sessionActive: true }],
    ["the stopwatch runs", { stopwatchRunning: true }],
    ["the alarm pulses", { alerting: true }],
    ["the cube is settling", { settling: true }],
  ] as const)("ticks fast while %s", (_label, demand) => {
    expect(clockTickMs({ ...idleClock, ...demand })).toBe(FAST_TICK_MS);
  });

  it("keeps the fast tick short enough for the 550ms pause blink", () => {
    // Two samples per blink phase, or the blink visibly stutters.
    expect(FAST_TICK_MS).toBeLessThanOrEqual(550 / 2);
  });

  it("keeps the idle tick fine enough for a seconds-accurate readout", () => {
    expect(IDLE_TICK_MS).toBeLessThanOrEqual(1000);
  });
});
