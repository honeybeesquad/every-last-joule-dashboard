// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountThemeToggle } from "../src/components/theme-toggle.js";

function setUp() {
  document.documentElement.setAttribute("data-theme", "sunfire");
  localStorage.clear();
  const host = document.createElement("div");
  document.body.appendChild(host);
  return host;
}

describe("mountThemeToggle", () => {
  let host: HTMLElement;
  let cleanup: () => void;

  beforeEach(() => { host = setUp(); });
  afterEach(() => {
    cleanup?.();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("renders two chips with sunfire active", () => {
    cleanup = mountThemeToggle(host);
    const buttons = host.querySelectorAll("button[data-theme]");
    expect(buttons.length).toBe(2);
    expect(buttons[0].getAttribute("data-theme")).toBe("sunfire");
    expect(buttons[0].getAttribute("aria-checked")).toBe("true");
    expect(buttons[1].getAttribute("aria-checked")).toBe("false");
  });

  it("reads the current theme from documentElement on mount", () => {
    document.documentElement.setAttribute("data-theme", "deepcurrent");
    cleanup = mountThemeToggle(host);
    const deepcurrentBtn = host.querySelector('button[data-theme="deepcurrent"]')!;
    expect(deepcurrentBtn.getAttribute("aria-checked")).toBe("true");
  });

  it("clicking a chip updates documentElement, localStorage, aria, and dispatches themechange", () => {
    cleanup = mountThemeToggle(host);
    const events: string[] = [];
    window.addEventListener("themechange", (e) => {
      events.push((e as CustomEvent).detail.theme);
    });

    const deepcurrentBtn = host.querySelector('button[data-theme="deepcurrent"]') as HTMLButtonElement;
    deepcurrentBtn.click();

    expect(document.documentElement.getAttribute("data-theme")).toBe("deepcurrent");
    expect(localStorage.getItem("elj-theme")).toBe("deepcurrent");
    expect(deepcurrentBtn.getAttribute("aria-checked")).toBe("true");
    expect(host.querySelector('button[data-theme="sunfire"]')!.getAttribute("aria-checked")).toBe("false");
    expect(events).toEqual(["deepcurrent"]);
  });

  it("clicking the already-active chip is a no-op (no extra events)", () => {
    cleanup = mountThemeToggle(host);
    const events: string[] = [];
    window.addEventListener("themechange", (e) => events.push((e as CustomEvent).detail.theme));
    const sunfireBtn = host.querySelector('button[data-theme="sunfire"]') as HTMLButtonElement;
    sunfireBtn.click();
    expect(events).toEqual([]);
  });

  it("ArrowRight cycles to next chip and activates it", () => {
    cleanup = mountThemeToggle(host);
    const sunfireBtn = host.querySelector('button[data-theme="sunfire"]') as HTMLButtonElement;
    sunfireBtn.focus();
    sunfireBtn.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("deepcurrent");
  });

  it("ArrowLeft from sunfire wraps around to deepcurrent", () => {
    cleanup = mountThemeToggle(host);
    const sunfireBtn = host.querySelector('button[data-theme="sunfire"]') as HTMLButtonElement;
    sunfireBtn.focus();
    sunfireBtn.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("deepcurrent");
  });

  it("returns a cleanup function that removes the rendered DOM", () => {
    cleanup = mountThemeToggle(host);
    expect(host.querySelector(".theme-toggle")).not.toBeNull();
    cleanup();
    expect(host.querySelector(".theme-toggle")).toBeNull();
  });
});
