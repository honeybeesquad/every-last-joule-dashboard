/**
 * MW ↔ USD unit toggle pill.
 *
 * Renders beside the headline number as a pill with two options:
 *   [MW]  USD   — energy units (default)
 *    MW  [USD]  — monetary value
 *
 * Usage:
 *   const { setUnit } = mountUnitToggle(container, {
 *     initial: "MW",
 *     onChange(unit) { ... }
 *   });
 */
export function mountUnitToggle(container, { initial = "MW", onChange } = {}) {
  const units = [
    ["MW", "MW"],
    ["USD", "USD"],
  ];
  let active = initial;

  container.innerHTML = `
    <div class="unit-toggle" role="group" aria-label="Display unit">
      ${units.map(([unit, label]) => `
        <button
          class="unit-btn${unit === active ? " unit-btn-active" : ""}"
          data-unit="${unit}"
          aria-pressed="${unit === active}"
        >${label}</button>
      `).join("")}
    </div>
  `;

  const buttons = Array.from(container.querySelectorAll(".unit-btn"));

  function setUnit(next) {
    if (next !== "MW" && next !== "USD") return;
    active = next;
    for (const button of buttons) {
      const isActive = button.dataset.unit === active;
      button.classList.toggle("unit-btn-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    }
    onChange?.(active);
  }

  for (const button of buttons) {
    button.addEventListener("click", () => setUnit(button.dataset.unit));
  }

  return { setUnit };
}
