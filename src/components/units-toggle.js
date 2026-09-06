/**
 * Units toggle — absolute GW vs curtailment as a share of measured generation.
 *
 * Deliberately a sibling of `mode-toggle.js` rather than an extension of it:
 * that one switches the TIME WINDOW (30-day average vs last 24h), this one
 * switches the UNIT the hotspot lists are expressed in. They are orthogonal and
 * compose, so they render as two separate groups.
 *
 * Absolute magnitude rewards large grids — it cannot tell you which grid wastes
 * the largest fraction of what it generates. The share view answers that, but
 * only where the maths is not circular; see `src/lib/generation-share.ts`.
 */
export function mountUnitsToggle(container, { initial = "absolute", onChange }) {
  const units = [
    ["absolute", "GW", "Show curtailment as absolute power"],
    ["share", "% of generation", "Show curtailment as a share of measured generation, 30-day window"],
  ];
  let active = initial;

  container.innerHTML = `
    <div class="mode-toggle" role="group" aria-label="Curtailment units">
      ${units.map(([unit, label, title]) => `
        <button
          class="mode-btn${unit === active ? " mode-btn-active" : ""}"
          data-unit="${unit}"
          title="${title}"
          aria-pressed="${unit === active}"
        >${label}</button>
      `).join("")}
    </div>
  `;

  const buttons = Array.from(container.querySelectorAll(".mode-btn"));

  function setUnit(next) {
    if (next !== "absolute" && next !== "share") return;
    active = next;
    for (const button of buttons) {
      const isActive = button.dataset.unit === active;
      button.classList.toggle("mode-btn-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    }
    onChange?.(active);
  }

  for (const button of buttons) {
    button.addEventListener("click", () => setUnit(button.dataset.unit));
  }

  return { setUnit };
}
