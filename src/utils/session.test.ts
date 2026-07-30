import { describe, expect, it } from "vitest";

import {
  IDLE,
  POMODORO_TOTAL_CYCLES,
  abandonmentOf,
  posedFaceFor,
  remainingMsOf,
  resumeTargetOf,
  sessionMinutes,
  sessionReducer,
  type Session,
} from "./session";
import { POMODORO_BREAK_MS, POMODORO_WORK_MS } from "./cube";

const NOW = 1_700_000_000_000;

const countdown = (overrides: Partial<Extract<Session, { kind: "countdown" }>> = {}) =>
  ({
    kind: "countdown",
    durationMs: 10 * 60_000,
    endsAt: NOW + 10 * 60_000,
    label: "10 min",
    faceId: "ten",
    ...overrides,
  }) satisfies Session;

const pomodoro = (overrides: Partial<Extract<Session, { kind: "pomodoro" }>> = {}) =>
  ({
    kind: "pomodoro",
    durationMs: POMODORO_WORK_MS,
    endsAt: NOW + POMODORO_WORK_MS,
    phase: "work",
    cycle: 1,
    ...overrides,
  }) satisfies Session;

describe("resumeTargetOf", () => {
  it("has no target while nothing is paused", () => {
    expect(resumeTargetOf(IDLE)).toBeNull();
    expect(resumeTargetOf(countdown())).toBeNull();
    expect(resumeTargetOf(pomodoro())).toBeNull();
  });

  it("points a paused countdown back at its own face", () => {
    expect(resumeTargetOf(countdown({ paused: true, remainingMs: 1000 }))).toBe("ten");
  });

  it("points a paused Pomodoro at the Pomodoro action, not the face it poses", () => {
    expect(resumeTargetOf(pomodoro({ paused: true, remainingMs: 1000 }))).toBe("pomodoro");
  });

  it("has no target for a paused countdown that never had a face", () => {
    expect(resumeTargetOf(countdown({ paused: true, remainingMs: 1000, faceId: null }))).toBeNull();
  });
});

describe("posedFaceFor", () => {
  it("maps the Pomodoro action onto the face it actually rests on", () => {
    expect(posedFaceFor("pomodoro")).toBe("five");
  });

  it("leaves real faces alone", () => {
    expect(posedFaceFor("ten")).toBe("ten");
    expect(posedFaceFor("screen")).toBe("screen");
  });
});

describe("remainingMsOf", () => {
  it("reads the frozen value while paused instead of draining", () => {
    const paused = countdown({ paused: true, remainingMs: 90_000, endsAt: NOW - 500_000 });
    expect(remainingMsOf(paused, NOW)).toBe(90_000);
  });

  it("counts down from the deadline while running", () => {
    expect(remainingMsOf(countdown(), NOW + 60_000)).toBe(9 * 60_000);
  });

  it("never goes negative", () => {
    expect(remainingMsOf(countdown(), NOW + 999 * 60_000)).toBe(0);
  });

  it("is zero when idle", () => {
    expect(remainingMsOf(IDLE, NOW)).toBe(0);
  });
});

describe("pause", () => {
  it("freezes the time that was left", () => {
    const { session, change } = sessionReducer(countdown(), {
      type: "pause",
      now: NOW + 4 * 60_000,
    });

    expect(change).toEqual({ kind: "paused" });
    expect(session).toMatchObject({ paused: true, remainingMs: 6 * 60_000 });
  });

  it("keeps the Pomodoro phase and cycle intact", () => {
    const { session } = sessionReducer(pomodoro({ phase: "break", cycle: 3 }), {
      type: "pause",
      now: NOW,
    });

    expect(session).toMatchObject({ kind: "pomodoro", phase: "break", cycle: 3, paused: true });
  });

  it("is inert when idle or already paused", () => {
    const already = countdown({ paused: true, remainingMs: 1000 });

    expect(sessionReducer(IDLE, { type: "pause", now: NOW }).session).toBe(IDLE);
    expect(sessionReducer(already, { type: "pause", now: NOW }).session).toBe(already);
    expect(sessionReducer(already, { type: "pause", now: NOW }).change).toEqual({ kind: "none" });
  });
});

