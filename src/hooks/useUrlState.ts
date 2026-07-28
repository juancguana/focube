import { useEffect, useRef, useCallback } from "react";
import {
  usePreferencesStore,
  type CubeFinish,
  type SoundscapeId,
} from "@/stores/preferencesStore";

const PARAM_FINISH = "finish";
const PARAM_SOUNDSCAPE = "sound";
const PARAM_MINUTES = "min";

const VALID_FINISHES: ReadonlySet<string> = new Set([
  "black",
  "white",
  "blue",
  "lavender",
]);

const VALID_SOUNDSCAPES: ReadonlySet<string> = new Set([
  "off",
  "ticks",
  "focus",
  "both",
]);

const MIN_SHARED_MINUTES = 1;
const MAX_SHARED_MINUTES = 120;

export interface SharedSetup {
  finish: CubeFinish | null;
  soundscape: SoundscapeId | null;
  customMinutes: number | null;
}

/**
 * Reads a shared setup out of a query string.
 *
 * A link is untrusted input: anything unknown or out of range is dropped so a
 * malformed URL can never leave the app in a state its own UI cannot produce.
 */
export function parseSetupParams(search: string): SharedSetup {
  const params = new URLSearchParams(search);

  const finish = params.get(PARAM_FINISH);
  const soundscape = params.get(PARAM_SOUNDSCAPE);
  const rawMinutes = params.get(PARAM_MINUTES);
  const minutes = rawMinutes === null ? NaN : Number(rawMinutes);

  return {
    finish:
      finish && VALID_FINISHES.has(finish) ? (finish as CubeFinish) : null,
    soundscape:
      soundscape && VALID_SOUNDSCAPES.has(soundscape)
        ? (soundscape as SoundscapeId)
        : null,
    customMinutes:
      Number.isInteger(minutes) &&
      minutes >= MIN_SHARED_MINUTES &&
      minutes <= MAX_SHARED_MINUTES
        ? minutes
        : null,
  };
}

export function buildSetupParams(
  finish: CubeFinish,
  soundscape: SoundscapeId,
  customMinutes: number,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set(PARAM_FINISH, finish);
  params.set(PARAM_SOUNDSCAPE, soundscape);
  params.set(PARAM_MINUTES, String(customMinutes));
  return params;
}

/**
 * Reads Focube preferences from the URL on mount and keeps the URL in sync
 * with the store as they change.
 *
 * Provides `getShareableUrl()` for the share button and `hasUrlParams` to
 * hint that the page was loaded with shared state.
 */
export function useUrlState() {
  const cubeFinish = usePreferencesStore((s) => s.cubeFinish);
  const setCubeFinish = usePreferencesStore((s) => s.setCubeFinish);
  const soundscape = usePreferencesStore((s) => s.soundscape);
  const setSoundscape = usePreferencesStore((s) => s.setSoundscape);
  const customMinutesStore = usePreferencesStore((s) => s.customMinutes);
  const setCustomMinutesStore = usePreferencesStore((s) => s.setCustomMinutes);

  const appliedRef = useRef(false);

  // On mount, read URL params and apply them.
  useEffect(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;

    const shared = parseSetupParams(window.location.search);

    if (shared.finish && shared.finish !== cubeFinish) {
      setCubeFinish(shared.finish);
    }

    if (shared.soundscape && shared.soundscape !== soundscape) {
      setSoundscape(shared.soundscape);
    }

    if (
      shared.customMinutes !== null &&
      shared.customMinutes !== customMinutesStore
    ) {
      setCustomMinutesStore(shared.customMinutes);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep URL in sync with the store (only when the URL already has params or
  // the user interacted).
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (!isDirtyRef.current && !window.location.search) return;
    isDirtyRef.current = true;

    const params = buildSetupParams(cubeFinish, soundscape, customMinutesStore);
    const newUrl =
      window.location.pathname + "?" + params.toString() + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  }, [cubeFinish, soundscape, customMinutesStore]);

  const getShareableUrl = useCallback(() => {
    const params = buildSetupParams(cubeFinish, soundscape, customMinutesStore);
    return window.location.origin + window.location.pathname + "?" + params.toString();
  }, [cubeFinish, soundscape, customMinutesStore]);

  const hasUrlParams = window.location.search.length > 1;

  return { getShareableUrl, hasUrlParams };
}
