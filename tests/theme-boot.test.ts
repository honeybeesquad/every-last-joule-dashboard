// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { THEME_BOOT_SCRIPT, THEME_STORAGE_KEY } from "../src/lib/theme-boot";
import config from "../observablehq.config";

// The boot script is the first thing every page runs. These run the exact
// string observablehq.config.ts inlines into <head>, against a fake
// prefers-color-scheme, so D1 (first visit follows the OS), D2 (the old
// "sunfire"/"deepcurrent" values map to dark) and the paper figure's pin are
// all pinned to what ships.

type Listener = (e: { matches: boolean }) => void;

function fakeColorScheme(prefersDark: boolean) {
  const listeners: Listener[] = [];
  const mql = {
    matches: prefersDark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener() {},
  };
  vi.spyOn(window, "matchMedia").mockImplementation(() => mql as unknown as MediaQueryList);
  return {
    /** Flip the OS setting, as the system would. */
    set(dark: boolean) {
      mql.matches = dark;
      for (const fn of listeners) fn({ matches: dark });
    },
    listeners,
  };
}

function boot() {
  new Function(THEME_BOOT_SCRIPT)();
  return document.documentElement.getAttribute("data-theme");
}

describe("theme boot script", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe("first visit, nothing stored (D1)", () => {
    it("follows an OS preference for dark", () => {
      fakeColorScheme(true);
      expect(boot()).toBe("dark");
    });

    it("follows an OS preference for light", () => {
      fakeColorScheme(false);
      expect(boot()).toBe("light");
    });

    it("is light where matchMedia does not exist", () => {
      const original = window.matchMedia;
      Object.defineProperty(window, "matchMedia", { value: undefined, configurable: true, writable: true });
      try {
        expect(boot()).toBe("light");
      } finally {
        Object.defineProperty(window, "matchMedia", { value: original, configurable: true, writable: true });
      }
    });

    it("keeps following live OS changes, without writing to storage", () => {
      const os = fakeColorScheme(false);
      expect(boot()).toBe("light");
      const events: string[] = [];
      const listener = (e: Event) => events.push((e as CustomEvent).detail.theme);
      window.addEventListener("themechange", listener);
      os.set(true);
      window.removeEventListener("themechange", listener);
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(events).toEqual(["dark"]);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });

    it("stops following once the visitor picks a mode", () => {
      const os = fakeColorScheme(false);
      boot();
      localStorage.setItem(THEME_STORAGE_KEY, "light"); // what the toggle writes
      os.set(true);
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });

  describe("a stored choice", () => {
    it.each(["light", "dark"])("%s wins over the OS", (stored) => {
      fakeColorScheme(stored === "light");
      localStorage.setItem(THEME_STORAGE_KEY, stored);
      expect(boot()).toBe(stored);
    });

    it("is not overridden by a later OS change", () => {
      const os = fakeColorScheme(true);
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      boot();
      os.set(false);
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("that is not a mode falls back to the OS", () => {
      fakeColorScheme(true);
      localStorage.setItem(THEME_STORAGE_KEY, "vellum");
      expect(boot()).toBe("dark");
    });

    it("that cannot be read (storage blocked) falls back to the OS", () => {
      fakeColorScheme(false);
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("SecurityError"); });
      expect(boot()).toBe("light");
    });
  });

  describe("values from the old theme picker (D2)", () => {
    it.each(["sunfire", "deepcurrent"])("%s maps to dark, even when the OS prefers light", (old) => {
      fakeColorScheme(false);
      localStorage.setItem(THEME_STORAGE_KEY, old);
      expect(boot()).toBe("dark");
    });

    it("counts as a choice, so the OS does not take over", () => {
      const os = fakeColorScheme(true);
      localStorage.setItem(THEME_STORAGE_KEY, "sunfire");
      boot();
      os.set(false);
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });

    it("is read, not rewritten", () => {
      fakeColorScheme(false);
      localStorage.setItem(THEME_STORAGE_KEY, "deepcurrent");
      boot();
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("deepcurrent");
    });
  });

  describe("the paper figure (/embed/globe)", () => {
    it("keeps Sunfire whatever is stored or preferred", () => {
      window.history.replaceState({}, "", "/embed/globe");
      const os = fakeColorScheme(false);
      localStorage.setItem(THEME_STORAGE_KEY, "light");
      expect(boot()).toBe("sunfire");
      // ...and does not follow the OS afterwards.
      expect(os.listeners).toHaveLength(0);
    });

    it("only pins /embed/ paths", () => {
      window.history.replaceState({}, "", "/methodology");
      fakeColorScheme(false);
      expect(boot()).toBe("light");
    });
  });
});

describe("where the boot script runs", () => {
  it("is inlined in <head> before the stylesheet, so no page paints the wrong mode first", () => {
    const head: string = config.head;
    const script = head.indexOf(`<script>${THEME_BOOT_SCRIPT}</script>`);
    const stylesheet = head.indexOf('<link rel="stylesheet" href="./style.css">');
    expect(script).toBeGreaterThan(-1);
    expect(stylesheet).toBeGreaterThan(script);
  });

  it("parses as a script (ES5, no module syntax)", () => {
    expect(() => new Function(THEME_BOOT_SCRIPT)).not.toThrow();
    expect(THEME_BOOT_SCRIPT).not.toMatch(/=>|\blet\b|\bconst\b|`/);
  });
});
