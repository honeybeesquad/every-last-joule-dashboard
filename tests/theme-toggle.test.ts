// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountThemeToggle, VALID_THEMES } from "../src/components/theme-toggle.js";

function setUp(theme = "light") {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.clear();
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host;
}

function recordThemeChanges() {
  const events: string[] = [];
  const listener = (e: Event) => events.push((e as CustomEvent).detail.theme);
  window.addEventListener("themechange", listener);
  return { events, stop: () => window.removeEventListener("themechange", listener) };
}

describe("mountThemeToggle (desktop pill)", () => {
  let host: HTMLElement;
  let cleanup: () => void;

  beforeEach(() => { host = setUp(); });
  afterEach(() => {
    cleanup?.();
    document.body.innerHTML = "";
    localStorage.clear();
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  });

  it("offers exactly the two modes", () => {
    expect(VALID_THEMES).toEqual(["light", "dark"]);
  });

  it("renders a radiogroup of two icon buttons with accessible names", () => {
    cleanup = mountThemeToggle(host);
    const group = host.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute("aria-label")).toBe("Colour mode");
    const buttons = [...host.querySelectorAll("button[data-theme]")];
    expect(buttons.map((b) => b.getAttribute("data-theme"))).toEqual(["light", "dark"]);
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Light mode", "Dark mode"]);
    for (const b of buttons) {
      expect(b.getAttribute("role")).toBe("radio");
      // Icon only, hidden from the accessibility tree: the name is the label.
      expect(b.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
      expect(b.textContent).toBe("");
    }
  });

  it("marks the current mode checked, with a roving tabindex", () => {
    cleanup = mountThemeToggle(host);
    const light = host.querySelector('button[data-theme="light"]') as HTMLButtonElement;
    const dark = host.querySelector('button[data-theme="dark"]') as HTMLButtonElement;
    expect(light.getAttribute("aria-checked")).toBe("true");
    expect(dark.getAttribute("aria-checked")).toBe("false");
    expect(light.tabIndex).toBe(0);
    expect(dark.tabIndex).toBe(-1);
  });

  it("reads the current mode from documentElement on mount", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    cleanup = mountThemeToggle(host);
    expect(host.querySelector('button[data-theme="dark"]')!.getAttribute("aria-checked")).toBe("true");
  });

  it("clicking a mode updates documentElement, localStorage and aria, and fires themechange once", () => {
    cleanup = mountThemeToggle(host);
    const rec = recordThemeChanges();
    const dark = host.querySelector('button[data-theme="dark"]') as HTMLButtonElement;
    dark.click();
    rec.stop();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("elj-theme")).toBe("dark");
    expect(dark.getAttribute("aria-checked")).toBe("true");
    expect(host.querySelector('button[data-theme="light"]')!.getAttribute("aria-checked")).toBe("false");
    expect(rec.events).toEqual(["dark"]);
  });

  it("clicking the active mode is a no-op: no storage write, no event", () => {
    cleanup = mountThemeToggle(host);
    const rec = recordThemeChanges();
    (host.querySelector('button[data-theme="light"]') as HTMLButtonElement).click();
    rec.stop();
    expect(rec.events).toEqual([]);
    expect(localStorage.getItem("elj-theme")).toBeNull();
  });

  it("ArrowRight moves to the next mode, activates it and moves focus", () => {
    cleanup = mountThemeToggle(host);
    const light = host.querySelector('button[data-theme="light"]') as HTMLButtonElement;
    light.focus();
    light.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.activeElement).toBe(host.querySelector('button[data-theme="dark"]'));
  });

  it("ArrowLeft from light wraps around to dark", () => {
    cleanup = mountThemeToggle(host);
    const light = host.querySelector('button[data-theme="light"]') as HTMLButtonElement;
    light.focus();
    light.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("Space on the focused, already-active mode changes nothing and keeps focus", () => {
    cleanup = mountThemeToggle(host);
    const rec = recordThemeChanges();
    const light = host.querySelector('button[data-theme="light"]') as HTMLButtonElement;
    light.focus();
    light.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    rec.stop();
    expect(rec.events).toEqual([]);
    expect(document.activeElement).toBe(light);
  });

  it("follows a mode change made elsewhere (the boot script following the OS)", () => {
    cleanup = mountThemeToggle(host);
    document.documentElement.setAttribute("data-theme", "dark");
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: "dark" } }));
    expect(host.querySelector('button[data-theme="dark"]')!.getAttribute("aria-checked")).toBe("true");
    expect(localStorage.getItem("elj-theme")).toBeNull(); // following is not choosing
  });

  it("cross-fades through document.startViewTransition when it exists", () => {
    const startViewTransition = vi.fn((update: () => void) => { update(); return {}; });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = startViewTransition;
    cleanup = mountThemeToggle(host);
    const rec = recordThemeChanges();
    (host.querySelector('button[data-theme="dark"]') as HTMLButtonElement).click();
    rec.stop();
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(rec.events).toEqual(["dark"]);
  });

  it("switches instantly under prefers-reduced-motion, even with view transitions", () => {
    const startViewTransition = vi.fn((update: () => void) => { update(); return {}; });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = startViewTransition;
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({
      matches: q.includes("prefers-reduced-motion"),
      media: q, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
    }) as MediaQueryList);
    cleanup = mountThemeToggle(host);
    (host.querySelector('button[data-theme="dark"]') as HTMLButtonElement).click();
    matchMedia.mockRestore();
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("announces once even if a deferred switch runs twice", () => {
    // A second click while the first transition is pending queues a second
    // update for the same mode; only the first may write and announce.
    const pending: Array<() => void> = [];
    (document as unknown as { startViewTransition: unknown }).startViewTransition = (update: () => void) => {
      pending.push(update);
      return {};
    };
    cleanup = mountThemeToggle(host);
    const rec = recordThemeChanges();
    const dark = host.querySelector('button[data-theme="dark"]') as HTMLButtonElement;
    dark.click();
    dark.click();
    pending.forEach((update) => update());
    rec.stop();
    expect(rec.events).toEqual(["dark"]);
  });

  it("returns a cleanup function that removes the DOM and stops listening", () => {
    cleanup = mountThemeToggle(host);
    expect(host.querySelector(".theme-toggle")).not.toBeNull();
    cleanup();
    expect(host.querySelector(".theme-toggle")).toBeNull();
  });
});

