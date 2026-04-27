// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createClock } from "../src/components/clock.js";

// The clock module spawns a requestAnimationFrame loop on construction.
// jsdom polyfills RAF as a setTimeout(0) in some versions and not at all
// in others; we stub it out so the integration loop never fires during
// unit tests and `tick`-driven assertions only run when we explicitly
// drive them. Each test that needs to advance the clock manually does so
// by reading the clock's exported helpers — we never assert against the
// internal RAF schedule.
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createClock - real-time mode", () => {
  it("starts with realTime disabled by default", () => {
    const clock = createClock(12);
    expect(clock.realTime).toBe(false);
  });

  it("enableRealTime() snaps clock.hour to the current UTC hour", () => {
    const clock = createClock(0);
    // Pin a deterministic moment: 2026-04-27 14:30:30 UTC ≈ 14.508333 hours.
    const fixed = Date.UTC(2026, 3, 27, 14, 30, 30);
    vi.setSystemTime(new Date(fixed));
    clock.enableRealTime();
    expect(clock.realTime).toBe(true);
    expect(clock.hour).toBeCloseTo(14 + 30 / 60 + 30 / 3600, 5);
    vi.useRealTimers();
  });

  it("setSpeed() exits real-time mode", () => {
    const clock = createClock(0);
    clock.enableRealTime();
    expect(clock.realTime).toBe(true);
    clock.setSpeed(2);
    expect(clock.realTime).toBe(false);
    expect(clock.speed).toBe(2);
  });

  it("scrub() exits real-time mode", () => {
    const clock = createClock(0);
    clock.enableRealTime();
    expect(clock.realTime).toBe(true);
    clock.scrub(8);
    expect(clock.realTime).toBe(false);
    expect(clock.hour).toBe(8);
  });

  it("calling enableRealTime() resumes playing if previously paused", () => {
    const clock = createClock(0);
    clock.pause();
    expect(clock.playing).toBe(false);
    clock.enableRealTime();
    expect(clock.playing).toBe(true);
    expect(clock.realTime).toBe(true);
  });

  it("subscribers receive the snapped hour on enableRealTime()", () => {
    const clock = createClock(0);
    const fixed = Date.UTC(2026, 3, 27, 9, 0, 0);
    vi.setSystemTime(new Date(fixed));
    let received: number | null = null;
    // subscribe fires immediately with current hour, so reset before enabling
    const unsubscribe = clock.subscribe((h) => { received = h; });
    received = null;
    clock.enableRealTime();
    expect(received).toBeCloseTo(9, 5);
    unsubscribe();
    vi.useRealTimers();
  });
});
