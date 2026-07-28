import type { AnalyticsSink } from "./track";

/**
 * Loads and configures PostHog. The only file in this module that knows
 * PostHog exists — `track.ts` never imports this file directly; it is
 * injected as a `SinkLoader` via `configureAnalytics` (see `index.ts`).
 *
 * Not unit-tested: real `posthog-js` init and network capture require a
 * live browser + key, same category as `focusAudio.ts`'s `AudioContext`
 * usage. Verify manually per the spec's "PostHog sink is manual-QA only"
 * scenario: idle-scheduled init, `persistence: 'memory'`,
 * `autocapture: false`, `disable_session_recording: true`,
 * `capture_pageview: false`, events visible in the PostHog live view.
 *
 * `advanced_disable_flags: true` — PINNED against the installed
 * `posthog-js@1.407.3` types (`@posthog/types/dist/posthog-config.d.ts`):
 * this is the current option name for skipping the `/flags` (formerly
 * `/decide`) feature-flag round trip. The older `advanced_disable_decide`
 * name still exists for migration but is marked `@deprecated` in the
 * installed version's types — do not use it in new code.
 *
 * `$current_url` is denylisted because it carries the shared-setup query
 * string, which is already sent explicitly as typed event properties.
 */
export async function loadPostHogSink(
  key: string,
  host: string,
): Promise<AnalyticsSink | null> {
  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(key, {
      api_host: host,
      persistence: "memory",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_flags: true,
      property_denylist: [
        "$current_url",
        "$referrer",
        "$initial_referrer",
        "$pathname",
      ],
    });

    return {
      capture: (event) => posthog.capture(event.name, event.properties),
    };
  } catch {
    // Ad-blocked, offline, or CSP-refused: silent terminal disable.
    return null;
  }
}
