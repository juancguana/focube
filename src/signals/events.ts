/**
 * Pure event construction for the analytics seam.
 *
 * Frozen taxonomy: exactly 7 events, `snake_case`, past-tense, no free text,
 * no PII, no identifier. Every builder below routes its output through
 * `sanitizeProperties`, and constructs its properties object from named
 * fields only — an extra field smuggled into a builder's input (past the
 * type system, e.g. via a cast) is simply never read, so it can never reach
 * the emitted event.
 *
 * `ms_since_load` (for `session_started` and `onboarding_dismissed`) is
 * computed by the CALLER at `trackEvent` time (`performance.now()` relative
 * to module load), not by `track.ts` at flush time — buffering must never
 * distort event ordering. See `track.ts` for the buffering rationale.
 */

export type EventName =
  | "app_opened"
  | "session_started"
  | "session_completed"
  | "session_abandoned"
  | "share_clicked"
  | "pwa_installed"
  | "onboarding_dismissed";

export type PropertyValue = string | number | boolean;
export type EventProperties = Readonly<Record<string, PropertyValue>>;

export interface AnalyticsEvent {
  readonly name: EventName;
  readonly properties: EventProperties;
}

const MAX_STRING_LENGTH = 64;

/**
 * The PII gate: drops `null`/`undefined`, rejects any value that is not
 * `string | number | boolean` (arrays/objects cannot smuggle nested PII
 * through), and truncates strings to 64 chars.
 */
export function sanitizeProperties(
  raw: Record<string, unknown>,
): EventProperties {
  const result: Record<string, PropertyValue> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;

    if (typeof value === "string") {
      result[key] = value.slice(0, MAX_STRING_LENGTH);
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    }
    // Any other type (object, array, function, symbol...) is silently
    // dropped — it is never a legitimate analytics property value.
  }

  return result;
}

function buildEvent(
  name: EventName,
  properties: Record<string, unknown>,
): AnalyticsEvent {
  return { name, properties: sanitizeProperties(properties) };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * UTC-safe day count between two `YYYY-MM-DD` keys. Parsing as UTC avoids
 * the off-by-one a local-time diff can produce across a DST transition.
 * `firstVisitKey === ""` is the "no prior visit" sentinel (see
 * `preferencesStore.firstVisitDate`) and always returns `0` — PostHog runs
 * with `persistence: "memory"` (D7-return invariant), so this first-party
 * value is the only source for `days_since_first_visit`.
 */
export function daysSinceFirstVisit(
  firstVisitKey: string,
  today: string,
): number {
  if (!firstVisitKey) return 0;

  const first = Date.parse(`${firstVisitKey}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);

  if (Number.isNaN(first) || Number.isNaN(now)) return 0;

  return Math.max(0, Math.round((now - first) / MS_PER_DAY));
}

export function appOpened(input: {
  isFirstVisit: boolean;
  daysSinceFirstVisit: number;
  hasSharedSetup: boolean;
  isStandalone: boolean;
}): AnalyticsEvent {
  return buildEvent("app_opened", {
    is_first_visit: input.isFirstVisit,
    days_since_first_visit: input.daysSinceFirstVisit,
    has_shared_setup: input.hasSharedSetup,
    is_standalone: input.isStandalone,
  });
}

/** How the session was started — the gesture, not the mode. */
export type SessionSource = "cube" | "cta" | "keyboard" | "panel";

export function sessionStarted(input: {
  mode: string;
  minutes: number;
  msSinceLoad: number;
  sessionIndexInVisit: number;
  source: SessionSource;
}): AnalyticsEvent {
  return buildEvent("session_started", {
    mode: input.mode,
    minutes: input.minutes,
    ms_since_load: input.msSinceLoad,
    session_index_in_visit: input.sessionIndexInVisit,
    source: input.source,
  });
}

export function sessionCompleted(input: {
  mode: string;
  minutes: number;
  soundscape: string;
  alertType: string;
  wasHidden: boolean;
}): AnalyticsEvent {
  return buildEvent("session_completed", {
    mode: input.mode,
    minutes: input.minutes,
    soundscape: input.soundscape,
    alert_type: input.alertType,
    was_hidden: input.wasHidden,
  });
}

export function sessionAbandoned(input: {
  mode: string;
  minutes: number;
  elapsedRatio: number;
}): AnalyticsEvent {
  return buildEvent("session_abandoned", {
    mode: input.mode,
    minutes: input.minutes,
    elapsed_ratio: input.elapsedRatio,
  });
}

export function shareClicked(input: {
  mode: string;
  minutes: number;
  finish: string;
  soundscape: string;
}): AnalyticsEvent {
  return buildEvent("share_clicked", {
    mode: input.mode,
    minutes: input.minutes,
    finish: input.finish,
    soundscape: input.soundscape,
  });
}

export function pwaInstalled(): AnalyticsEvent {
  return buildEvent("pwa_installed", {});
}

export function onboardingDismissed(input: {
  msSinceLoad: number;
  dismissedVia: "cta" | "gesture";
}): AnalyticsEvent {
  return buildEvent("onboarding_dismissed", {
    ms_since_load: input.msSinceLoad,
    dismissed_via: input.dismissedVia,
  });
}
