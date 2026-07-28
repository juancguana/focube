import type { AnalyticsEvent } from "./events";

/**
 * The sink registry + load state machine for the analytics seam.
 *
 * This module NEVER imports `posthogSink.ts` — the sink is injected via
 * `configureAnalytics({ loader })`, wired at app mount by `index.ts`. That
 * keeps this module testable against a plain fake object with zero
 * mocking, and keeps `posthog-js` entirely out of any bundle graph this
 * file is part of.
 *
 * State machine: `disabled -> (no loader) terminal`
 *                 `idle -> loading -> ready`
 *                 `idle -> loading -> disabled` (loader resolved null,
 *                 rejected, or threw — ad-block/CSP/offline)
 *
 * `disabled` is both the starting state (no loader configured at all) and
 * the terminal failure state — in both cases `trackEvent` is a total,
 * silent no-op. It is never retried once reached via a load failure.
 */

export interface AnalyticsSink {
  capture(event: AnalyticsEvent): void;
}

export type SinkLoader = () => Promise<AnalyticsSink | null>;

type LoadState = "disabled" | "idle" | "loading" | "ready";

/** Far above any legitimate <2s pre-load event count — overflow means a
 * bug or a loop, not real usage. Drop-newest preserves the head-of-funnel
 * events (`app_opened`, first `session_started`) the PRD metrics need. */
const QUEUE_CAP = 20;
const IDLE_CALLBACK_TIMEOUT_MS = 2000;
const FALLBACK_LOAD_DELAY_MS = 200;

let state: LoadState = "disabled";
let loader: SinkLoader | null = null;
let sink: AnalyticsSink | null = null;
let queue: AnalyticsEvent[] = [];

/** Wires (or removes) the sink loader. Called once at app mount. */
export function configureAnalytics(options: { loader: SinkLoader | null }): void {
  loader = options.loader;
  sink = null;
  queue = [];
  state = loader ? "idle" : "disabled";
}

function safeCapture(target: AnalyticsSink, event: AnalyticsEvent): void {
  try {
    target.capture(event);
  } catch {
    // A throwing sink must never break the app — swallow and move on.
  }
}

function flush(): void {
  if (!sink) return;
  const pending = queue;
  queue = [];
  for (const event of pending) {
    safeCapture(sink, event);
  }
}

async function load(): Promise<void> {
  const activeLoader = loader;
  if (!activeLoader) {
    state = "disabled";
    queue = [];
    return;
  }

  try {
    const resolved = await activeLoader();
    if (!resolved) {
      // Loader ran but declined (e.g. no VITE_POSTHOG_KEY at import time).
      state = "disabled";
      queue = [];
      return;
    }
    sink = resolved;
    state = "ready";
    flush();
  } catch {
    // Ad-block, CSP refusal, offline: silent terminal disable, never retried.
    state = "disabled";
    queue = [];
  }
}

function scheduleLoad(): void {
  const idleWindow = globalThis as typeof globalThis & {
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout?: number },
    ) => number;
  };

  const run = () => {
    void load();
  };

  if (typeof idleWindow.requestIdleCallback === "function") {
    idleWindow.requestIdleCallback(run, { timeout: IDLE_CALLBACK_TIMEOUT_MS });
  } else {
    setTimeout(run, FALLBACK_LOAD_DELAY_MS);
  }
}

/**
 * Records an analytics event. Total no-op in the `disabled` state — no
 * buffer growth, no network, no console output, no throw. This is the
 * shipped-by-default state (no `VITE_POSTHOG_KEY`) and the most
 * thoroughly tested path.
 */
export function trackEvent(event: AnalyticsEvent): void {
  if (state === "disabled") return;

  if (state === "ready" && sink) {
    safeCapture(sink, event);
    return;
  }

  if (queue.length < QUEUE_CAP) {
    queue.push(event);
  }
  // else: silent drop-newest.

  if (state === "idle") {
    state = "loading";
    scheduleLoad();
  }
}

/** Test-only: resets the module to its pristine, disabled starting state. */
export function __resetAnalytics(): void {
  state = "disabled";
  loader = null;
  sink = null;
  queue = [];
}
