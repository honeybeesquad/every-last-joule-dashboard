/**
 * The transport controls (play/pause, speed and "Now"), bound to the clock.
 *
 * Speeds are 0.5×, 1×, 4× and 8× plus Now, with 0.5× the default. The
 * redesign (plan D4, 2026-09-23) cut 0.5× and defaulted to 1×; 0.5× came back
 * on 2026-09-24 because 1× ran too fast to read. 1× is 0.4 simulated hours a
 * second (a day in a minute), so 0.5× is a day in two minutes. Now snaps the clock to UTC and follows the wall clock; the page's
 * `onNow` also puts the globe back on the sun, undoing a drag's turn.
 */
export const SPEEDS = [0.5, 1, 4, 8];

export const PLAY_ICON = `<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false"><path d="M3 1.5 L12 7 L3 12.5 Z" fill="currentColor"/></svg>`;
export const PAUSE_ICON = `<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false"><rect x="2.5" y="1.5" width="3.2" height="11" rx="0.8" fill="currentColor"/><rect x="8.3" y="1.5" width="3.2" height="11" rx="0.8" fill="currentColor"/></svg>`;

export function mountControls(container, clock, { onNow } = {}) {
  container.classList.add("ctl-row");
  container.innerHTML = `
    <button type="button" class="ctl-play" aria-label="Play"></button>
    <div class="seg ctl-speed" role="group" aria-label="Playback speed">
      ${SPEEDS.map((s) => `
        <button type="button" class="seg-btn ctl-speed-chip" data-speed="${s}" aria-pressed="false">${s}×</button>
      `).join("")}
    </div>
    <button type="button" class="ctl-now" data-now aria-pressed="false" title="Snap to current UTC and follow the wall clock">Now</button>
  `;

  const playBtn = container.querySelector(".ctl-play");
  const speedChips = container.querySelectorAll(".ctl-speed-chip");
  const nowBtn = container.querySelector(".ctl-now");

  function syncActive() {
    // "Now" and a speed are exclusive: Now follows the wall clock, whatever
    // speed was set before it.
    nowBtn.setAttribute("aria-pressed", String(clock.realTime));
    nowBtn.classList.toggle("is-active", clock.realTime);
    speedChips.forEach((chip) => {
      const on = !clock.realTime && Number(chip.dataset.speed) === clock.speed;
      chip.setAttribute("aria-pressed", String(on));
      chip.classList.toggle("is-active", on);
    });
  }

  function refreshPlay() {
    // A toggle button: the name stays "Play", pressed while playing.
    playBtn.innerHTML = clock.playing ? PAUSE_ICON : PLAY_ICON;
    playBtn.setAttribute("aria-pressed", String(clock.playing));
  }

  playBtn.addEventListener("click", () => {
    if (clock.playing) clock.pause();
    else clock.play();
    refreshPlay();
  });

  speedChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      clock.setSpeed(Number(chip.dataset.speed));
      // setSpeed() clears clock.realTime as a side effect.
      syncActive();
    });
  });

  nowBtn.addEventListener("click", () => {
    clock.enableRealTime();
    onNow?.();
    syncActive();
    refreshPlay();
  });

  let lastPlaying = null;
  let lastRealTime = null;
  clock.subscribe(() => {
    // A timeline scrub or an external setSpeed can change these without the
    // clicks above; keep the controls truthful, but touch the DOM only when
    // something changed (this runs on every frame while the clock plays).
    if (clock.playing !== lastPlaying) { lastPlaying = clock.playing; refreshPlay(); }
    if (clock.realTime !== lastRealTime) { lastRealTime = clock.realTime; syncActive(); }
  });

  refreshPlay();
  syncActive();
}
