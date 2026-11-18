// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountSiteChrome } from "../src/components/site-chrome.js";
import { siteHeaderHTML } from "../src/lib/site-header";

const DATASET = { version: "1.4.0", recordUrl: "https://doi.org/10.5281/zenodo.22837934" };
let cleanup: () => void;

function stubMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => {
  document.documentElement.setAttribute("data-theme", "light");
  document.body.innerHTML = siteHeaderHTML({ path: "/about", dataset: DATASET, markSvg: "<svg></svg>" }) + '<main><a href="#x" id="outside">x</a></main>';
});
afterEach(() => {
  cleanup?.();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("the header's mode switch", () => {
  it("mounts the pill on wide screens", () => {
    stubMedia(false);
    cleanup = mountSiteChrome();
    expect(document.querySelector('#theme-toggle-mount [role="radiogroup"]')).not.toBeNull();
  });
  it("mounts the one-button form on phones", () => {
    stubMedia(true);
    cleanup = mountSiteChrome();
    expect(document.querySelector("#theme-toggle-mount .theme-toggle--compact")).not.toBeNull();
  });
});

describe("the menu (below 960px)", () => {
  beforeEach(() => { stubMedia(true); cleanup = mountSiteChrome(); });
  const header = () => document.querySelector(".app-header")!;
  const button = () => document.querySelector<HTMLButtonElement>(".app-menu-btn")!;

  it("opens on the button and moves focus to the first link", () => {
    button().click();
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(header().classList.contains("is-menu-open")).toBe(true);
    expect(document.activeElement?.textContent).toBe("Regions");
  });

  it("closes on a second press", () => {
    button().click();
    button().click();
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on Escape and returns focus to the button", () => {
    button().click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(header().classList.contains("is-menu-open")).toBe(false);
    expect(document.activeElement).toBe(button());
  });

  it("closes on a press outside the header", () => {
    button().click();
    document.getElementById("outside")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when focus leaves the header", () => {
    button().click();
    header().dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.getElementById("outside") }));
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });
});
