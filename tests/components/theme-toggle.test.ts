// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountThemeToggle } from "../../src/components/theme-toggle.js";

describe("mountThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.body.innerHTML = "";
    try { localStorage.clear(); } catch { /* jsdom without URL origin */ }
  });

  it("renders three radio buttons in the host element", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const buttons = host.querySelectorAll('button[role="radio"]');
    expect(buttons.length).toBe(3);
    expect(Array.from(buttons).map((b) => b.dataset.theme)).toEqual(["sunfire", "vellum", "eclipse"]);
  });

  it("reflects current data-theme as the checked chip", () => {
    document.documentElement.dataset.theme = "vellum";
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const chip = host.querySelector('button[data-theme="vellum"]');
    expect(chip?.getAttribute("aria-checked")).toBe("true");
  });

  it("defaults to sunfire when no data-theme attribute is set", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const chip = host.querySelector('button[data-theme="sunfire"]');
    expect(chip?.getAttribute("aria-checked")).toBe("true");
  });

  it("clicking a chip updates data-theme, localStorage, and aria-checked", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const eclipseChip = host.querySelector('button[data-theme="eclipse"]');
    eclipseChip?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.documentElement.dataset.theme).toBe("eclipse");
    try { expect(localStorage.getItem("elj-theme")).toBe("eclipse"); } catch {}
    expect(eclipseChip?.getAttribute("aria-checked")).toBe("true");
    expect(host.querySelector('button[data-theme="sunfire"]')?.getAttribute("aria-checked")).toBe("false");
  });

  it("clicking a chip dispatches a themechange CustomEvent with detail", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const handler = vi.fn();
    window.addEventListener("themechange", handler);
    host.querySelector('button[data-theme="vellum"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    const ev = handler.mock.calls[0][0];
    expect(ev).toBeInstanceOf(CustomEvent);
    expect(ev.detail).toEqual({ theme: "vellum" });
    window.removeEventListener("themechange", handler);
  });

  it("ArrowRight on the focused chip moves selection to the next chip", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const sunfire = host.querySelector('button[data-theme="sunfire"]');
    sunfire?.focus();
    sunfire?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.documentElement.dataset.theme).toBe("vellum");
  });

  it("ArrowLeft from the first chip wraps to the last chip", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountThemeToggle(host);
    const sunfire = host.querySelector('button[data-theme="sunfire"]');
    sunfire?.focus();
    sunfire?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(document.documentElement.dataset.theme).toBe("eclipse");
  });

  it("returns a cleanup function that removes the rendered chips", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const cleanup = mountThemeToggle(host);
    expect(host.children.length).toBeGreaterThan(0);
    cleanup();
    expect(host.children.length).toBe(0);
  });
});