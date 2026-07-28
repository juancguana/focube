import { useEffect, useRef } from "react";

/**
 * The slice of `WakeLockSentinel` this app uses. Narrowed to an interface so
 * the controller can be driven by a fake in tests — the real thing cannot be
 * constructed outside a browser with a visible document.
 */
export interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
}

export type WakeLockRequester = () => Promise<WakeLockSentinelLike>;

export type WakeLockConditions = {
  /** Focus mode (or the mini player) is on. */
  focusActive: boolean;
  /** The tab is in the foreground. A hidden tab cannot hold a lock at all. */
  documentVisible: boolean;
  /** The browser exposes the Screen Wake Lock API over a secure context. */
  supported: boolean;
};

/** Whether the screen should be kept awake right now. */
export function shouldHoldWakeLock(state: WakeLockConditions): boolean {
  return state.supported && state.focusActive && state.documentVisible;
}

export function isWakeLockSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator &&
    typeof (navigator as Navigator).wakeLock?.request === "function"
  );
}

/**
 * Holds a screen wake lock for as long as it is wanted, and not a moment
 * longer.
 *
 * This exists because the API is not fire-and-forget. Browsers release a
 * screen lock the instant the tab is hidden and never return it, so anything
 * that survives a glance at another app has to notice and ask again. On top of
 * that, `request()` rejects outright when the document is not visible or the
 * OS is in low-power mode, and a rejection must not leave the controller stuck
 * believing it holds something.
 *
 * `sync` is the only entry point: tell it whether the lock is wanted and it
 * reconciles. Calls are serialised through `pending` so two effects firing in
 * the same tick cannot open two locks — only the handle kept in `sentinel`
 * could ever be released, so the second one would leak for the life of the
 * page.
 */
export class WakeLockController {
  private sentinel: WakeLockSentinelLike | null = null;
  private pending: Promise<void> = Promise.resolve();

  constructor(private readonly request: WakeLockRequester) {}

  sync(wanted: boolean): Promise<void> {
    this.pending = this.pending.then(() => this.reconcile(wanted));
    return this.pending;
  }

  private async reconcile(wanted: boolean): Promise<void> {
    // A sentinel the browser already dropped is not a lock we hold.
    if (this.sentinel?.released) {
      this.sentinel = null;
    }

    if (wanted === Boolean(this.sentinel)) {
      return;
    }

    if (wanted) {
      try {
        const sentinel = await this.request();
        sentinel.addEventListener("release", () => {
          if (this.sentinel === sentinel) {
            this.sentinel = null;
          }
        });
        this.sentinel = sentinel;
      } catch {
        // Denied, hidden, or low battery. Nothing to clean up, and the next
        // sync is free to try again.
        this.sentinel = null;
      }
      return;
    }

    const held = this.sentinel;
    this.sentinel = null;
    try {
      await held?.release();
    } catch {
      // Already gone; releasing twice is not an error worth surfacing.
    }
  }
}

/**
 * Keeps the screen awake while focus mode is on.
 *
 * A focus session is the one time this app is meant to be watched rather than
 * used: the cube is the point, nobody is touching the screen, and both phones
 * and laptops dim and lock on their own after a minute or two of that.
 *
 * Degrades silently where the API is missing (Safari before 16.4, any plain
 * HTTP origin) — there is no honest fallback, and a warning about it would
 * only be noise during focus.
 */
export function useWakeLock(focusActive: boolean) {
  const controllerRef = useRef<WakeLockController | null>(null);

  useEffect(() => {
    if (!isWakeLockSupported()) return;

    const controller =
      controllerRef.current ??
      new WakeLockController(() =>
        navigator.wakeLock.request("screen") as Promise<WakeLockSentinelLike>,
      );
    controllerRef.current = controller;

    const apply = () =>
      void controller.sync(
        shouldHoldWakeLock({
          focusActive,
          documentVisible: !document.hidden,
          supported: true,
        }),
      );

    apply();
    // Coming back to the tab is the moment the lock has to be re-taken: the
    // browser dropped it on the way out and will not restore it.
    document.addEventListener("visibilitychange", apply);

    return () => {
      document.removeEventListener("visibilitychange", apply);
      void controller.sync(false);
    };
  }, [focusActive]);
}
