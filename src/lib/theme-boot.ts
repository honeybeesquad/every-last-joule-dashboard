/**
 * The inline <head> script that picks the colour mode before style.css loads.
 *
 * observablehq.config.ts puts it in `head:` ahead of the stylesheet link: the
 * head config is the only place Framework guarantees script-before-CSS order,
 * and running first is what keeps the page (and the loading screen's lockup)
 * from flashing the other mode.
 *
 * Rules, decided in design review (2026-09-23; see
 * docs/superpowers/plans/archive/2026-09-23-light-dark-redesign.md, D1 and D2):
 *   - A stored choice ("light" | "dark" in localStorage["elj-theme"]) wins.
 *   - "sunfire" and "deepcurrent", values the site's old theme picker stored,
 *     map to "dark": both old themes were dark, so returning visitors keep a
 *     dark site. The mapped value counts as a choice, so it is not overridden
 *     by the OS. (Visitors may hold them for years; the mapping stays.)
 *   - Nothing stored: dark. Dark (Horizon) is the site's default look, so a
 *     first visit opens in it whatever the OS prefers (changed 2026-09-24;
 *     D1 had it follow prefers-color-scheme). Nothing is written to storage
 *     until the visitor picks a mode with the toggle.
 *   - /embed/ pages get "embed": src/embed/globe.md is the figure the DARI
 *     paper iframes, and its look is part of that published artefact (the
 *     embed block in style.css). Pinning it here, not only in the page's own
 *     script, means it never paints a mode first. It does not follow the OS.
 *
 * It is a string rather than a function so that what is tested
 * (tests/theme-boot.test.ts evaluates this exact text) is byte for byte what
 * ships. ES5 on purpose: it runs before anything else on every page.
 */
export const THEME_STORAGE_KEY = "elj-theme";

export const THEME_BOOT_SCRIPT = `(function(){
var d=document.documentElement,K="${THEME_STORAGE_KEY}";
if(/^\\/embed\\//.test(location.pathname)){d.setAttribute("data-theme","embed");return;}
function stored(){var v=null;try{v=localStorage.getItem(K);}catch(e){}
if(v==="sunfire"||v==="deepcurrent")v="dark";
return v==="light"||v==="dark"?v:null;}
d.setAttribute("data-theme",stored()||"dark");
}());`;
