import { describe, expect, it, vi } from "vitest";

import {
  WakeLockController,
  shouldHoldWakeLock,
  type WakeLockSentinelLike,
} from "./useWakeLock";

/** Stands in for a real sentinel, including the browser's own auto-release. */
function fakeSentinel() {
  const listeners: Array<() => void> = [];
  const sentinel: WakeLockSentinelLike = {
    released: false,
    release: vi.fn(async () => {
      sentinel.released = true;
    }),
    addEventListener: (_type, listener) => listeners.push(listener),
  };
  return {
    sentinel,
    /** Simulates the browser dropping the lock on its own (tab hidden). */
    autoRelease() {
      sentinel.released = true;
      listeners.forEach((l) => l());
    },
  };
}

describe("shouldHoldWakeLock", () => {
  const base = { focusActive: true, documentVisible: true, supported: true };

  it("mantiene la pantalla despierta en focus con la pestaña visible", () => {
    expect(shouldHoldWakeLock(base)).toBe(true);
  });

  it.each([
    ["fuera de focus", { focusActive: false }],
    ["con la pestaña oculta", { documentVisible: false }],
    ["sin soporte del navegador", { supported: false }],
  ])("no lo mantiene %s", (_label, patch) => {
    expect(shouldHoldWakeLock({ ...base, ...patch })).toBe(false);
  });
});

describe("WakeLockController", () => {
  it("pide el lock una sola vez aunque se sincronice de más", async () => {
    const { sentinel } = fakeSentinel();
    const request = vi.fn(async () => sentinel);
    const controller = new WakeLockController(request);

    await controller.sync(true);
    await controller.sync(true);
    await controller.sync(true);

    expect(request).toHaveBeenCalledTimes(1);
  });

  it("libera el lock al salir de focus", async () => {
    const { sentinel } = fakeSentinel();
    const controller = new WakeLockController(async () => sentinel);

    await controller.sync(true);
    await controller.sync(false);

    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it("no libera nada si nunca llegó a tomarlo", async () => {
    const { sentinel } = fakeSentinel();
    const controller = new WakeLockController(async () => sentinel);

    await controller.sync(false);

    expect(sentinel.release).not.toHaveBeenCalled();
  });

  /**
   * The whole reason this class exists. Browsers drop a screen wake lock the
   * moment the tab is hidden and never hand it back on their own, so a session
   * that survived a glance at another app would silently stop holding it.
   */
  it("vuelve a pedirlo después de que el navegador lo suelta solo", async () => {
    const first = fakeSentinel();
    const second = fakeSentinel();
    const request = vi
      .fn<() => Promise<WakeLockSentinelLike>>()
      .mockResolvedValueOnce(first.sentinel)
      .mockResolvedValueOnce(second.sentinel);
    const controller = new WakeLockController(request);

    await controller.sync(true);
    first.autoRelease();
    await controller.sync(true);

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("sobrevive a un rechazo y permite reintentar", async () => {
    const { sentinel } = fakeSentinel();
    const request = vi
      .fn<() => Promise<WakeLockSentinelLike>>()
      .mockRejectedValueOnce(new Error("NotAllowedError"))
      .mockResolvedValueOnce(sentinel);
    const controller = new WakeLockController(request);

    await expect(controller.sync(true)).resolves.toBeUndefined();
    await controller.sync(true);

    expect(request).toHaveBeenCalledTimes(2);
  });

  // Two effects firing in the same tick must not race into two locks, or the
  // second one leaks: only the handle we keep can ever be released.
  it("no toma dos locks si se sincroniza en paralelo", async () => {
    const { sentinel } = fakeSentinel();
    const request = vi.fn(async () => sentinel);
    const controller = new WakeLockController(request);

    await Promise.all([controller.sync(true), controller.sync(true)]);

    expect(request).toHaveBeenCalledTimes(1);
  });

  it("libera el lock aunque la baja llegue mientras lo estaba pidiendo", async () => {
    const { sentinel } = fakeSentinel();
    const controller = new WakeLockController(async () => sentinel);

    const acquiring = controller.sync(true);
    const releasing = controller.sync(false);
    await Promise.all([acquiring, releasing]);

    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });
});
