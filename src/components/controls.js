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
        <button class="ctl-speed-chip${s === 2 ? " is-active" : ""}" data-speed="${s}">${s}×</button>
      `).join("")}
    </div>
    <span class="ctl-utc num-tabular" aria-live="polite"></span>
  `;

  const playBtn = container.querySelector(".ctl-play");
  const playIcon = container.querySelector(".ctl-play-icon");
  const chips = container.querySelectorAll(".ctl-speed-chip");
  const utcEl = container.querySelector(".ctl-utc");

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

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const speed = Number(chip.dataset.speed);
      clock.setSpeed(speed);
      chips.forEach((candidate) => candidate.classList.toggle("is-active", candidate === chip));
    });
  });

  clock.subscribe((hour) => {
    const hh = String(Math.floor(hour)).padStart(2, "0");
    const mm = String(Math.floor((hour % 1) * 60)).padStart(2, "0");
    utcEl.textContent = `${hh}:${mm} UTC`;
    refreshPlayIcon();
  });

  refreshPlayIcon();
}