describe("mountThemeToggle({ compact: true }) (phones)", () => {
  let host: HTMLElement;
  let cleanup: () => void;

  beforeEach(() => { host = setUp(); });
  afterEach(() => {
    cleanup?.();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("is one button offering the other mode", () => {
    cleanup = mountThemeToggle(host, { compact: true });
    const buttons = host.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    const btn = buttons[0];
    expect(btn.classList.contains("theme-toggle--compact")).toBe(true);
    expect(btn.getAttribute("aria-label")).toBe("Switch to dark mode");
    // The moon, because dark is where it goes.
    expect(btn.querySelector("svg path")).not.toBeNull();
    expect(btn.querySelector("svg circle")).toBeNull();
  });

  it("switches, stores the choice, fires themechange once and relabels itself", () => {
    cleanup = mountThemeToggle(host, { compact: true });
    const rec = recordThemeChanges();
    const btn = host.querySelector("button") as HTMLButtonElement;
    btn.click();
    rec.stop();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("elj-theme")).toBe("dark");
    expect(rec.events).toEqual(["dark"]);
    // Same element, so keyboard focus stays put; it now offers light (the sun).
    expect(btn.getAttribute("aria-label")).toBe("Switch to light mode");
    expect(btn.querySelector("svg circle")).not.toBeNull();
  });

  it("starts from dark when the page is dark", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    cleanup = mountThemeToggle(host, { compact: true });
    expect(host.querySelector("button")!.getAttribute("aria-label")).toBe("Switch to light mode");
  });
});
