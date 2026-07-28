import { describe, expect, it } from "vitest";
import { resolveAnalyticsConfig } from "./index";

describe("resolveAnalyticsConfig — env-driven wiring", () => {
  it("disables analytics entirely when no key is set", () => {
    const config = resolveAnalyticsConfig(undefined, undefined);
    expect(config.loader).toBeNull();
  });

  it("disables analytics when the key is an empty string", () => {
    const config = resolveAnalyticsConfig("", "https://us.i.posthog.com");
    expect(config.loader).toBeNull();
  });

  it("builds a loader when a key is set and no host override is given (default host)", () => {
    const config = resolveAnalyticsConfig("phc_test_key", undefined);
    expect(typeof config.loader).toBe("function");
  });

  it("builds a loader when a key and a valid https host are both set", () => {
    const config = resolveAnalyticsConfig(
      "phc_test_key",
      "https://eu.i.posthog.com",
    );
    expect(typeof config.loader).toBe("function");
  });

  it("disables analytics when VITE_POSTHOG_HOST is not https:, even with a key present", () => {
    const config = resolveAnalyticsConfig(
      "phc_test_key",
      "http://us.i.posthog.com",
    );
    expect(config.loader).toBeNull();
  });

  it("disables analytics when VITE_POSTHOG_HOST is an unparseable value", () => {
    const config = resolveAnalyticsConfig("phc_test_key", "not-a-url");
    expect(config.loader).toBeNull();
  });
});
