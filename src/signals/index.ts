/**
 * Product signals — the entry point for the analytics seam.
 *
 * ## Why this directory is not called `analytics/`
 *
 * Content blockers match `/analytics/` in a request path. In dev, Vite serves
 * every module as its own URL, so `src/analytics/events.ts` was blocked with
 * `ERR_BLOCKED_BY_CLIENT` — and because `events.ts` is a static import of
 * `Home.tsx`, the whole app failed to boot. The modules in here hold pure
 * logic and open no connections, so blocking them buys the user no privacy
 * and only breaks the page. Hence the rename.
 *
 * `posthogSink.ts` deliberately KEEPS its name. It is the only file that
 * actually talks to the network, so a blocker SHOULD be able to stop it —
 * that is the user's choice working as intended, and the seam already treats
 * a blocked sink as terminal-disabled without breaking anything. Do not
 * rename it to slip past a filter list.
 */

import { configureAnalytics, type SinkLoader } from "./track";

const DEFAULT_HOST = "https://us.i.posthog.com";

/**
 * Resolves `VITE_POSTHOG_HOST` (or the default) to a safe absolute origin.
 * A non-`https:` value disables analytics entirely rather than downgrading
 * the transport — an env typo must never send events over plain http.
 */
function resolveHost(raw: string | undefined): string | null {
  const value = raw && raw.length > 0 ? raw : DEFAULT_HOST;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;

  return parsed.origin;
}

function buildLoader(key: string, host: string): SinkLoader {
  return async () => {
    const { loadPostHogSink } = await import("./posthogSink");
    return loadPostHogSink(key, host);
  };
}

/**
 * Pure resolution of env values into an analytics config — no side
 * effects, fully unit-tested. `initAnalytics` is the only caller that
 * touches `import.meta.env` and `configureAnalytics`.
 */
export function resolveAnalyticsConfig(
  key: string | undefined,
  rawHost: string | undefined,
): { loader: SinkLoader | null } {
  if (!key) return { loader: null };

  const host = resolveHost(rawHost);
  if (!host) return { loader: null };

  return { loader: buildLoader(key, host) };
}

/** Wires the analytics seam at app mount. See `main.tsx`. */
export function initAnalytics(): void {
  configureAnalytics(
    resolveAnalyticsConfig(
      import.meta.env.VITE_POSTHOG_KEY as string | undefined,
      import.meta.env.VITE_POSTHOG_HOST as string | undefined,
    ),
  );
}

export { trackEvent } from "./track";
