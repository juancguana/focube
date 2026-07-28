/**
 * Warm session-end chime: 4 overlapping A-major voices through a filtered
 * feedback delay. Extracted from `Home.tsx` so the pure voice table and its
 * derived gain/duration arithmetic can be unit-tested without an
 * `AudioContext`, following the `focusAudio.ts` precedent (pure helpers
 * tested, imperative Web Audio graph left to manual QA).
 */

export interface ChimeVoice {
  /** Pitch in Hz. */
  readonly frequency: number;
  /** Seconds after the chime starts that this voice begins. */
  readonly offset: number;
  /** Oscillator waveform. `"square"` is deliberately not representable — too harsh for a closing chime. */
  readonly type: "sine" | "triangle";
  /** Seconds to ramp from silence to `peak`. */
  readonly attack: number;
  /** Seconds to ramp from `peak` back to silence. */
  readonly decay: number;
  /** Linear peak gain for this voice alone. */
  readonly peak: number;
}

/** Ascending A major: root, octave, major 3rd, 5th — rings instead of blipping. */
export const CHIME_VOICES: readonly ChimeVoice[] = [
  { frequency: 220, offset: 0, type: "sine", attack: 0.02, decay: 0.9, peak: 0.1 },
  { frequency: 440, offset: 0, type: "sine", attack: 0.015, decay: 0.85, peak: 0.14 },
  { frequency: 554.37, offset: 0.16, type: "triangle", attack: 0.015, decay: 0.75, peak: 0.12 },
  { frequency: 659.25, offset: 0.32, type: "sine", attack: 0.015, decay: 0.7, peak: 0.12 },
];

export const CHIME_MASTER_GAIN = 0.3;
export const CHIME_DRY_LOWPASS_HZ = 2600;
export const CHIME_DELAY_TIME = 0.22;
export const CHIME_DELAY_SEND = 0.28;
export const CHIME_DELAY_FEEDBACK = 0.25;
export const CHIME_DELAY_DAMP_HZ = 1600;
/** How many delay repeats to budget into the pessimistic duration bound. */
export const CHIME_DELAY_TAIL_REPEATS = 2;

/**
 * Total audible length: the latest voice to finish its own envelope, plus a
 * fixed tail budget for the delay repeats. Pure — no `AudioContext` needed.
 */
export function chimeDurationSeconds(
  voices: readonly ChimeVoice[] = CHIME_VOICES,
): number {
  const lastVoiceEnd = Math.max(
    ...voices.map((voice) => voice.offset + voice.attack + voice.decay),
  );
  return lastVoiceEnd + CHIME_DELAY_TIME * CHIME_DELAY_TAIL_REPEATS;
}

/**
 * Deliberately pessimistic peak-gain bound: sums every voice's peak as if
 * they all sounded simultaneously (the 0/0/0.16/0.32 offsets prevent that in
 * practice), then adds the fully-summed infinite delay tail
 * (`send / (1 - feedback)`, the closed form of a geometric series of
 * repeats). If this bound holds, the real signal cannot clip.
 */
export function chimePeakGain(
  voices: readonly ChimeVoice[] = CHIME_VOICES,
): number {
  const summedPeaks = voices.reduce((total, voice) => total + voice.peak, 0);
  const delayTailFactor = 1 + CHIME_DELAY_SEND / (1 - CHIME_DELAY_FEEDBACK);
  return CHIME_MASTER_GAIN * summedPeaks * delayTailFactor;
}

/**
 * Plays the chime exactly once. Shared by the real alert and the "Probar
 * alarma" preview so what you hear is exactly what will ring.
 *
 *     osc ──▶ voice gain (ADSR) ──┬──▶ lowpass 2600Hz ──▶ master 0.30 ──▶ destination
 *                                 └──▶ send ──▶ delay 0.22s ──────────────▶ master
 *                                                  │        ▲
 *                                                  ▼        │
 *                                             lowpass 1600Hz ─▶ fb 0.25 ──┘
 */
export function playChime(context: AudioContext) {
  const startAt = context.currentTime;

  const master = context.createGain();
  master.gain.value = CHIME_MASTER_GAIN;
  master.connect(context.destination);

  // Shared filtered feedback delay — the chime's "room".
  const delay = context.createDelay(1);
  delay.delayTime.value = CHIME_DELAY_TIME;
  delay.connect(master);

  const damp = context.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = CHIME_DELAY_DAMP_HZ;

  const feedback = context.createGain();
  feedback.gain.value = CHIME_DELAY_FEEDBACK;

  delay.connect(damp);
  damp.connect(feedback);
  feedback.connect(delay);

  CHIME_VOICES.forEach((voice) => {
    const voiceStart = startAt + voice.offset;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const dryFilter = context.createBiquadFilter();
    const sendGain = context.createGain();

    oscillator.type = voice.type;
    oscillator.frequency.setValueAtTime(voice.frequency, voiceStart);

    dryFilter.type = "lowpass";
    dryFilter.frequency.value = CHIME_DRY_LOWPASS_HZ;

    sendGain.gain.value = CHIME_DELAY_SEND;

    gain.gain.setValueAtTime(0.0001, voiceStart);
    gain.gain.exponentialRampToValueAtTime(
      voice.peak,
      voiceStart + voice.attack,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      voiceStart + voice.attack + voice.decay,
    );

    oscillator.connect(gain);
    gain.connect(dryFilter);
    dryFilter.connect(master);
    gain.connect(sendGain);
    sendGain.connect(delay);

    oscillator.start(voiceStart);
    oscillator.stop(voiceStart + voice.attack + voice.decay + 0.05);
  });
}