describe("resume", () => {
  it("gives back exactly the time that was frozen", () => {
    const paused = countdown({ paused: true, remainingMs: 6 * 60_000 });
    const { session, change } = sessionReducer(paused, { type: "resume", now: NOW });

    expect(change).toEqual({ kind: "resumed", label: "10 min" });
    expect(session).toMatchObject({ paused: false, endsAt: NOW + 6 * 60_000 });
  });

  it("resumes a Pomodoro without restarting the block or losing the cycle", () => {
    const paused = pomodoro({ paused: true, remainingMs: 12_000, phase: "work", cycle: 3 });
    const { session, change } = sessionReducer(paused, { type: "resume", now: NOW });

    expect(change).toEqual({ kind: "resumed", label: null });
    expect(session).toEqual({
      kind: "pomodoro",
      durationMs: POMODORO_WORK_MS,
      endsAt: NOW + 12_000,
      phase: "work",
      cycle: 3,
      paused: false,
      remainingMs: 12_000,
    });
  });

  it("resumes a countdown that has no face, which no gesture can reach", () => {
    const paused = countdown({ paused: true, remainingMs: 5_000, faceId: null, label: "25 min" });
    const { session } = sessionReducer(paused, { type: "resume", now: NOW });

    expect(session).toMatchObject({ paused: false, endsAt: NOW + 5_000 });
  });

  it("is inert when there is nothing frozen", () => {
    const running = countdown();

    expect(sessionReducer(IDLE, { type: "resume", now: NOW }).session).toBe(IDLE);
    expect(sessionReducer(running, { type: "resume", now: NOW }).session).toBe(running);
  });
});

describe("start-countdown", () => {
  it("starts from the full duration", () => {
    const { session, change } = sessionReducer(IDLE, {
      type: "start-countdown",
      minutes: 30,
      label: "30 min",
      faceId: "thirty",
      now: NOW,
    });

    expect(change).toEqual({ kind: "started", mode: "countdown", minutes: 30 });
    expect(session).toEqual({
      kind: "countdown",
      durationMs: 30 * 60_000,
      endsAt: NOW + 30 * 60_000,
      label: "30 min",
      faceId: "thirty",
    });
  });

  it("reports the session it walked away from", () => {
    const { abandoned } = sessionReducer(countdown(), {
      type: "start-countdown",
      minutes: 5,
      label: "5 min",
      faceId: "five",
      now: NOW + 5 * 60_000,
    });

    expect(abandoned).toEqual({ mode: "countdown", minutes: 10, elapsedRatio: 0.5 });
  });

  it("reports abandoning a paused session by its frozen remainder", () => {
    const paused = countdown({ paused: true, remainingMs: 2 * 60_000, endsAt: 0 });
    const { abandoned } = sessionReducer(paused, {
      type: "start-countdown",
      minutes: 5,
      label: "5 min",
      faceId: "five",
      now: NOW,
    });

    expect(abandoned).toEqual({ mode: "countdown", minutes: 10, elapsedRatio: 0.8 });
  });
});

describe("start-pomodoro", () => {
  it("opens on the first work block", () => {
    const { session, change } = sessionReducer(IDLE, {
      type: "start-pomodoro",
      workMultiplier: 1,
      now: NOW,
    });

    expect(change).toEqual({ kind: "started", mode: "pomodoro", minutes: 25 });
    expect(session).toEqual({
      kind: "pomodoro",
      durationMs: POMODORO_WORK_MS,
      endsAt: NOW + POMODORO_WORK_MS,
      phase: "work",
      cycle: 1,
    });
  });

  it("stretches the work block by the multiplier", () => {
    const { session } = sessionReducer(IDLE, {
      type: "start-pomodoro",
      workMultiplier: 3,
      now: NOW,
    });

    expect(session).toMatchObject({ durationMs: POMODORO_WORK_MS * 3 });
  });

  it("resumes a paused Pomodoro instead of starting a second one", () => {
    const paused = pomodoro({ paused: true, remainingMs: 30_000, cycle: 2 });
    const { session, change, abandoned } = sessionReducer(paused, {
      type: "start-pomodoro",
      workMultiplier: 1,
      now: NOW,
    });

    expect(change).toEqual({ kind: "resumed", label: null });
    expect(abandoned).toBeNull();
    expect(session).toMatchObject({ cycle: 2, paused: false, endsAt: NOW + 30_000 });
  });
});

