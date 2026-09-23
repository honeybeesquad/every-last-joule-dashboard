/**
 * The site header's behaviour, on the dashboard and every doc page (the
 * markup is src/lib/site-header.ts's):
 *
 *   - Mounts the mode switch into #theme-toggle-mount: the sun/moon pill, or
 *     on phones (≤640px) one 44px button showing the mode it switches to.
 *     Re-mounted when the width crosses 640px, so a rotated tablet swaps too.
 *   - Runs the menu below 960px, where the nav and the DOI pill move into it:
 *     the button toggles aria-expanded; Escape, a click outside, or focus
 *     leaving the menu closes it; Escape returns focus to the button.
 *
 * Returns a cleanup function.
 */
import { mountThemeToggle } from "./theme-toggle.js";

export const PHONE_QUERY = "(max-width: 640px)";
export const MENU_QUERY = "(max-width: 960px)";

export function mountSiteChrome(root = document) {
  const header = root.querySelector(".app-header");
  if (!header) return () => {};
  const cleanups = [];

  const host = header.querySelector("#theme-toggle-mount");
  if (host) {
    const phone = window.matchMedia(PHONE_QUERY);
    let unmount = mountThemeToggle(host, { compact: phone.matches });
    const remount = (event) => {
      unmount();
      unmount = mountThemeToggle(host, { compact: event.matches });
    };
    phone.addEventListener("change", remount);
    cleanups.push(() => { phone.removeEventListener("change", remount); unmount(); });
  }

  const button = header.querySelector(".app-menu-btn");
  const nav = header.querySelector(".app-nav");
  if (button && nav) {
    const isOpen = () => header.classList.contains("is-menu-open");
    const setOpen = (open) => {
      header.classList.toggle("is-menu-open", open);
      button.setAttribute("aria-expanded", String(open));
    };
    const onClick = () => {
      const open = !isOpen();
      setOpen(open);
      if (open) nav.querySelector("a")?.focus();
    };
    const onKey = (event) => {
      if (event.key !== "Escape" || !isOpen()) return;
      setOpen(false);
      button.focus();
    };
    const onPointer = (event) => {
      if (isOpen() && !header.contains(event.target)) setOpen(false);
    };
    const onFocusOut = (event) => {
      if (isOpen() && event.relatedTarget && !header.contains(event.relatedTarget)) setOpen(false);
    };
    // Widening past the menu layout shows the nav in the header again.
    const menuQuery = window.matchMedia(MENU_QUERY);
    const onLayout = (event) => { if (!event.matches) setOpen(false); };
    button.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    header.addEventListener("focusout", onFocusOut);
    menuQuery.addEventListener("change", onLayout);
    cleanups.push(() => {
      button.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      header.removeEventListener("focusout", onFocusOut);
      menuQuery.removeEventListener("change", onLayout);
    });
  }

  return () => cleanups.forEach((fn) => fn());
}
