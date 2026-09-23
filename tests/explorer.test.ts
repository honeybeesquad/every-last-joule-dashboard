// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { explorerTime, mountExplorer } from "../src/components/explorer.js";

describe("the explorer's clock label", () => {
  it("reads HH:MM UTC and wraps at 24", () => {
    expect(explorerTime(6 + 56 / 60)).toBe("06:56 UTC");
    expect(explorerTime(24.5)).toBe("00:30 UTC");
  });
});

describe("the globe explorer (redesign plan 6.4)", () => {
  let explorer: ReturnType<typeof mountExplorer>;
  const globe = { setExplorer: vi.fn() };
  const listeners: ((h: number) => void)[] = [];
  const clock = {
    hour: 6.5, playing: false,
    play() { this.playing = true; }, pause() { this.playing = false; },
    scrub(h: number) { this.hour = h; listeners.forEach((fn) => fn(h)); },
    subscribe(fn: (h: number) => void) { listeners.push(fn); fn(this.hour); },
  };
  const $ = (id: string) => document.getElementById(id)!;

  beforeEach(() => {
    globe.setExplorer.mockClear();
    history.replaceState(null, "");
    document.body.innerHTML =
      '<section class="globe-stage" aria-label="Globe"><canvas></canvas>' +
      '<button id="trigger">Explore the globe</button><button id="close">x</button><div id="bar"></div></section>';
    explorer = mountExplorer({ stage: document.querySelector(".globe-stage")!, trigger: $("trigger"), close: $("close"), bar: $("bar"), globe, clock });
  });
  afterEach(() => { document.body.innerHTML = ""; document.documentElement.className = ""; });

  it("opens as a modal dialog, locks the page and focuses the close button", () => {
    $("trigger").click();
    const stage = document.querySelector(".globe-stage")!;
    expect(stage.classList.contains("is-exploring")).toBe(true);
    expect(stage.getAttribute("role")).toBe("dialog");
    expect(stage.getAttribute("aria-modal")).toBe("true");
    expect(document.documentElement.classList.contains("is-exploring")).toBe(true);
    expect(globe.setExplorer).toHaveBeenLastCalledWith(true);
    expect(document.activeElement).toBe($("close"));
  });

  it("pushes a history entry, so back can close it", () => {
    $("trigger").click();
    expect(history.state).toEqual({ eljExplorer: true });
  });

  it("closes on Escape, restores the stage and returns focus to the trigger", () => {
    $("trigger").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    const stage = document.querySelector(".globe-stage")!;
    expect(explorer.isOpen()).toBe(false);
    expect(stage.hasAttribute("role")).toBe(false);
    expect(stage.getAttribute("aria-label")).toBe("Globe");
    expect(document.documentElement.classList.contains("is-exploring")).toBe(false);
    expect(globe.setExplorer).toHaveBeenLastCalledWith(false);
    expect(document.activeElement).toBe($("trigger"));
  });

  it("closes when history pops its entry (Android back)", () => {
    $("trigger").click();
    history.replaceState(null, "");
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    expect(explorer.isOpen()).toBe(false);
  });

  it("has a play button and a scrubber bound to the clock", () => {
    $("trigger").click();
    const range = document.querySelector<HTMLInputElement>(".explorer-range")!;
    range.value = "12";
    range.dispatchEvent(new Event("input"));
    expect(clock.hour).toBe(12);
    expect(document.querySelector(".explorer-time")?.textContent).toBe("12:00 UTC");
    const play = document.querySelector<HTMLButtonElement>(".explorer-play")!;
    play.click();
    expect(clock.playing).toBe(true);
    expect(play.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps Tab inside while open", () => {
    $("trigger").click();
    // jsdom has no layout, so every control counts as visible here.
    Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get() { return document.body; } });
    const els = [...document.querySelectorAll<HTMLElement>(".globe-stage button, .globe-stage input")];
    els[els.length - 1].focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(els[0]);
    delete (HTMLElement.prototype as unknown as { offsetParent?: unknown }).offsetParent;
  });
});
