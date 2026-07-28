import { describe, expect, it } from "vitest";
import {
  appOpened,
  daysSinceFirstVisit,
  onboardingDismissed,
  pwaInstalled,
  sanitizeProperties,
  sessionAbandoned,
  sessionCompleted,
  sessionStarted,
  shareClicked,
} from "./events";

describe("sanitizeProperties — PII gate", () => {
  it("drops null and undefined values", () => {
    const result = sanitizeProperties({
      mode: "five",
      missing: undefined,
      absent: null,
    });
    expect(result).toEqual({ mode: "five" });
  });

  it("rejects non-primitive values (objects and arrays)", () => {
    const result = sanitizeProperties({
      mode: "five",
      nested: { leak: true },
      list: [1, 2, 3],
    });
    expect(result).toEqual({ mode: "five" });
  });

  it("keeps numbers and booleans untouched", () => {
    const result = sanitizeProperties({ minutes: 25, was_hidden: true });
    expect(result).toEqual({ minutes: 25, was_hidden: true });
  });

  it("truncates strings to 64 characters", () => {
    const long = "x".repeat(100);
    const result = sanitizeProperties({ label: long });
    expect(result.label).toBe("x".repeat(64));
    expect((result.label as string).length).toBe(64);
  });
});

describe("event builders — frozen taxonomy, no PII can be smuggled in", () => {
  it("appOpened emits exactly the whitelisted properties", () => {
    const event = appOpened({
      isFirstVisit: true,
      daysSinceFirstVisit: 0,
      hasSharedSetup: false,
      isStandalone: false,
    });
    expect(event).toEqual({
      name: "app_opened",
      properties: {
        is_first_visit: true,
        days_since_first_visit: 0,
        has_shared_setup: false,
        is_standalone: false,
      },
    });
  });

  it("sessionStarted strips an unlisted key smuggled in via a type cast (e.g. email)", () => {
    const withLeak = {
      mode: "five",
      minutes: 5,
      msSinceLoad: 120,
      sessionIndexInVisit: 1,
      source: "cube",
      email: "leak@example.com",
    };
    const event = sessionStarted(
      withLeak as unknown as Parameters<typeof sessionStarted>[0],
    );
    expect(event.properties).not.toHaveProperty("email");
    expect(event).toEqual({
      name: "session_started",
      properties: {
        mode: "five",
        minutes: 5,
        ms_since_load: 120,
        session_index_in_visit: 1,
        source: "cube",
      },
    });
  });

  it("sessionCompleted emits mode/minutes/soundscape/alert_type/was_hidden", () => {
    const event = sessionCompleted({
      mode: "pomodoro",
      minutes: 25,
      soundscape: "focus",
      alertType: "sound",
      wasHidden: true,
    });
    expect(event).toEqual({
      name: "session_completed",
      properties: {
        mode: "pomodoro",
        minutes: 25,
        soundscape: "focus",
        alert_type: "sound",
        was_hidden: true,
      },
    });
  });

  it("sessionAbandoned emits mode/minutes/elapsed_ratio", () => {
    const event = sessionAbandoned({
      mode: "ten",
      minutes: 10,
      elapsedRatio: 0.42,
    });
    expect(event).toEqual({
      name: "session_abandoned",
      properties: { mode: "ten", minutes: 10, elapsed_ratio: 0.42 },
    });
  });

  it("shareClicked emits mode/minutes/finish/soundscape", () => {
    const event = shareClicked({
      mode: "five",
      minutes: 5,
      finish: "black",
      soundscape: "off",
    });
    expect(event).toEqual({
      name: "share_clicked",
      properties: {
        mode: "five",
        minutes: 5,
        finish: "black",
        soundscape: "off",
      },
    });
  });

  it("pwaInstalled carries no properties at all", () => {
    const event = pwaInstalled();
    expect(event).toEqual({ name: "pwa_installed", properties: {} });
  });

  it("onboardingDismissed emits ms_since_load/dismissed_via", () => {
    const event = onboardingDismissed({
      msSinceLoad: 4200,
      dismissedVia: "cta",
    });
    expect(event).toEqual({
      name: "onboarding_dismissed",
      properties: { ms_since_load: 4200, dismissed_via: "cta" },
    });
  });
});

describe("daysSinceFirstVisit — UTC-safe day count", () => {
  it("returns 0 when firstVisitKey is the empty sentinel", () => {
    expect(daysSinceFirstVisit("", "2026-07-27")).toBe(0);
  });

  it("returns 0 when today is the same calendar day as the first visit", () => {
    expect(daysSinceFirstVisit("2026-07-27", "2026-07-27")).toBe(0);
  });

  it("returns a positive day count for a later date", () => {
    expect(daysSinceFirstVisit("2026-07-20", "2026-07-27")).toBe(7);
  });

  it("is not thrown off by a DST-style local-time offset (parsed as UTC)", () => {
    // A local-time diff can misfire around a DST transition; UTC parsing
    // must not care about the machine's local timezone at all.
    expect(daysSinceFirstVisit("2026-03-01", "2026-03-09")).toBe(8);
  });
});
