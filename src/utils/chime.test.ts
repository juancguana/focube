import { describe, expect, it, vi } from "vitest";
import {
  CHIME_VOICES,
  chimeDurationSeconds,
  chimePeakGain,
  playChime,
} from "./chime";

describe("chime.ts — voice table structure", () => {
  it("defines exactly 4 voices", () => {
    expect(CHIME_VOICES).toHaveLength(4);
  });

  it("has strictly ascending frequencies", () => {
    for (let i = 1; i < CHIME_VOICES.length; i += 1) {
      expect(CHIME_VOICES[i].frequency).toBeGreaterThan(
        CHIME_VOICES[i - 1].frequency,
      );
    }
  });

  it("has non-decreasing start offsets", () => {
    for (let i = 1; i < CHIME_VOICES.length; i += 1) {
      expect(CHIME_VOICES[i].offset).toBeGreaterThanOrEqual(
        CHIME_VOICES[i - 1].offset,
      );
    }
  });

  it("never uses a harsh square oscillator", () => {
    for (const voice of CHIME_VOICES) {
      expect(voice.type).not.toBe("square");
    }
  });

  it("keeps every voice's decay at or above 0.6s", () => {
    for (const voice of CHIME_VOICES) {
      expect(voice.decay).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("matches A-major interval ratios within ±0.005", () => {
    const [root, third, fifth, seventh] = CHIME_VOICES;
    expect(third.frequency / root.frequency).toBeCloseTo(2, 2);
    expect(fifth.frequency / third.frequency).toBeCloseTo(1.2599, 2);
    expect(seventh.frequency / third.frequency).toBeCloseTo(1.4983, 2);
  });
});

describe("chime.ts — derived quantities (assertable without playing sound)", () => {
  it("chimeDurationSeconds() derives from offsets/attack/decay and stays <= 1.5s", () => {
    const expected =
      Math.max(...CHIME_VOICES.map((v) => v.offset + v.attack + v.decay)) +
      0.22 * 2;
    expect(chimeDurationSeconds()).toBeCloseTo(expected, 5);
    expect(chimeDurationSeconds()).toBeLessThanOrEqual(1.5);
  });

  it("chimePeakGain() is a pessimistic sum of all voice peaks plus the summed delay tail, and stays <= 0.2", () => {
    expect(chimePeakGain()).toBeLessThanOrEqual(0.2);
    // The pessimistic bound must be tight enough that it cannot pass while
    // the real (per-voice, non-simultaneous) signal actually clips.
    expect(chimePeakGain()).toBeGreaterThan(0.15);
  });
});

/** Minimal hand-rolled AudioContext double — no jsdom Web Audio exists. */
function createFakeAudioContext() {
  const oscillators: Array<{
    type: string;
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];

  const makeNode = () => ({
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  });

  const context = {
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => {
      const oscillator = {
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: vi.fn(() => ({
      ...makeNode(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        value: 0,
      },
    })),
    createBiquadFilter: vi.fn(() => ({
      ...makeNode(),
      type: "lowpass",
      frequency: { value: 0 },
      Q: { value: 0 },
    })),
    createDelay: vi.fn(() => ({
      ...makeNode(),
      delayTime: { value: 0 },
    })),
  };

  return { context, oscillators };
}

describe("chime.ts — playChime graph shape (fake AudioContext, no sound played)", () => {
  it("creates exactly 4 oscillators, none square, and stops every one", () => {
    const { context, oscillators } = createFakeAudioContext();

    playChime(context as unknown as AudioContext);

    expect(context.createOscillator).toHaveBeenCalledTimes(4);
    expect(oscillators).toHaveLength(4);
    for (const oscillator of oscillators) {
      expect(oscillator.type).not.toBe("square");
      expect(oscillator.start).toHaveBeenCalledTimes(1);
      expect(oscillator.stop).toHaveBeenCalledTimes(1);
    }
  });
});
