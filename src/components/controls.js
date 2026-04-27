/**
 * Mount a transport-style control bar (play/pause + speed chips) into
 * the given container element, bound to the supplied clock instance.
 */
export function mountControls(container, clock) {
  container.innerHTML = `
    <button class="ctl-play" aria-label="Play or pause">
      <span class="ctl-play-icon"></span>
    </button>
    <div class="ctl-speed" role="group" aria-label="Playback speed">
      ${[0.5, 1, 2, 4, 8].map((s) => `
        <button class="ctl-speed-chip${s === 0.5 ? " is-active" : ""}" data-speed="${s}">${s}×</button>
      `).join("")}
      <button class="ctl-speed-chip ctl-speed-chip-now" data-now title="Snap to current UTC and follow the wall clock">Now</button>
    </div>
    <span class="ctl-utc num-tabular" aria-live="polite"></span>
  `;

  const playBtn = container.querySelector(".ctl-play");
  const playIcon = container.querySelector(".ctl-play-icon");
  const speedChips = container.querySelectorAll(".ctl-speed-chip[data-speed]");
  const nowChip = container.querySelector(".ctl-speed-chip[data-now]");
  const allChips = container.querySelectorAll(".ctl-speed-chip");
  const utcEl = container.querySelector(".ctl-utc");

  function syncChipActive() {
    if (clock.realTime) {
      allChips.forEach((c) => c.classList.toggle("is-active", c === nowChip));
      return;
    }
    allChips.forEach((c) => {
      const speedAttr = c.dataset.speed;
      const isActive = speedAttr != null && Number(speedAttr) === clock.speed;
      c.classList.toggle("is-active", isActive);
    });
  }

  function refreshPlayIcon() {
    // ⏸ (U+23F8) and ⏵ (U+23F5) are proper media-control glyphs that sit
    // optically centred in modern system fonts, unlike the earlier ▐▐ / ▶
    // which carried asymmetric bearings.
    playIcon.textContent = clock.playing ? "⏸" : "⏵";
    playBtn.setAttribute("aria-pressed", String(clock.playing));
  }

  playBtn.addEventListener("click", () => {
    if (clock.playing) clock.pause();
    else clock.play();
    refreshPlayIcon();
  });

  speedChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const speed = Number(chip.dataset.speed);
      clock.setSpeed(speed);
      // setSpeed() clears clock.realTime as a side effect; re-sync chip
      // states from the clock so the Now chip drops `is-active`.
      syncChipActive();
    });
  });

  nowChip.addEventListener("click", () => {
    clock.enableRealTime();
    // enableRealTime() snaps the hour and emits, so the subscriber below
    // will refresh the UTC readout. We still need to flip chip styling
    // explicitly because clock state changes don't drive subscribers.
    syncChipActive();
    refreshPlayIcon();
  });

  clock.subscribe((hour) => {
    const hh = String(Math.floor(hour)).padStart(2, "0");
    const mm = String(Math.floor((hour % 1) * 60)).padStart(2, "0");
    utcEl.textContent = `${hh}:${mm} UTC`;
    refreshPlayIcon();
    // Timeline scrub or external setSpeed can clear realTime without going
    // through these click handlers — keep chip styling in sync on every
    // emit so the active state is always truthful.
    syncChipActive();
  });

  refreshPlayIcon();
  syncChipActive();
}
