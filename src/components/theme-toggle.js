/**
 * The colour-mode switch: light (Almanac) and dark (Horizon).
 *
 * Two looks, one component:
 *   - default: a radiogroup of two icon buttons (sun, moon) in a pill. The
 *     active one is aria-checked; roving tabindex; arrow keys move and
 *     activate, as a radiogroup does.
 *   - `compact: true` (phones): one 44px button that shows the mode it
 *     switches TO, labelled "Switch to dark mode" / "Switch to light mode".
 *
 * Side-effects on activation:
 *   1. Sets document.documentElement's data-theme.
 *   2. Persists to localStorage["elj-theme"]. From then on the page stops
 *      following the OS setting (see src/lib/theme-boot.ts).
 *   3. Dispatches one `themechange` CustomEvent on `window` with
 *      `{ detail: { theme } }`.
 * Where the browser has document.startViewTransition and the visitor has not
 * asked for reduced motion, the switch cross-fades (200ms, style.css).
 *
 * The component also listens for `themechange` itself, so it stays in step
 * when the mode changes from elsewhere (the boot script following the OS).
 *
 * Returns a cleanup function that removes the rendered DOM and listeners.
 */
export const VALID_THEMES = ["light", "dark"];

const STORAGE_KEY = "elj-theme";

const NAMES = {
  light: "Light mode",
  dark: "Dark mode",
};

// 16px icons, 1.4px stroke, drawn in currentColor so CSS picks the colour.
const SUN_RAYS = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
  const a = (deg * Math.PI) / 180;
  const p = (r) => [8 + r * Math.cos(a), 8 + r * Math.sin(a)].map((v) => v.toFixed(2));
  const [x1, y1] = p(5.2);
  const [x2, y2] = p(7);
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
}).join("");

const ICONS = {
  light:
    `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"` +
    ` fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">` +
    `<circle cx="8" cy="8" r="3"/>${SUN_RAYS}</svg>`,
  dark:
    `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"` +
    ` fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">` +
    `<path d="M12.8 10.4A5.6 5.6 0 0 1 5.6 3.2a5.6 5.6 0 1 0 7.2 7.2z"/></svg>`,
};

export function mountThemeToggle(host, opts = {}) {
  if (!host || !(host instanceof Element)) {
    throw new TypeError("mountThemeToggle: host must be an Element");
  }
  const themes = VALID_THEMES;
  const compact = Boolean(opts.compact);

  function currentTheme() {
    const t = document.documentElement.getAttribute("data-theme");
    return themes.includes(t) ? t : themes[0];
  }

  function apply(theme) {
    // A second click while a view transition is pending runs this twice for
    // the same mode; only the first may write and announce.
    if (document.documentElement.getAttribute("data-theme") === theme) return;
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) { /* private mode */ }
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  function activate(theme) {
    if (!themes.includes(theme)) return;
    if (theme === currentTheme()) return; // no-op: no write, no event
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (typeof document.startViewTransition === "function" && !reduce) {
      document.startViewTransition(() => apply(theme));
    } else {
      apply(theme);
    }
  }

  let root;
  let buttons = [];
  let sync;

  if (compact) {
    root = document.createElement("button");
    root.type = "button";
    root.className = "theme-toggle theme-toggle--compact";
    sync = () => {
      const next = currentTheme() === "light" ? "dark" : "light";
      root.dataset.themeTarget = next;
      root.setAttribute("aria-label", `Switch to ${next} mode`);
      root.innerHTML = ICONS[next];
    };
    root.addEventListener("click", () => activate(root.dataset.themeTarget));
  } else {
    root = document.createElement("div");
    root.className = "theme-toggle";
    root.setAttribute("role", "radiogroup");
    root.setAttribute("aria-label", "Colour mode");
    buttons = themes.map((theme) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.setAttribute("data-theme", theme);
      btn.setAttribute("aria-label", NAMES[theme]);
      btn.innerHTML = ICONS[theme];
      root.appendChild(btn);
      return btn;
    });
    sync = () => {
      const active = currentTheme();
      for (const btn of buttons) {
        const on = btn.dataset.theme === active;
        btn.setAttribute("aria-checked", on ? "true" : "false");
        btn.tabIndex = on ? 0 : -1;
      }
    };
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-theme]");
      if (btn) activate(btn.dataset.theme);
    });
    root.addEventListener("keydown", (e) => {
      const arrow = e.key === "ArrowLeft" || e.key === "ArrowRight";
      if (!arrow && e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      let target;
      if (arrow) {
        // Arrows move and activate, as in any radiogroup.
        const idx = themes.indexOf(currentTheme());
        const step = e.key === "ArrowRight" ? 1 : -1;
        target = themes[(idx + step + themes.length) % themes.length];
      } else {
        // Space/Enter activate the focused chip, without moving.
        target = e.target.closest("button[data-theme]")?.dataset.theme ?? currentTheme();
      }
      activate(target);
      // Focus follows the choice even while a view transition defers the swap.
      root.querySelector(`button[data-theme="${target}"]`)?.focus();
    });
  }

  function onThemeChange() { sync(); }
  window.addEventListener("themechange", onThemeChange);

  sync();
  host.appendChild(root);

  return function cleanup() {
    window.removeEventListener("themechange", onThemeChange);
    if (root.parentNode === host) host.removeChild(root);
  };
}
