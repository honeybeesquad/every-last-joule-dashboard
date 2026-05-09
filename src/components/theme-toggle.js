/**
 * Three-chip radiogroup that switches the active theme.
 *
 * Side-effects on activation:
 *   1. Sets document.documentElement.dataset.theme.
 *   2. Persists to localStorage["elj-theme"].
 *   3. Dispatches a `themechange` CustomEvent on `window` with
 *      `{ detail: { theme } }`.
 *
 * Initial active chip is read from <html data-theme="..."> (set by the
 * inline no-FOUC boot script in src/index.md).
 *
 * Returns a cleanup function that removes the rendered DOM.
 */
const VALID_THEMES = ["sunfire", "deepcurrent"];

const DEFAULT_LABELS = {
  sunfire:     "Sunfire",
  deepcurrent: "Deep Current",
};

export function mountThemeToggle(host, opts = {}) {
  if (!host || !(host instanceof Element)) {
    throw new TypeError("mountThemeToggle: host must be an Element");
  }
  const themes = opts.themes ?? VALID_THEMES;
  const labels = { ...DEFAULT_LABELS, ...(opts.labels ?? {}) };

  const root = document.createElement("div");
  root.className = "theme-toggle";
  root.setAttribute("role", "radiogroup");
  root.setAttribute("aria-label", "Visual theme");

  const buttons = themes.map((theme) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "radio");
    btn.setAttribute("data-theme", theme);
    btn.textContent = labels[theme] ?? theme;
    return btn;
  });

  for (const btn of buttons) root.appendChild(btn);

  function currentTheme() {
    const t = document.documentElement.getAttribute("data-theme");
    return themes.includes(t) ? t : themes[0];
  }

  function syncAria() {
    const active = currentTheme();
    for (const btn of buttons) {
      btn.setAttribute("aria-checked", btn.dataset.theme === active ? "true" : "false");
      btn.tabIndex = btn.dataset.theme === active ? 0 : -1;
    }
  }

  function activate(theme) {
    if (!themes.includes(theme)) return;
    if (theme === currentTheme()) return; // no-op
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("elj-theme", theme); } catch (_) { /* private mode */ }
    syncAria();
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  function onClick(e) {
    const btn = e.target.closest("button[data-theme]");
    if (!btn) return;
    activate(btn.dataset.theme);
  }

  function onKeydown(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    const cur = currentTheme();
    const idx = themes.indexOf(cur);
    let next = cur;
    if (e.key === "ArrowRight") next = themes[(idx + 1) % themes.length];
    else if (e.key === "ArrowLeft") next = themes[(idx - 1 + themes.length) % themes.length];
    // Space/Enter activate the focused chip — no movement.
    activate(next);
    const target = root.querySelector(`button[data-theme="${currentTheme()}"]`);
    target?.focus();
  }

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeydown);

  syncAria();
  host.appendChild(root);

  return function cleanup() {
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKeydown);
    if (root.parentNode === host) host.removeChild(root);
  };
}
