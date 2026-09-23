export function mountModeToggle(container, { initial = "avg30d", onChange }) {
  const modes = [
    ["avg30d", "30-day avg", "Average of each hour over the last 30 days"],
    ["last24h", "Last 24 h", "The last 24 hours as measured"],
  ];
  let active = initial;

  container.innerHTML = `
    <div class="seg mode-toggle" role="group" aria-label="Time window">
      ${modes.map(([mode, label, title]) => `
        <button
          type="button"
          class="seg-btn mode-btn${mode === active ? " mode-btn-active" : ""}"
          data-mode="${mode}"
          title="${title}"
          aria-pressed="${mode === active}"
        >${label}</button>
      `).join("")}
    </div>
  `;

  const buttons = Array.from(container.querySelectorAll(".mode-btn"));

  function setMode(next) {
    if (next !== "avg30d" && next !== "last24h") return;
    active = next;
    for (const button of buttons) {
      const isActive = button.dataset.mode === active;
      button.classList.toggle("mode-btn-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    }
    onChange?.(active);
  }

  for (const button of buttons) {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  }

  return { setMode };
}
