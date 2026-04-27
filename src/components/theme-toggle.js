/**
 * Three-chip theme toggle. Mounts an aria-radio-group inside the host element.
 *
 * Clicking a chip:
 *   1. Sets document.documentElement.dataset.theme = newTheme
 *   2. Writes localStorage.setItem("elj-theme", newTheme)
 *   3. Updates aria-checked on every chip
 *   4. Dispatches window CustomEvent("themechange", { detail: { theme } })
 *
 * Returns a cleanup function that removes the chips and disconnects listeners.
 */

const DEFAULT_THEMES = ["sunfire", "vellum", "eclipse"];
const DEFAULT_LABELS = { sunfire: "Sunfire", vellum: "Vellum", eclipse: "Eclipse" };
const STORAGE_KEY = "elj-theme";

export function mountThemeToggle(host, opts = {}) {
  const themes = opts.themes ?? DEFAULT_THEMES;
  const labels = opts.labels ?? DEFAULT_LABELS;

  const group = document.createElement("div");
  group.className = "theme-toggle";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Visual theme");

  const buttons = themes.map((theme) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "radio");
    btn.dataset.theme = theme;
    btn.textContent = labels[theme] ?? theme;
    return btn;
  });

  function syncChecked() {
    const current = document.documentElement.dataset.theme || themes[0];
    for (const btn of buttons) {
      const isMe = btn.dataset.theme === current;
      btn.setAttribute("aria-checked", isMe ? "true" : "false");
      btn.tabIndex = isMe ? 0 : -1;
    }
  }

  function selectTheme(newTheme) {
    if (!themes.includes(newTheme)) return;
    document.documentElement.dataset.theme = newTheme;
    try { localStorage.setItem(STORAGE_KEY, newTheme); } catch {}
    syncChecked();
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: newTheme } }));
  }

  function onClick(event) {
    const btn = event.currentTarget;
    selectTheme(btn.dataset.theme);
    btn.focus();
  }

  function onKeyDown(event) {
    const btn = event.currentTarget;
    const idx = themes.indexOf(btn.dataset.theme);
    if (idx < 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = themes[(idx + 1) % themes.length];
      selectTheme(next);
      buttons[(idx + 1) % themes.length].focus();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = themes[(idx - 1 + themes.length) % themes.length];
      selectTheme(next);
      buttons[(idx - 1 + themes.length) % themes.length].focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectTheme(btn.dataset.theme);
    }
  }

  for (const btn of buttons) {
    btn.addEventListener("click", onClick);
    btn.addEventListener("keydown", onKeyDown);
    group.appendChild(btn);
  }

  syncChecked();
  host.appendChild(group);

  return function cleanup() {
    for (const btn of buttons) {
      btn.removeEventListener("click", onClick);
      btn.removeEventListener("keydown", onKeyDown);
    }
    if (group.parentNode === host) host.removeChild(group);
  };
}