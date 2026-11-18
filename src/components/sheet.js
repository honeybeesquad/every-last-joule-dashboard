/**
 * The dark phone's bottom sheet (redesign plan 3.4). On a phone in dark the
 * dock (#dock: the timeline and the rail) is a sheet fixed to the bottom of
 * the screen: 132px collapsed (two stats and the region that leads), 70% of
 * the viewport expanded (the ribbon, the controls and the top ten).
 *
 * Tapping the handle, or dragging it up, expands the sheet; tapping again,
 * dragging down or Escape collapses it. It is a dialog-like region: focus
 * moves into it when it expands, and back to the handle when Escape closes
 * it. Everywhere else CSS lays the dock out and this stays inert:
 * `isActive()` says when the sheet layout applies.
 *
 * Returns { setOpen, isOpen, sync, destroy }.
 */
export const SHEET_DRAG_PX = 24;

/** Which way a vertical drag of `dy` px moves the sheet: "open", "close" or null. */
export function sheetDragIntent(dy, open) {
  if (!open && dy <= -SHEET_DRAG_PX) return "open";
  if (open && dy >= SHEET_DRAG_PX) return "close";
  return null;
}

export function mountSheet({ dock, handle, isActive }) {
  let open = false;
  let drag = null;

  function setOpen(next, { focus = false } = {}) {
    open = Boolean(next) && isActive();
    dock.classList.toggle("is-open", open);
    handle.setAttribute("aria-expanded", String(open));
    if (open && focus) dock.focus({ preventScroll: true });
  }

  // The region role and name belong to the sheet layout only; elsewhere the
  // dock is `display: contents` and its sections carry their own labels.
  function sync() {
    if (isActive()) {
      dock.setAttribute("role", "region");
      dock.setAttribute("aria-label", "Timeline and largest curtailments");
      dock.tabIndex = -1;
    } else {
      dock.removeAttribute("role");
      dock.removeAttribute("aria-label");
      dock.removeAttribute("tabindex");
      if (open) setOpen(false);
    }
  }

  function onPointerDown(event) {
    if (!isActive()) return;
    drag = { y: event.clientY, id: event.pointerId, moved: false };
    try { handle.setPointerCapture(event.pointerId); } catch {}
  }
  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const intent = sheetDragIntent(event.clientY - drag.y, open);
    if (!intent) return;
    drag.moved = true;
    setOpen(intent === "open");
    drag.y = event.clientY;
  }
  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.id) return;
    // A drag that moved the sheet is not also a tap.
    if (drag.moved) handle.dataset.dragged = "1";
    drag = null;
  }
  function onClick() {
    if (handle.dataset.dragged) { delete handle.dataset.dragged; return; }
    setOpen(!open, { focus: true });
  }
  function onKey(event) {
    if (event.key !== "Escape" || !open) return;
    setOpen(false);
    handle.focus();
  }

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", onPointerUp);
  handle.addEventListener("pointercancel", onPointerUp);
  handle.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  sync();

  return {
    setOpen,
    isOpen: () => open,
    sync,
    destroy() {
      handle.removeEventListener("pointerdown", onPointerDown);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("pointercancel", onPointerUp);
      handle.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    },
  };
}
