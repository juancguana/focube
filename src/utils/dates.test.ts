import { describe, expect, it } from "vitest";
import { todayKey } from "./dates";

describe("todayKey", () => {
  it("formats an explicit date as YYYY-MM-DD", () => {
    expect(todayKey(new Date(2026, 6, 27))).toBe("2026-07-27");
  });

  it("pads single-digit month and day", () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("defaults to the current date when no argument is given", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(todayKey()).toBe(expected);
  });
});