describe("advance", () => {
  it("follows a work block with a break, and only then counts a focus session", () => {
    const { session, change } = sessionReducer(pomodoro({ cycle: 1 }), {
      type: "advance",
      workMultiplier: 1,
      now: NOW,
    });

    expect(change).toEqual({
      kind: "advanced",
      phase: "break",
      cycle: 1,
      workBlockCompleted: true,
    });
    expect(session).toEqual({
      kind: "pomodoro",
      durationMs: POMODORO_BREAK_MS,
      endsAt: NOW + POMODORO_BREAK_MS,
      phase: "break",
      cycle: 1,
    });
  });

  it("follows a break with the next work block, which is not a focus session yet", () => {
    const { session, change } = sessionReducer(pomodoro({ phase: "break", cycle: 1 }), {
      type: "advance",
      workMultiplier: 1,
      now: NOW,
    });

    expect(change).toMatchObject({ phase: "work", cycle: 2, workBlockCompleted: false });
    expect(session).toMatchObject({ phase: "work", cycle: 2 });
  });

  it("ends the whole run after the last work block", () => {
    const { session, change } = sessionReducer(
      pomodoro({ cycle: POMODORO_TOTAL_CYCLES }),
      { type: "advance", workMultiplier: 1, now: NOW },
    );

    expect(change).toEqual({ kind: "finished", mode: "pomodoro" });
    expect(session).toEqual(IDLE);
  });

  it("ends a countdown", () => {
    const { session, change } = sessionReducer(countdown(), {
      type: "advance",
      workMultiplier: 1,
      now: NOW,
    });

    expect(change).toEqual({ kind: "finished", mode: "countdown" });
    expect(session).toEqual(IDLE);
  });

  it("never reports a completed session as abandoned", () => {
    expect(
      sessionReducer(countdown(), { type: "advance", workMultiplier: 1, now: NOW }).abandoned,
    ).toBeNull();
  });
});

describe("reset", () => {
  it("clears the session and reports what was dropped", () => {
    const { session, change, abandoned } = sessionReducer(countdown(), {
      type: "reset",
      now: NOW + 2 * 60_000,
    });

    expect(session).toEqual(IDLE);
    expect(change).toEqual({ kind: "reset" });
    expect(abandoned).toEqual({ mode: "countdown", minutes: 10, elapsedRatio: 0.2 });
  });

  it("is inert when there is nothing to clear", () => {
    const { session, abandoned } = sessionReducer(IDLE, { type: "reset", now: NOW });

    expect(session).toBe(IDLE);
    expect(abandoned).toBeNull();
  });
});

describe("abandonmentOf", () => {
  it("says nothing about an idle or already-finished session", () => {
    expect(abandonmentOf(IDLE, NOW)).toBeNull();
    expect(abandonmentOf(countdown(), NOW + 10 * 60_000)).toBeNull();
  });

  it("guards against a zero duration rather than dividing by it", () => {
    expect(abandonmentOf(countdown({ durationMs: 0 }), NOW)).toBeNull();
  });
});

describe("sessionMinutes", () => {
  it("rounds the duration to whole minutes", () => {
    expect(sessionMinutes(countdown({ durationMs: 89_000 }))).toBe(1);
    expect(sessionMinutes(pomodoro())).toBe(25);
  });
});

describe("pause and resume round trip", () => {
  /**
   * The bug this module exists for: pausing a Pomodoro and coming back used to
   * drop it and start a fresh five-minute countdown over the top.
   */
  it("returns a Pomodoro exactly as it was left, however long the pause lasted", () => {
    const started = sessionReducer(IDLE, {
      type: "start-pomodoro",
      workMultiplier: 2,
      now: NOW,
    }).session;

    const paused = sessionReducer(started, { type: "pause", now: NOW + 60_000 }).session;
    const resumed = sessionReducer(paused, { type: "resume", now: NOW + 900_000 }).session;

    expect(resumed).toMatchObject({
      kind: "pomodoro",
      phase: "work",
      cycle: 1,
      durationMs: POMODORO_WORK_MS * 2,
      paused: false,
    });
    // An hour on the shelf costs nothing: the remainder is what it was.
    expect(remainingMsOf(resumed, NOW + 900_000)).toBe(POMODORO_WORK_MS * 2 - 60_000);
  });

  it("survives being paused and resumed repeatedly", () => {
    let session = sessionReducer(IDLE, {
      type: "start-countdown",
      minutes: 10,
      label: "10 min",
      faceId: "ten",
      now: NOW,
    }).session;

    for (let round = 0; round < 3; round++) {
      const at = NOW + (round + 1) * 60_000;
      session = sessionReducer(session, { type: "pause", now: at }).session;
      session = sessionReducer(session, { type: "resume", now: at + 500_000 }).session;
    }

    // Three minutes of running time elapsed; the pauses in between are free.
    expect(remainingMsOf(session, NOW + 3 * 60_000 + 1_500_000)).toBe(7 * 60_000);
  });
});
