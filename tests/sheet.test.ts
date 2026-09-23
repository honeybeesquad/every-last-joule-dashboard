// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SHEET_DRAG_PX, mountSheet, sheetDragIntent } from "../src/components/sheet.js";

describe("dragging the sheet's handle", () => {
  it("opens on a drag up and closes on a drag down, past the threshold", () => {
    expect(sheetDragIntent(-SHEET_DRAG_PX, false)).toBe("open");
    expect(sheetDragIntent(SHEET_DRAG_PX, true)).toBe("close");
  });
  it("ignores small moves, and moves toward where the sheet already is", () => {
    expect(sheetDragIntent(-(SHEET_DRAG_PX - 1), false)).toBeNull();
    expect(sheetDragIntent(-40, true)).toBeNull();
    expect(sheetDragIntent(40, false)).toBeNull();
  });
});

describe("the dark phone's bottom sheet (redesign plan 3.4)", () => {
  let active = true;
  let sheet: ReturnType<typeof mountSheet>;
  const dock = () => document.getElementById("dock")!;
  const handle = () => document.getElementById("sheet-handle") as HTMLButtonElement;

  beforeEach(() => {
    active = true;
    document.body.innerHTML = '<div id="dock"><button id="sheet-handle" aria-expanded="false">h</button><button id="play">p</button></div>';
    sheet = mountSheet({ dock: dock(), handle: handle(), isActive: () => active });
  });
  afterEach(() => { sheet.destroy(); document.body.innerHTML = ""; });

  it("is a named region while the sheet layout applies", () => {
    expect(dock().getAttribute("role")).toBe("region");
    expect(dock().getAttribute("aria-label")).toBe("Timeline and largest curtailments");
  });

  it("opens on a tap of the handle, and moves focus into it", () => {
    handle().click();
    expect(dock().classList.contains("is-open")).toBe(true);
    expect(handle().getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(dock());
  });

  it("closes on Escape and returns focus to the handle", () => {
    handle().click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(dock().classList.contains("is-open")).toBe(false);
    expect(document.activeElement).toBe(handle());
  });

  it("stays inert, and drops its region role, where the layout does not apply", () => {
    active = false;
    sheet.sync();
    expect(dock().hasAttribute("role")).toBe(false);
    handle().click();
    expect(dock().classList.contains("is-open")).toBe(false);
  });

  it("closes when the layout stops applying", () => {
    handle().click();
    active = false;
    sheet.sync();
    expect(sheet.isOpen()).toBe(false);
  });
});
