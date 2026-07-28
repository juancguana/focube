import { useEffect } from "react";
import { copy } from "@/copy";

/**
 * Updates `document.title` to reflect the current timer state, so the tab is
 * useful while the user works somewhere else.
 *
 * Running:  `24:59 · Trabajo — Focube`
 * Paused:   `24:59 · En pausa — Focube`
 * Idle:     `Focube`
 *
 * The title is derived from props, so it only changes when the readout does —
 * the caller ticks once per second at most.
 */
export type TitleMode = "countdown" | "pomodoro" | "clock" | null;

/** Builds the tab title for a timer state. Pure, so it is directly testable. */
export function formatTabTitle(
  remainingMs: number,
  mode: TitleMode,
  isPaused: boolean,
  isIdle: boolean,
): string {
  if (isIdle) {
    return copy.brand;
  }

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const modeLabel = isPaused
    ? copy.title.paused
    : mode === "pomodoro"
      ? copy.title.work
      : mode === "countdown"
        ? copy.title.countdown
        : copy.title.clock;

  return `${formatted} · ${modeLabel} — ${copy.brand}`;
}

export function useDocumentTitle(
  remainingMs: number,
  mode: TitleMode,
  isPaused: boolean,
  isIdle: boolean,
) {
  useEffect(() => {
    document.title = formatTabTitle(remainingMs, mode, isPaused, isIdle);
  }, [remainingMs, mode, isPaused, isIdle]);

  // Leaving the page (or unmounting in tests) must not strand a countdown in
  // the tab title.
  useEffect(() => {
    return () => {
      document.title = copy.brand;
    };
  }, []);
}
