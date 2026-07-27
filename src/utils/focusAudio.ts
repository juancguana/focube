/**
 * Procedural focus soundscape: a clock tick layer and a calm game-like pad and
 * arpeggio, all synthesised with Web Audio so nothing has to be downloaded.
 */

export const SOUNDSCAPES = [
  { id: "off", label: "Silencio" },
  { id: "ticks", label: "Tic-tac" },
  { id: "focus", label: "Deep focus" },
  { id: "both", label: "Tic-tac + focus" },
] as const;

export type SoundscapeId = (typeof SOUNDSCAPES)[number]["id"];

/** A minor pentatonic — no semitone clashes, so any order stays consonant. */
const PENTATONIC = [220, 261.63, 293.66, 329.63, 392];
const ARP_PATTERN = [0, 2, 4, 3, 1, 2, 4, 2];
const PAD_ROOTS = [110, 130.81, 98, 123.47];

export const STEP_SECONDS = 0.5;
/** Ticks land on every other step, which is exactly one second apart. */
export const STEPS_PER_TICK = 2;
const STEPS_PER_BAR = ARP_PATTERN.length;

export function arpNoteAt(step: number) {
  const degree = ARP_PATTERN[Math.abs(step) % ARP_PATTERN.length];
  const octaveUp = Math.floor(Math.abs(step) / ARP_PATTERN.length) % 2 === 1;
  return PENTATONIC[degree] * (octaveUp ? 2 : 1);
}

export function padRootAt(step: number) {
  const bar = Math.floor(Math.abs(step) / STEPS_PER_BAR);
  return PAD_ROOTS[bar % PAD_ROOTS.length];
}

export function isTickStep(step: number) {
  return Math.abs(step) % STEPS_PER_TICK === 0;
}

export function wantsTicks(mode: SoundscapeId) {
  return mode === "ticks" || mode === "both";
}

export function wantsMusic(mode: SoundscapeId) {
  return mode === "focus" || mode === "both";
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.2;

export class FocusSoundscape {
  private context: AudioContext;
  private master: GainNode;
  private delay: DelayNode;
  private padGain: GainNode;
  private padOscillators: OscillatorNode[] = [];
  private timer: number | null = null;
  private step = 0;
  private nextStepTime = 0;
  private mode: SoundscapeId = "off";

  constructor(context: AudioContext) {
    this.context = context;

    this.master = context.createGain();
    this.master.gain.value = 0;
    this.master.connect(context.destination);

    // Cheap stand-in for reverb: a filtered feedback delay.
    this.delay = context.createDelay(1);
    this.delay.delayTime.value = 0.34;

    const feedback = context.createGain();
    feedback.gain.value = 0.32;

    const damp = context.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 1800;

    this.delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(this.delay);
    this.delay.connect(this.master);

    this.padGain = context.createGain();
    this.padGain.gain.value = 0;
    this.padGain.connect(this.master);
  }

  getMode() {
    return this.mode;
  }

  setMode(mode: SoundscapeId) {
    if (mode === this.mode) {
      return;
    }

    this.mode = mode;

    if (mode === "off") {
      this.stop();
      return;
    }

    this.start();
    const target = wantsMusic(mode) ? 0.16 : 0;
    this.padGain.gain.setTargetAtTime(target, this.context.currentTime, 0.6);
  }

  private start() {
    if (this.timer !== null) {
      return;
    }

    this.step = 0;
    this.nextStepTime = this.context.currentTime + 0.08;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(0.3, this.context.currentTime, 0.5);

    this.startPad();
    this.timer = window.setInterval(() => this.schedule(), LOOKAHEAD_MS);
  }

  stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }

    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, 0.35);
    this.padGain.gain.setTargetAtTime(0, now, 0.35);

    const oscillators = this.padOscillators;
    this.padOscillators = [];
    oscillators.forEach((oscillator) => {
      try {
        oscillator.stop(now + 1.6);
      } catch {
        // Already stopped.
      }
    });
  }

  dispose() {
    this.stop();
    this.master.disconnect();
    this.padGain.disconnect();
    this.delay.disconnect();
  }

  private startPad() {
    if (this.padOscillators.length > 0) {
      return;
    }

    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.Q.value = 3;
    filter.connect(this.padGain);

    // Slow filter sweep keeps the pad from sitting still and turning into drone.
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    [0, 0.5, 1.005].forEach((detune, index) => {
      const oscillator = this.context.createOscillator();
      oscillator.type = index === 2 ? "sine" : "triangle";
      oscillator.frequency.value = PAD_ROOTS[0] * (index === 2 ? 2 : 1);
      oscillator.detune.value = detune * 8;
      oscillator.connect(filter);
      oscillator.start();
      this.padOscillators.push(oscillator);
    });

    this.padOscillators.push(lfo);
  }

  private schedule() {
    const horizon = this.context.currentTime + SCHEDULE_AHEAD_SECONDS;

    while (this.nextStepTime < horizon) {
      this.scheduleStep(this.step, this.nextStepTime);
      this.step += 1;
      this.nextStepTime += STEP_SECONDS;
    }
  }

  private scheduleStep(step: number, time: number) {
    if (wantsTicks(this.mode) && isTickStep(step)) {
      this.scheduleTick(time, step % (STEPS_PER_TICK * 2) === 0);
    }

    if (!wantsMusic(this.mode)) {
      return;
    }

    this.scheduleArpNote(arpNoteAt(step), time);

    if (step % STEPS_PER_BAR === 0) {
      const root = padRootAt(step);
      this.padOscillators.forEach((oscillator, index) => {
        if (index > 2) {
          return;
        }
        oscillator.frequency.setTargetAtTime(
          index === 2 ? root * 2 : root,
          time,
          0.9,
        );
      });
    }

    // A soft bass pulse on the downbeat gives the loop a pulse to lean on.
    if (step % STEPS_PER_BAR === 0) {
      this.scheduleBass(padRootAt(step) / 2, time);
    }
  }

  private scheduleTick(time: number, accented: boolean) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    filter.type = "bandpass";
    filter.frequency.value = accented ? 2400 : 1900;
    filter.Q.value = 9;

    oscillator.type = "square";
    oscillator.frequency.value = accented ? 2400 : 1900;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accented ? 0.09 : 0.06, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    oscillator.start(time);
    oscillator.stop(time + 0.07);
  }

  private scheduleArpNote(frequency: number, time: number) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.value = 2200;

    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.11, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.85);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    gain.connect(this.delay);

    oscillator.start(time);
    oscillator.stop(time + 0.9);
  }

  private scheduleBass(frequency: number, time: number) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.14, time + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.4);

    oscillator.connect(gain);
    gain.connect(this.master);

    oscillator.start(time);
    oscillator.stop(time + 1.5);
  }
}
