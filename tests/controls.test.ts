// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountControls, SPEEDS } from "../src/components/controls.js";
import { createClock } from "../src/components/clock.js";

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function setUp() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const clock = createClock(6);
  const onNow = vi.fn();
  mountControls(host, clock, { onNow });
  return { host, clock, onNow };
}

const pressed = (el: Element | null) => el?.getAttribute("aria-pressed");

describe("playback speeds (0.5× restored as the default 2026-09-24)", () => {
  it("offers 0.5x, 1x, 4x and 8x plus Now", () => {
    expect(SPEEDS).toEqual([0.5, 1, 4, 8]);
    const { host } = setUp();
    const chips = [...host.querySelectorAll(".ctl-speed-chip")].map((b) => b.textContent!.trim());
    expect(chips).toEqual(["0.5×", "1×", "4×", "8×"]);
    expect(host.querySelector(".ctl-now")!.textContent!.trim()).toBe("Now");
  });

  it("defaults to 0.5x", () => {
    const { host, clock } = setUp();
    expect(clock.speed).toBe(0.5);
    expect(pressed(host.querySelector(".ctl-speed-chip[data-speed='0.5']"))).toBe("true");
    expect(pressed(host.querySelector(".ctl-speed-chip[data-speed='1']"))).toBe("false");
    expect(pressed(host.querySelector(".ctl-speed-chip[data-speed='4']"))).toBe("false");
  });

  it("sets the clock's speed and moves aria-pressed", () => {
    const { host, clock } = setUp();
    (host.querySelector(".ctl-speed-chip[data-speed='8']") as HTMLButtonElement).click();
    expect(clock.speed).toBe(8);
    expect(pressed(host.querySelector(".ctl-speed-chip[data-speed='8']"))).toBe("true");
    expect(pressed(host.querySelector(".ctl-speed-chip[data-speed='0.5']"))).toBe("false");
  });

  it("Now follows the wall clock, releases the speeds, and tells the page (follow-the-sun back on)", () => {
    const { host, clock, onNow } = setUp();
    (host.querySelector(".ctl-now") as HTMLButtonElement).click();
    expect(clock.realTime).toBe(true);
    expect(onNow).toHaveBeenCalledTimes(1);
    expect(pressed(host.querySelector(".ctl-now"))).toBe("true");
    for (const chip of host.querySelectorAll(".ctl-speed-chip")) expect(pressed(chip)).toBe("false");
    // Picking a speed leaves real time again.
    (host.querySelector(".ctl-speed-chip[data-speed='4']") as HTMLButtonElement).click();
    expect(clock.realTime).toBe(false);
    expect(pressed(host.querySelector(".ctl-now"))).toBe("false");
  });

  it("play is a toggle button named Play, pressed while playing", () => {
    const { host, clock } = setUp();
    const play = host.querySelector(".ctl-play") as HTMLButtonElement;
    expect(play.getAttribute("aria-label")).toBe("Play");
    expect(pressed(play)).toBe(String(clock.playing));
    play.click();
    expect(pressed(play)).toBe(String(clock.playing));
    expect(play.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });
});
