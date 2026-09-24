// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { THEME_BOOT_SCRIPT, THEME_STORAGE_KEY } from "../src/lib/theme-boot";
import config from "../observablehq.config";

// The boot script is the first thing every page runs. These run the exact
// string observablehq.config.ts inlines into <head>, against a fake
// prefers-color-scheme, so the dark default (a first visit is dark whatever
// the OS prefers), D2 (the old "sunfire"/"deepcurrent" values map to dark)
// and the paper figure's pin are all pinned to what ships.

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

  describe("first visit, nothing stored: dark by default", () => {
    it.each([true, false])("is dark when the OS prefers dark=%s", (prefersDark) => {
      fakeColorScheme(prefersDark);
      expect(boot()).toBe("dark");
    });

    it("is dark where matchMedia does not exist", () => {
      const original = window.matchMedia;
      Object.defineProperty(window, "matchMedia", { value: undefined, configurable: true, writable: true });
      try {
        expect(boot()).toBe("dark");
      } finally {
        Object.defineProperty(window, "matchMedia", { value: original, configurable: true, writable: true });
      }
    });

    it("does not follow later OS changes, and writes nothing to storage", () => {
      const os = fakeColorScheme(false);
      expect(boot()).toBe("dark");
      os.set(true);
      os.set(false);
      expect(os.listeners).toHaveLength(0);
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });
  });

  describe("a stored choice", () => {
    it.each(["light", "dark"])("%s wins over the default and the OS", (stored) => {
      fakeColorScheme(stored === "light");
      localStorage.setItem(THEME_STORAGE_KEY, stored);
      expect(boot()).toBe(stored);
    });

    it("light wins even when the OS prefers dark", () => {
      fakeColorScheme(true);
      localStorage.setItem(THEME_STORAGE_KEY, "light");
      expect(boot()).toBe("light");
    });

    it("that is not a mode falls back to dark", () => {
      fakeColorScheme(false);
      localStorage.setItem(THEME_STORAGE_KEY, "vellum");
      expect(boot()).toBe("dark");
    });

    it("that cannot be read (storage blocked) falls back to dark", () => {
      fakeColorScheme(false);
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("SecurityError"); });
      expect(boot()).toBe("dark");
    });
  });

  describe("values from the old theme picker (D2)", () => {
    it.each(["sunfire", "deepcurrent"])("%s maps to dark, even when the OS prefers light", (old) => {
      fakeColorScheme(false);
      localStorage.setItem(THEME_STORAGE_KEY, old);
      expect(boot()).toBe("dark");
    });

    it("is read, not rewritten", () => {
      fakeColorScheme(false);
      localStorage.setItem(THEME_STORAGE_KEY, "deepcurrent");
      boot();
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("deepcurrent");
    });
  });

  describe("the paper figure (/embed/globe)", () => {
    it("pins the embed palette whatever is stored or preferred", () => {
      window.history.replaceState({}, "", "/embed/globe");
      const os = fakeColorScheme(false);
      localStorage.setItem(THEME_STORAGE_KEY, "light");
      expect(boot()).toBe("embed");
      expect(os.listeners).toHaveLength(0);
    });

    it("only pins /embed/ paths", () => {
      window.history.replaceState({}, "", "/methodology");
      fakeColorScheme(false);
      expect(boot()).toBe("dark");
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
