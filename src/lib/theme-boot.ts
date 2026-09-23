/**
 * The inline <head> script that picks the colour mode before style.css loads.
 *
 * observablehq.config.ts puts it in `head:` ahead of the stylesheet link: the
 * head config is the only place Framework guarantees script-before-CSS order,
 * and running first is what keeps the page (and the loading screen's lockup)
 * from flashing the other mode.
 *
 * Rules, decided in design review (2026-09-23; see
 * docs/superpowers/plans/2026-09-23-light-dark-redesign.md, D1 and D2):
 *   - A stored choice ("light" | "dark" in localStorage["elj-theme"]) wins.
 *   - "sunfire" and "deepcurrent", the old picker's values, map to "dark":
 *     both old themes were dark, so returning visitors keep a dark site. The
 *     mapped value counts as a choice, so it is not overridden by the OS.
 *   - Nothing stored: follow prefers-color-scheme, and keep following live
 *     changes to it without writing to storage. The first time the visitor
 *     picks a mode (the toggle writes storage) the page stops following.
 *   - /embed/ pages keep "sunfire": src/embed/globe.md is the figure the DARI
 *     paper iframes, and its look is part of that published artefact. Pinning
 *     it here, not only in the page's own script, means it never paints a
 *     mode first. It does not follow the OS.
 *
 * It is a string rather than a function so that what is tested
 * (tests/theme-boot.test.ts evaluates this exact text) is byte for byte what
 * ships. ES5 on purpose: it runs before anything else on every page.
 */
export const THEME_STORAGE_KEY = "elj-theme";

export const THEME_BOOT_SCRIPT = `(function(){
var d=document.documentElement,K="${THEME_STORAGE_KEY}";
if(/^\\/embed\\//.test(location.pathname)){d.setAttribute("data-theme","sunfire");return;}
function stored(){var v=null;try{v=localStorage.getItem(K);}catch(e){}
if(v==="sunfire"||v==="deepcurrent")v="dark";
return v==="light"||v==="dark"?v:null;}
var mq=window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)"):null;
d.setAttribute("data-theme",stored()||(mq&&mq.matches?"dark":"light"));
if(mq&&mq.addEventListener)mq.addEventListener("change",function(e){
if(stored())return;
var t=e.matches?"dark":"light";
if(d.getAttribute("data-theme")===t)return;
d.setAttribute("data-theme",t);
window.dispatchEvent(new CustomEvent("themechange",{detail:{theme:t}}));});
}());`;
