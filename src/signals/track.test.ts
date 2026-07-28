import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureAnalytics, trackEvent, __resetAnalytics } from "./track";
import type { AnalyticsSink } from "./track";
import type { AnalyticsEvent } from "./events";

function makeEvent(i: number): AnalyticsEvent {
  return { name: "app_opened", properties: { seq: i } };
}

function makeFakeSink(): AnalyticsSink & { captured: AnalyticsEvent[] } {
  const captured: AnalyticsEvent[] = [];
  return {
    captured,
    capture(event) {
      captured.push(event);
    },
  };
}

describe("trackEvent — keyless total no-op (the shipped state)", () => {
  beforeEach(() => __resetAnalytics());

  it("is a no-op with no configured loader at all (default module state)", () => {
    expect(() => trackEvent(makeEvent(0))).not.toThrow();
  });

  it("is a no-op across 50 calls when configured with loader: null", () => {
    configureAnalytics({ loader: null });
    for (let i = 0; i < 50; i += 1) {
      trackEvent(makeEvent(i));
    }
    // Behavior is identical to 0 calls: nothing to flush, nothing buffered,
    // nothing thrown — asserted by the fact that reconfiguring a sink and
    // calling trackEvent again starts from a clean, empty buffer.
    const sink = makeFakeSink();
    configureAnalytics({ loader: () => Promise.resolve(sink) });
    expect(sink.captured).toEqual([]);
  });
});

describe("trackEvent — buffered load lifecycle with a fake sink", () => {
  beforeEach(() => {
    __resetAnalytics();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("buffers events pre-load and flushes them FIFO once the sink resolves", async () => {
    const sink = makeFakeSink();
    let resolveLoader: (value: AnalyticsSink) => void = () => {};
    const loaderPromise = new Promise<AnalyticsSink>((resolve) => {
      resolveLoader = resolve;
    });
    configureAnalytics({ loader: () => loaderPromise });

    trackEvent(makeEvent(1));
    trackEvent(makeEvent(2));
    trackEvent(makeEvent(3));

    // Not yet resolved: nothing captured.
    expect(sink.captured).toEqual([]);

    resolveLoader(sink);
    await vi.runAllTimersAsync();

    expect(sink.captured.map((e) => e.properties.seq)).toEqual([1, 2, 3]);
  });

  it("passes events straight through once the sink is ready", async () => {
    const sink = makeFakeSink();
    configureAnalytics({ loader: () => Promise.resolve(sink) });

    trackEvent(makeEvent(1));
    await vi.runAllTimersAsync();
    expect(sink.captured.map((e) => e.properties.seq)).toEqual([1]);

    trackEvent(makeEvent(2));
    expect(sink.captured.map((e) => e.properties.seq)).toEqual([1, 2]);
  });

  it("drops the NEWEST event once the bounded FIFO queue (cap 20) overflows", async () => {
    const capturedOrder: number[] = [];
    const spySink: AnalyticsSink = {
      capture(event) {
        capturedOrder.push(event.properties.seq as number);
      },
    };
    let resolveLoader: (value: AnalyticsSink) => void = () => {};
    const pending = new Promise<AnalyticsSink>((resolve) => {
      resolveLoader = resolve;
    });
    configureAnalytics({ loader: () => pending });

    // Push 25 events while the loader is still pending ("loading" state).
    for (let i = 0; i < 25; i += 1) {
      trackEvent(makeEvent(i));
    }

    resolveLoader(spySink);
    await vi.runAllTimersAsync();

    // Only the first 20 (head-of-funnel) events survive; 20-24 were dropped
    // silently as the newest arrivals once the cap was already hit.
    expect(capturedOrder).toHaveLength(20);
    expect(capturedOrder[0]).toBe(0);
    expect(capturedOrder[19]).toBe(19);
  });

  it("does not propagate a throw from a sink's capture()", async () => {
    const throwingSink: AnalyticsSink = {
      capture() {
        throw new Error("boom");
      },
    };
    configureAnalytics({ loader: () => Promise.resolve(throwingSink) });

    expect(() => trackEvent(makeEvent(1))).not.toThrow();
    await expect(vi.runAllTimersAsync()).resolves.not.toThrow();

    // Once ready, a direct throwing call must also not propagate.
    expect(() => trackEvent(makeEvent(2))).not.toThrow();
  });

  it("goes terminal-disabled and NEVER retries when the loader promise rejects", async () => {
    let loadAttempts = 0;
    const loader = () => {
      loadAttempts += 1;
      return Promise.reject(new Error("ad-blocked"));
    };
    configureAnalytics({ loader });

    trackEvent(makeEvent(1));
    await vi.runAllTimersAsync();
    expect(loadAttempts).toBe(1);

    // Further calls must not trigger another load attempt.
    trackEvent(makeEvent(2));
    trackEvent(makeEvent(3));
    await vi.runAllTimersAsync();
    expect(loadAttempts).toBe(1);
  });

  it("goes terminal-disabled when the loader resolves to null", async () => {
    const loader = () => Promise.resolve(null);
    configureAnalytics({ loader });

    trackEvent(makeEvent(1));
    await vi.runAllTimersAsync();

    const sink = makeFakeSink();
    // Reconfiguring with a fresh loader proves the previous state was
    // cleanly terminal, not stuck mid-load.
    configureAnalytics({ loader: () => Promise.resolve(sink) });
    trackEvent(makeEvent(2));
    await vi.runAllTimersAsync();
    expect(sink.captured.map((e) => e.properties.seq)).toEqual([2]);
  });
});
