import { useEffect, useRef } from "react";

const DEFAULT_TITLE = "Focube";

/**
 * Updates `document.title` to reflect the current timer state.
 *
 * While a timer runs, the title shows:
 *   `{mm:ss} · {mode} — Focube`
 *
 * When idle, paused, or completed, restores to "Focube".
 * Updates at most once per second to avoid thrashing.
 */
export function useDocumentTitle(
  remainingMs: number,
  mode: "countdown" | "pomodoro" | "clock" | null,
  isPaused: boolean,
  isIdle: boolean,
) {
  const lastTitleRef = useRef(document.title);

  useEffect(() => {
    if (isIdle) {
      if (document.title !== DEFAULT_TITLE) {
        document.title = DEFAULT_TITLE;
      }
      return;
    }

    if (isPaused) {
      if (document.title !== DEFAULT_TITLE) {
        document.title = DEFAULT_TITLE;
      }
      return;
    }

    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    let modeLabel = "";
    if (mode === "pomodoro") {
      modeLabel = "Trabajo";
    } else if (mode === "countdown") {
      modeLabel = "Temporizador";
    } else {
      modeLabel = "Reloj";
    }

    const nextTitle = `${formatted} · ${modeLabel} — Focube`;

    if (lastTitleRef.current !== nextTitle) {
      lastTitleRef.current = nextTitle;
      document.title = nextTitle;
    }
  }, [remainingMs, mode, isPaused, isIdle]);
}
