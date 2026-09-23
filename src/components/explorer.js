/**
 * The globe explorer (redesign plan 6.4; phones, both modes). On a phone the
 * globe is a static picture so that a vertical swipe scrolls the page.
 * "Explore the globe" opens it full screen, where it takes touch: drag to
 * rotate, tap to select, pinch to zoom (light). A 44px close button sits at
 * the top right; a play button and a compact scrubber run along the bottom;
 * the selected region shows in a card above them, not beside its mark.
 *
 * Opening pushes a history entry, so Android's back gesture and Escape both
 * close it. Focus moves to the close button, stays inside while it is open,
 * and returns to the trigger. Body scroll is locked meanwhile.
 *
 * The explorer is the globe's own stage (`.globe-stage.is-exploring`, fixed
 * over the page) with one canvas, not a second globe.
 *
 * Returns { open, close, isOpen }.
 */
import { PLAY_ICON, PAUSE_ICON } from "./controls.js";

const HISTORY_KEY = "eljExplorer";

/** "HH:MM UTC" for a fractional hour. */
export function explorerTime(hour) {
  const h = ((hour % 24) + 24) % 24;
  const hh = String(Math.floor(h)).padStart(2, "0");
  const mm = String(Math.floor((h % 1) * 60)).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

/**
 * @param {{ stage: HTMLElement, trigger: HTMLElement, close: HTMLElement, bar: HTMLElement,
 *   globe: { setExplorer(on: boolean): void }, clock: any, phoneQuery?: MediaQueryList }} opts
 */
export function mountExplorer({ stage, trigger, close, bar, globe, clock, phoneQuery }) {
  bar.innerHTML =
    `<button type="button" class="ctl-play explorer-play" aria-label="Play"></button>` +
    `<div class="explorer-scrub">` +
    `<span class="explorer-time num-tabular" aria-hidden="true"></span>` +
    `<input type="range" class="explorer-range" min="0" max="24" step="0.05" aria-label="Hour of the day, UTC">` +
    `</div>`;
  const play = bar.querySelector(".explorer-play");
  const range = bar.querySelector(".explorer-range");
  const time = bar.querySelector(".explorer-time");
  const stageLabel = stage.getAttribute("aria-label");
  let isOpen = false;

  function syncPlay() {
    play.innerHTML = clock.playing ? PAUSE_ICON : PLAY_ICON;
    play.setAttribute("aria-pressed", String(clock.playing));
  }
  function syncClock(hour) {
    range.value = String(((hour % 24) + 24) % 24);
    range.setAttribute("aria-valuetext", explorerTime(hour));
    time.textContent = explorerTime(hour);
  }

  function focusables() {
    return [...stage.querySelectorAll("button, a[href], input")].filter((el) => el.offsetParent !== null && !el.disabled);
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    stage.classList.add("is-exploring");
    stage.setAttribute("role", "dialog");
    stage.setAttribute("aria-modal", "true");
    stage.setAttribute("aria-label", "Globe explorer");
    document.documentElement.classList.add("is-exploring");
    globe.setExplorer(true);
    syncPlay();
    syncClock(clock.hour);
    try { history.pushState({ [HISTORY_KEY]: true }, ""); } catch {}
    close.focus();
  }

  function shut({ fromHistory = false } = {}) {
    if (!isOpen) return;
    isOpen = false;
    stage.classList.remove("is-exploring");
    stage.removeAttribute("role");
    stage.removeAttribute("aria-modal");
    if (stageLabel) stage.setAttribute("aria-label", stageLabel);
    document.documentElement.classList.remove("is-exploring");
    globe.setExplorer(false);
    // Closed from the page (button, Escape): drop the entry we pushed, so
    // back does not reopen or strand the visitor. The popstate that follows
    // finds the explorer already closed.
    if (!fromHistory && history.state?.[HISTORY_KEY]) history.back();
    trigger.focus();
  }

  function onKey(event) {
    if (!isOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      shut();
    } else if (event.key === "Tab") {
      // Keep focus inside while the explorer covers the page.
      const els = focusables();
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  const onPop = () => { if (isOpen && !history.state?.[HISTORY_KEY]) shut({ fromHistory: true }); };
  // Widening out of the phone layout (a rotated tablet) closes it: the page
  // there has its own interactive globe.
  const onLayout = (event) => { if (!event.matches && isOpen) shut(); };

  trigger.addEventListener("click", open);
  close.addEventListener("click", () => shut());
  document.addEventListener("keydown", onKey);
  window.addEventListener("popstate", onPop);
  phoneQuery?.addEventListener("change", onLayout);
  play.addEventListener("click", () => {
    if (clock.playing) clock.pause();
    else clock.play();
    syncPlay();
  });
  range.addEventListener("input", () => {
    clock.pause();
    clock.scrub(Number(range.value));
    syncPlay();
  });
  let lastPlaying = null;
  clock.subscribe((hour) => {
    if (!isOpen) return;
    syncClock(hour);
    if (clock.playing !== lastPlaying) { lastPlaying = clock.playing; syncPlay(); }
  });

  return { open, close: () => shut(), isOpen: () => isOpen };
}
