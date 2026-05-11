---
title: Design System
toc: false
sidebar: false
head: |
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700;800;900&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,500&family=Geist+Mono:wght@300;400;500&display=swap" rel="stylesheet">
---

<style>
/* ============================================================
   Inlined tokens.css (canonical at docs/design/tokens.css)
   ============================================================ */
:root {
  --ink:        #0A0A0A;
  --surface:    #141414;
  --surface-2:  #1A1A1A;
  --line:       #222222;
  --line-soft:  #2c2c2c;
  --text:       #F2F2F0;
  --muted:      rgba(242,242,240,0.62);
  --dim:        rgba(242,242,240,0.42);
  --accent:     #D4FF3A;
  --accent-hi:  #E2FF66;
  --cool:       #7AA6FF;
  --hot:        #FF5447;
  --font-sans:   'Inter Tight', system-ui, sans-serif;
  --font-serif:  'Newsreader', Georgia, serif;
  --font-mono:   'Geist Mono', ui-monospace, monospace;
  --r-sm:  6px;
  --r-md:  10px;
  --r-lg:  12px;
  --r-pill: 999px;
  --ease:    cubic-bezier(0.2, 0.8, 0.2, 1);
  --dur-fast: 120ms;
  --dur:      200ms;
  --dur-slow: 600ms;
  --container: 1280px;
  --gutter:    40px;
  --section-y: 96px;
  --nav-h:     64px;
}

/* ============================================================
   Override Observable Framework chrome and the dashboard's
   style.css so this page renders as a standalone Ledger surface.
   ============================================================ */
html, html[data-theme], html[data-theme="sunfire"], html[data-theme="deepcurrent"] {
  background: var(--ink) !important;
  color: var(--text) !important;
  color-scheme: dark !important;
}
body {
  background: var(--ink) !important;
  color: var(--text) !important;
  font-family: var(--font-sans) !important;
  font-size: 16px !important;
  line-height: 1.55 !important;
  margin: 0 !important;
  padding: 0 !important;
  -webkit-font-smoothing: antialiased;
}
#observablehq-center,
#observablehq-main,
main#observablehq-main {
  max-width: none !important;
  width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
  grid-template-columns: none !important;
}
#observablehq-header,
#observablehq-sidebar,
#observablehq-toc,
#observablehq-footer,
.observablehq-link,
nav#observablehq-sidebar {
  display: none !important;
}

/* ============================================================
   Inlined design-system.html embedded styles
   ============================================================ */
.ledger * { box-sizing: border-box; }
.ledger a { color: inherit; text-decoration: none; }
.ledger .container { max-width: 1280px; margin: 0 auto; padding: 0 40px; }
.ledger section { padding: 80px 0; border-bottom: 1px solid var(--line); }
.ledger h1, .ledger h2, .ledger h3 { margin: 0; letter-spacing: -0.035em; color: var(--text); font-weight: 700; }
.ledger code, .ledger pre { font-family: var(--font-mono); }
.ledger pre {
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md);
  padding: 18px 22px; font-size: 12px; color: var(--muted);
  overflow-x: auto; line-height: 1.6; margin: 0;
  white-space: pre-wrap;
}
.ledger code.inline {
  background: var(--surface); padding: 2px 8px; border-radius: 4px;
  font-size: 12.5px; color: var(--accent); border: 1px solid var(--line);
}
.ledger .grid-2 { display: grid; grid-template-columns: 0.5fr 1fr; gap: 48px; }

.ledger .eyebrow {
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
}
.ledger .mono  { font-family: var(--font-mono); }
.ledger .serif { font-family: var(--font-serif); }
.ledger .accent-word {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 500;
  color: var(--accent);
}
.ledger .live-dot {
  display: inline-block;
  width: 8px; height: 8px; border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 12px var(--accent);
  animation: ledger-pulse 1.8s ease-in-out infinite;
}
@keyframes ledger-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }

.ledger .swatch {
  aspect-ratio: 1.2;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 16px;
  display: flex; flex-direction: column; justify-content: space-between;
  position: relative;
}
.ledger .swatch .name { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; }
.ledger .swatch .hex  { font-family: var(--font-mono); font-size: 13px; }

.ledger .pill {
  display: inline-flex; align-items: center; gap: 8px;
  border-radius: var(--r-pill); padding: 12px 22px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background var(--dur-fast) ease, color var(--dur-fast) ease, transform var(--dur-fast) ease;
  white-space: nowrap;
  border: 0;
  font-family: var(--font-sans);
}
.ledger .pill.primary { background: var(--accent); color: var(--ink); }
.ledger .pill.primary:hover { background: var(--accent-hi); }
.ledger .pill.outline { border: 1.5px solid var(--text); color: var(--text); padding: 10.5px 22px; background: transparent; }
.ledger .pill.outline:hover { background: var(--text); color: var(--ink); }
.ledger .pill.ghost { color: var(--muted); background: transparent; }
.ledger .pill.ghost:hover { color: var(--text); }

.ledger .stat-card {
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md);
  padding: 20px 22px; display: flex; flex-direction: column; gap: 10px;
}
.ledger .stat-card .v {
  font-family: var(--font-mono); font-weight: 500; font-size: 38px;
  letter-spacing: -0.03em; line-height: 1; color: var(--accent);
}

.ledger .note-card {
  display: grid; grid-template-columns: 96px 1fr 130px;
  gap: 28px; align-items: center;
  padding: 22px 0;
  border-top: 1px solid var(--line);
  transition: padding 150ms var(--ease);
  cursor: pointer;
}
.ledger .note-card:last-child { border-bottom: 1px solid var(--line); }
.ledger .note-card:hover { padding-left: 8px; }
.ledger .note-card:hover .arrow { color: var(--accent); transform: translateX(4px); }
.ledger .arrow {
  font-family: var(--font-mono); color: var(--dim);
  transition: color var(--dur-fast) ease, transform var(--dur-fast) ease;
  text-align: right; font-size: 12px;
}

.ledger .tab {
  font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.14em;
  font-size: 11px; font-weight: 500;
  padding: 10px 14px; border-radius: var(--r-pill);
  border: 1px solid var(--line); color: var(--muted);
  cursor: pointer; background: transparent;
  transition: color var(--dur-fast) ease, border-color var(--dur-fast) ease, background var(--dur-fast) ease;
}
.ledger .tab.active { color: var(--ink); background: var(--accent); border-color: var(--accent); }
.ledger .tab:not(.active):hover { color: var(--text); border-color: var(--line-soft); }

.ledger input[type="range"].joule {
  -webkit-appearance: none; appearance: none; width: 100%; background: transparent; cursor: pointer;
}
.ledger input[type="range"].joule::-webkit-slider-runnable-track { height: 4px; background: var(--line-soft); border-radius: 999px; }
.ledger input[type="range"].joule::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 16px; height: 16px; border-radius: 999px; background: var(--accent);
  margin-top: -6px; box-shadow: 0 0 0 4px rgba(212,255,58,0.18);
}
.ledger input[type="range"].joule::-moz-range-track { height: 4px; background: var(--line-soft); border-radius: 999px; }
.ledger input[type="range"].joule::-moz-range-thumb {
  width: 16px; height: 16px; border: 0; border-radius: 999px; background: var(--accent);
  box-shadow: 0 0 0 4px rgba(212,255,58,0.18);
}

.ledger .type-row {
  display: grid; grid-template-columns: 200px 1fr 220px;
  align-items: center; gap: 32px;
  padding: 28px 0; border-bottom: 1px solid var(--line);
}
.ledger .type-row:last-child { border-bottom: 0; }
.ledger .type-row .role {
  font-family: var(--font-mono); font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.16em; color: var(--muted);
}
.ledger .type-row .meta {
  font-family: var(--font-mono); font-size: 11px; color: var(--dim);
  text-align: right; line-height: 1.6;
}

.ledger .anti {
  display: flex; gap: 14px; padding: 14px 0;
  border-bottom: 1px solid var(--line); align-items: center;
}
.ledger .anti:last-child { border-bottom: 0; }
.ledger .anti .x { font-family: var(--font-mono); color: var(--hot); font-size: 12px; width: 18px; }

@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.ledger .ticker-track { animation: ticker 60s linear infinite; }

@keyframes barfill { from { transform: scaleX(0); } to { transform: scaleX(1); } }

.ledger nav.top {
  position: sticky; top: 0; z-index: 50;
  background: rgba(10,10,10,0.82); backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}
.ledger nav.top .row { display: flex; justify-content: space-between; align-items: center; height: 64px; }
.ledger nav.top .links {
  display: flex; gap: 24px; font-size: 13px; font-weight: 500;
  color: var(--muted); font-family: var(--font-mono);
  text-transform: uppercase; letter-spacing: 0.12em;
}
.ledger nav.top .links a { color: var(--muted); }
.ledger nav.top .links a:hover { color: var(--text); }
.ledger nav.top .links a.active { color: var(--accent); }
</style>

<div class="ledger">

<nav class="top">
  <div class="container">
    <div class="row">
      <div style="display:flex; align-items:center; gap:12px;">
        <svg width="26" height="31" viewBox="0 0 100 120">
          <line x1="22" y1="14" x2="86" y2="14" stroke="#F2F2F0" stroke-width="11" stroke-linecap="square" />
          <line x1="68" y1="14" x2="68" y2="86" stroke="#F2F2F0" stroke-width="11" stroke-linecap="square" />
          <path d="M 68 86 Q 68 106 48 106 Q 28 106 28 86" fill="none" stroke="#F2F2F0" stroke-width="11" stroke-linecap="square" />
          <line x1="14" y1="58" x2="94" y2="58" stroke="#D4FF3A" stroke-width="7.7" stroke-linecap="square" />
        </svg>
        <div style="font-weight:700; font-size:15.5px; letter-spacing:-0.02em;">Every Last Joule</div>
        <span class="eyebrow" style="margin-left:8px; color: var(--dim);">/ Design System</span>
      </div>
      <div class="links">
        <a href="#color" class="active">Color</a>
        <a href="#type">Type</a>
        <a href="#components">Components</a>
        <a href="#motion">Motion</a>
        <a href="#voice">Voice</a>
        <a href="#anti">Anti-patterns</a>
      </div>
      <a class="pill primary" href="/">View dashboard →</a>
    </div>
  </div>
</nav>

<section style="padding-top: 100px;">
  <div class="container">
    <div class="eyebrow" style="color: var(--accent);">v1.0 · the ledger system</div>
    <h1 style="font-family: var(--font-sans); font-weight: 800; font-size: clamp(72px, 9vw, 140px); line-height: 0.9; letter-spacing: -0.045em; margin-top: 24px; text-wrap: pretty; max-width: 1100px;">
      Apply this <span class="accent-word">comprehensively</span>, not selectively.
    </h1>
    <div class="grid-2" style="margin-top: 56px; align-items: flex-start;">
      <div class="eyebrow">How to use</div>
      <div>
        <div class="serif" style="font-style: italic; font-size: 28px; line-height: 1.3; color: var(--text); text-wrap: pretty; max-width: 700px;">
          Three files are the brief. Hand all three to whoever is building the next page.
        </div>
        <div style="display:grid; grid-template-columns: 60px 1fr; row-gap: 14px; column-gap: 22px; margin-top: 36px; max-width: 720px;">
          <div class="mono" style="font-size:12px; color: var(--accent);">01</div>
          <div><code class="inline">tokens.css</code> &nbsp; — the variables. Load it once, reference everywhere.</div>
          <div class="mono" style="font-size:12px; color: var(--accent);">02</div>
          <div><code class="inline">STYLE_GUIDE.md</code> &nbsp; — the rules. The voice, the don'ts, the checklist.</div>
          <div class="mono" style="font-size:12px; color: var(--accent);">03</div>
          <div><code class="inline">design-system.html</code> &nbsp; — this page. Working examples to copy verbatim.</div>
        </div>
        <div style="margin-top: 32px;">
          <div class="eyebrow" style="margin-bottom: 12px;">Prompt to paste into Claude Code</div>
          <pre>Read STYLE_GUIDE.md, tokens.css, and design-system.html in full
before touching any other file. Refactor [PAGE] to match. Do not
invent new colors, fonts, or spacing values — every visual decision
must reference a token or a pattern defined in those three files.
If a pattern isn't covered, ask before improvising.</pre>
        </div>
      </div>
    </div>
  </div>
</section>

<section id="color">
  <div class="container">
    <div class="grid-2">
      <div>
        <div class="eyebrow">01 · Color</div>
        <h2 style="font-family: var(--font-sans); font-weight: 700; font-size: 56px; line-height: 0.98; letter-spacing: -0.04em; margin-top: 12px;">
          Nine tokens, <span class="accent-word">no improvising</span>.
        </h2>
      </div>
      <div class="serif" style="font-style: italic; font-size: 20px; line-height: 1.4; color: var(--muted); max-width: 540px;">
        Acid lime is loud. One use per fold. If a section has an accent button, the headline does not also have a lime italic word — pick one.
      </div>
    </div>
    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-top: 48px;">
      <div class="swatch" style="background: #0A0A0A;"><div><div class="name">ink</div></div><div class="hex">#0A0A0A</div></div>
      <div class="swatch" style="background: #141414;"><div><div class="name">surface</div></div><div class="hex">#141414</div></div>
      <div class="swatch" style="background: #1A1A1A;"><div><div class="name">surface-2</div></div><div class="hex">#1A1A1A</div></div>
      <div class="swatch" style="background: #222222;"><div><div class="name">line</div></div><div class="hex">#222222</div></div>
      <div class="swatch" style="background: #2C2C2C;"><div><div class="name">line-soft</div></div><div class="hex">#2C2C2C</div></div>
      <div class="swatch" style="background: #F2F2F0; color: #0A0A0A; border-color: #F2F2F0;"><div><div class="name">text</div></div><div class="hex">#F2F2F0</div></div>
      <div class="swatch" style="background: #D4FF3A; color: #0A0A0A; border-color: #D4FF3A;"><div><div class="name">accent</div></div><div class="hex">#D4FF3A</div></div>
      <div class="swatch" style="background: #E2FF66; color: #0A0A0A; border-color: #E2FF66;"><div><div class="name">accent-hi</div></div><div class="hex">#E2FF66</div></div>
      <div class="swatch" style="background: #7AA6FF; color: #0A0A0A; border-color: #7AA6FF;"><div><div class="name">cool</div></div><div class="hex">#7AA6FF</div></div>
      <div class="swatch" style="background: #FF5447; color: #0A0A0A; border-color: #FF5447;"><div><div class="name">hot</div></div><div class="hex">#FF5447</div></div>
    </div>
    <div style="margin-top: 40px; display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div style="padding: 20px 22px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md);">
        <div class="eyebrow" style="color: var(--accent);">✓ DO</div>
        <div style="margin-top:10px; font-size: 14.5px; color: var(--muted); line-height: 1.55;">
          One acid moment per viewport. A primary CTA <em>or</em> an italic accent word, not both.
        </div>
      </div>
      <div style="padding: 20px 22px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md);">
        <div class="eyebrow" style="color: var(--hot);">✗ DON'T</div>
        <div style="margin-top:10px; font-size: 14.5px; color: var(--muted); line-height: 1.55;">
          Use <code class="inline">--cool</code> or <code class="inline">--hot</code> as UI chrome. They are <em>data</em> colors — series only.
        </div>
      </div>
    </div>
  </div>
</section>

<section id="type">
  <div class="container">
    <div class="grid-2">
      <div>
        <div class="eyebrow">02 · Type</div>
        <h2 style="font-family: var(--font-sans); font-weight: 700; font-size: 56px; line-height: 0.98; letter-spacing: -0.04em; margin-top: 12px;">
          Three families, <span class="accent-word">three jobs</span>.
        </h2>
      </div>
      <div class="serif" style="font-style: italic; font-size: 20px; line-height: 1.4; color: var(--muted); max-width: 540px;">
        Inter Tight does structure. Geist Mono does numbers. Newsreader italic is the editorial voice — one word per headline, never more.
      </div>
    </div>
    <div style="margin-top: 48px;">
      <div class="type-row">
        <div class="role">Display · H1</div>
        <div style="font-family: var(--font-sans); font-weight: 800; font-size: 96px; line-height: 0.86; letter-spacing: -0.05em;">Every Last <span class="accent-word">Joule.</span></div>
        <div class="meta">Inter Tight 800<br>clamp(96, 14vw, 220)<br>-0.05em · lh 0.86</div>
      </div>
      <div class="type-row">
        <div class="role">H2 · section</div>
        <div style="font-family: var(--font-sans); font-weight: 700; font-size: 56px; line-height: 1; letter-spacing: -0.04em;">Reporting from <span class="accent-word">the grid edge</span>.</div>
        <div class="meta">Inter Tight 700<br>56–68px<br>-0.04em · lh 0.95–1</div>
      </div>
      <div class="type-row">
        <div class="role">Pull quote</div>
        <div class="serif" style="font-style: italic; font-weight: 400; font-size: 40px; line-height: 1.18; letter-spacing: -0.02em;">A megawatt-hour stranded at a Texas wellhead is, in every meaningful sense, worthless.</div>
        <div class="meta">Newsreader italic 400<br>32–48px<br>-0.02em · lh 1.15–1.2</div>
      </div>
      <div class="type-row">
        <div class="role">Body</div>
        <div style="font-family: var(--font-sans); font-weight: 400; font-size: 16px; line-height: 1.65; color: var(--muted); max-width: 540px;">
          Every Last Joule is a live database and a forthcoming book. The database tracks every megawatt-hour the Bitcoin network spends, where on Earth it came from, and what it cost the atmosphere.
        </div>
        <div class="meta">Inter Tight 400<br>15–16px<br>0 · lh 1.55–1.65</div>
      </div>
      <div class="type-row">
        <div class="role">Eyebrow</div>
        <div class="eyebrow">FIELD NOTES · MAY 11 2026</div>
        <div class="meta">Geist Mono 500<br>11px uppercase<br>0.16em tracking</div>
      </div>
      <div class="type-row">
        <div class="role">Stat numeral</div>
        <div class="mono" style="font-size: 56px; font-weight: 500; letter-spacing: -0.03em; color: var(--accent); line-height: 1;">642.18</div>
        <div class="meta">Geist Mono 500<br>38–56px<br>-0.03em · lh 1</div>
      </div>
      <div class="type-row">
        <div class="role">Micro / metadata</div>
        <div class="mono" style="font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.14em;">UPDATED 00:42 AGO · METHODOLOGY v2.4</div>
        <div class="meta">Geist Mono 400<br>11–12px<br>0.04–0.14em</div>
      </div>
    </div>
  </div>
</section>

<section id="components">
  <div class="container">
    <div class="grid-2">
      <div>
        <div class="eyebrow">03 · Components</div>
        <h2 style="font-family: var(--font-sans); font-weight: 700; font-size: 56px; line-height: 0.98; letter-spacing: -0.04em; margin-top: 12px;">
          A small <span class="accent-word">vocabulary</span>.
        </h2>
      </div>
      <div class="serif" style="font-style: italic; font-size: 20px; line-height: 1.4; color: var(--muted); max-width: 540px;">
        Seven pieces do all the work. Copy the markup verbatim — don't reinvent any of them.
      </div>
    </div>
    <div style="margin-top: 56px;">
      <div class="eyebrow" style="margin-bottom: 18px;">Pill button · primary / outline / ghost</div>
      <div style="display: flex; gap: 14px; align-items: center; padding: 24px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md);">
        <button class="pill primary">Preorder · $32</button>
        <button class="pill outline">Read chapter one →</button>
        <button class="pill ghost mono" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em;">All notes →</button>
      </div>
    </div>
    <div style="margin-top: 40px;">
      <div class="eyebrow" style="margin-bottom: 18px;">Stat card</div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
        <div class="stat-card">
          <div class="eyebrow">Hashrate</div>
          <div style="display:flex; align-items:baseline; gap:8px;">
            <div class="v">642.18</div>
            <div class="mono" style="font-size:12px; color: var(--muted);">EH/s</div>
          </div>
          <div style="height:3px; background: var(--line-soft); border-radius: 2px; overflow: hidden;">
            <div style="height:100%; width: 78%; background: var(--accent); transform-origin: left; animation: barfill 1.2s var(--ease) both;"></div>
          </div>
          <div class="mono" style="font-size:11px; color: var(--muted);">▲ 2.4% · 30d</div>
        </div>
        <div class="stat-card">
          <div class="eyebrow">Grid carbon</div>
          <div style="display:flex; align-items:baseline; gap:8px;">
            <div class="v" style="color: var(--cool);">412</div>
            <div class="mono" style="font-size:12px; color: var(--muted);">g/kWh</div>
          </div>
          <div style="height:3px; background: var(--line-soft); border-radius: 2px; overflow: hidden;">
            <div style="height:100%; width: 45%; background: var(--cool); transform-origin: left; animation: barfill 1.2s 80ms var(--ease) both;"></div>
          </div>
          <div class="mono" style="font-size:11px; color: var(--muted);">▼ 0.8% · 30d</div>
        </div>
        <div class="stat-card">
          <div class="eyebrow">Flared gas mined</div>
          <div style="display:flex; align-items:baseline; gap:8px;">
            <div class="v" style="color: var(--text);">1.27</div>
            <div class="mono" style="font-size:12px; color: var(--muted);">% of supply</div>
          </div>
          <div style="height:3px; background: var(--line-soft); border-radius: 2px; overflow: hidden;">
            <div style="height:100%; width: 62%; background: var(--text); transform-origin: left; animation: barfill 1.2s 160ms var(--ease) both;"></div>
          </div>
          <div class="mono" style="font-size:11px; color: var(--muted);">YTD</div>
        </div>
        <div class="stat-card">
          <div class="eyebrow">Cumulative joules</div>
          <div style="display:flex; align-items:baseline; gap:8px;">
            <div class="v">8.4×10¹⁹</div>
            <div class="mono" style="font-size:12px; color: var(--muted);">J</div>
          </div>
          <div style="height:3px; background: var(--line-soft); border-radius: 2px; overflow: hidden;">
            <div style="height:100%; width: 92%; background: var(--accent); transform-origin: left; animation: barfill 1.2s 240ms var(--ease) both;"></div>
          </div>
          <div class="mono" style="font-size:11px; color: var(--muted);">since 2009</div>
        </div>
      </div>
    </div>
    <div style="margin-top: 40px;">
      <div class="eyebrow" style="margin-bottom: 18px;">Note card</div>
      <div>
        <div class="note-card">
          <div>
            <div class="mono" style="font-size:13px; color: var(--accent);">014</div>
            <div class="mono" style="font-size:11px; color: var(--muted); margin-top: 4px;">May 11, 2026</div>
          </div>
          <div>
            <div class="eyebrow" style="color: var(--dim);">Essay</div>
            <div class="serif" style="font-style: italic; font-weight: 500; font-size: 30px; line-height: 1.15; letter-spacing: -0.015em; margin-top: 6px;">The strange new battery, in twelve charts</div>
          </div>
          <div class="arrow">12 min →</div>
        </div>
        <div class="note-card">
          <div>
            <div class="mono" style="font-size:13px; color: var(--accent);">013</div>
            <div class="mono" style="font-size:11px; color: var(--muted); margin-top: 4px;">Apr 28, 2026</div>
          </div>
          <div>
            <div class="eyebrow" style="color: var(--dim);">Field</div>
            <div class="serif" style="font-style: italic; font-weight: 500; font-size: 30px; line-height: 1.15; letter-spacing: -0.015em; margin-top: 6px;">What a Texas wellhead sounds like</div>
          </div>
          <div class="arrow">8 min →</div>
        </div>
      </div>
    </div>
    <div style="margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div>
        <div class="eyebrow" style="margin-bottom: 18px;">Tab (pill segmented)</div>
        <div style="display: flex; gap: 8px; padding: 24px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); flex-wrap: wrap;">
          <button class="tab active">Joules spent</button>
          <button class="tab">Grid carbon</button>
          <button class="tab">Flared-gas share</button>
          <button class="tab">Hashrate</button>
        </div>
      </div>
      <div>
        <div class="eyebrow" style="margin-bottom: 18px;">Range slider</div>
        <div style="padding: 24px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md);">
          <div class="eyebrow" style="margin-bottom: 12px;">Through 2026</div>
          <input type="range" class="joule" min="2020" max="2026" value="2026" />
          <div style="display:flex; justify-content:space-between; margin-top: 8px;">
            <span class="mono" style="font-size:11px; color: var(--muted);">2020</span>
            <span class="mono" style="font-size:11px; color: var(--muted);">2026</span>
          </div>
        </div>
      </div>
    </div>
    <div style="margin-top: 40px;">
      <div class="eyebrow" style="margin-bottom: 18px;">Ticker</div>
      <div style="border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); overflow: hidden;">
        <div class="ticker-track mono" style="display: flex; gap: 56px; padding: 16px 0; white-space: nowrap; font-size: 12px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--muted); width: max-content;">
          <span><span style="color: var(--accent);">·</span> BLOCK 887,402</span>
          <span><span style="color: var(--accent);">·</span> HASHRATE 642.18 EH/s ▲</span>
          <span><span style="color: var(--accent);">·</span> GRID CARBON 412 g/kWh ▼</span>
          <span><span style="color: var(--accent);">·</span> FLARED-GAS SHARE 1.27%</span>
          <span><span style="color: var(--accent);">·</span> LAST UPDATE 00:42</span>
          <span><span style="color: var(--accent);">·</span> BLOCK 887,402</span>
          <span><span style="color: var(--accent);">·</span> HASHRATE 642.18 EH/s ▲</span>
          <span><span style="color: var(--accent);">·</span> GRID CARBON 412 g/kWh ▼</span>
          <span><span style="color: var(--accent);">·</span> FLARED-GAS SHARE 1.27%</span>
          <span><span style="color: var(--accent);">·</span> LAST UPDATE 00:42</span>
        </div>
      </div>
    </div>
  </div>
</section>

<section id="motion">
  <div class="container">
    <div class="grid-2">
      <div>
        <div class="eyebrow">04 · Motion</div>
        <h2 style="font-family: var(--font-sans); font-weight: 700; font-size: 48px; line-height: 1; letter-spacing: -0.04em; margin-top: 12px;">
          Three primitives, <span class="accent-word">used sparingly</span>.
        </h2>
      </div>
      <div>
        <div style="display: grid; grid-template-columns: 30px 1fr 1fr; row-gap: 18px; column-gap: 22px; align-items: center;">
          <div class="mono" style="color: var(--accent); font-size: 12px;">01</div>
          <div><strong>Live dot pulse</strong> · 1.8s ease-in-out · opacity 1 → 0.35</div>
          <div style="display:flex; justify-content:flex-end;"><span class="live-dot"></span></div>
          <div class="mono" style="color: var(--accent); font-size: 12px;">02</div>
          <div><strong>Ticker scroll</strong> · 60s linear loop</div>
          <div class="mono" style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.14em; text-align: right;">→ → →</div>
          <div class="mono" style="color: var(--accent); font-size: 12px;">03</div>
          <div><strong>Bar fill</strong> · 1.2s cubic-bezier(.2,.8,.2,1) · staggered 80ms</div>
          <div style="height:4px; background: var(--line-soft); border-radius: 2px; overflow: hidden;"><div style="height:100%; background: var(--accent); transform-origin: left; animation: barfill 2s var(--ease) infinite;"></div></div>
        </div>
        <div class="serif" style="font-style: italic; font-size: 18px; color: var(--muted); margin-top: 32px; line-height: 1.4;">
          Everything else is a 120ms single-property transition. No bounces. No scale-on-hover. No parallax.
        </div>
      </div>
    </div>
  </div>
</section>

<section id="voice">
  <div class="container">
    <div class="grid-2">
      <div>
        <div class="eyebrow">05 · Voice</div>
        <h2 style="font-family: var(--font-sans); font-weight: 700; font-size: 48px; line-height: 1; letter-spacing: -0.04em; margin-top: 12px;">
          Reports, <span class="accent-word">never sells</span>.
        </h2>
      </div>
      <div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div style="padding: 22px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md);">
            <div class="eyebrow" style="color: var(--accent);">✓ ON-BRAND</div>
            <div class="mono" style="font-size: 14px; margin-top: 14px; line-height: 1.55;">642.18 EH/s. Up 2.4% over 30 days.</div>
            <div style="margin-top: 18px; font-size: 14.5px; color: var(--muted);">"Reporting from the grid edge."</div>
            <div class="mono" style="font-size: 14px; margin-top: 14px;">Ships Sept 2026</div>
          </div>
          <div style="padding: 22px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md);">
            <div class="eyebrow" style="color: var(--hot);">✗ OFF-BRAND</div>
            <div style="font-size: 14px; margin-top: 14px; line-height: 1.55; color: var(--muted);">Massive growth in network security!</div>
            <div style="margin-top: 18px; font-size: 14.5px; color: var(--muted);">"Discover the future of Bitcoin energy."</div>
            <div style="font-size: 14px; margin-top: 14px; color: var(--muted);">Coming soon!</div>
          </div>
        </div>
        <div class="serif" style="font-style: italic; font-size: 20px; color: var(--muted); margin-top: 28px; line-height: 1.4; max-width: 600px;">
          If a sentence needs an exclamation point to land, the sentence is wrong.
        </div>
      </div>
    </div>
  </div>
</section>

<section id="anti">
  <div class="container">
    <div class="grid-2">
      <div>
        <div class="eyebrow" style="color: var(--hot);">06 · Anti-patterns</div>
        <h2 style="font-family: var(--font-sans); font-weight: 700; font-size: 48px; line-height: 1; letter-spacing: -0.04em; margin-top: 12px;">
          The <span class="accent-word">slop list</span>.
        </h2>
        <div class="serif" style="font-style: italic; font-size: 18px; color: var(--muted); margin-top: 20px; line-height: 1.4; max-width: 420px;">
          Auto-reject. If you catch yourself building one, the design has drifted — back up.
        </div>
      </div>
      <div>
        <div class="anti"><div class="x">✗</div><div>Gradient backgrounds. Especially purple-to-pink. Especially radial.</div></div>
        <div class="anti"><div class="x">✗</div><div>Rounded-corner cards with a 4px left-border accent stripe.</div></div>
        <div class="anti"><div class="x">✗</div><div>Glassmorphism on anything except the sticky nav.</div></div>
        <div class="anti"><div class="x">✗</div><div>Emoji. The brand has zero. None.</div></div>
        <div class="anti"><div class="x">✗</div><div>Lottie mascots, illustrated humans, animated SVG faces.</div></div>
        <div class="anti"><div class="x">✗</div><div>Three-up "feature tiles" with an icon + headline + 20 words.</div></div>
        <div class="anti"><div class="x">✗</div><div>"Trusted by" logo strips.</div></div>
        <div class="anti"><div class="x">✗</div><div>Hero carousels. Auto-rotators. Any rotator at all.</div></div>
        <div class="anti"><div class="x">✗</div><div>Drop shadows on cards. The hairline border <em>is</em> the edge.</div></div>
        <div class="anti"><div class="x">✗</div><div>Pure <code class="inline">#000</code> backgrounds and <code class="inline">#fff</code> text.</div></div>
        <div class="anti"><div class="x">✗</div><div>"Get started for free" / "Join 10,000+ users" social-proof copy.</div></div>
        <div class="anti"><div class="x">✗</div><div>Decorative icons next to labels that are already clear.</div></div>
      </div>
    </div>
  </div>
</section>

<section style="border-bottom: 0;">
  <div class="container">
    <div class="grid-2">
      <div>
        <div class="eyebrow">07 · Ship checklist</div>
        <h2 style="font-family: var(--font-sans); font-weight: 700; font-size: 48px; line-height: 1; letter-spacing: -0.04em; margin-top: 12px;">
          Eleven boxes, <span class="accent-word">no exceptions</span>.
        </h2>
      </div>
      <div>
        <div style="display: grid; grid-template-columns: 30px 1fr; row-gap: 14px; column-gap: 18px; font-size: 15px; line-height: 1.5;">
          <div class="mono" style="color: var(--accent);">□</div><div>Every section has a Geist Mono eyebrow above its headline.</div>
          <div class="mono" style="color: var(--accent);">□</div><div>Every headline contains exactly one italic serif accent word — or zero. Never two.</div>
          <div class="mono" style="color: var(--accent);">□</div><div>Every number on the page is in Geist Mono.</div>
          <div class="mono" style="color: var(--accent);">□</div><div>The accent color appears at most once per viewport.</div>
          <div class="mono" style="color: var(--accent);">□</div><div>Sections separated by a 1px hairline, not whitespace alone.</div>
          <div class="mono" style="color: var(--accent);">□</div><div>No drop shadows, gradients (except chart fills), or emoji.</div>
          <div class="mono" style="color: var(--accent);">□</div><div>Buttons are pills. Primary is lime, secondary is outline.</div>
          <div class="mono" style="color: var(--accent);">□</div><div>At least one mono-numeral stat or chart above the fold.</div>
          <div class="mono" style="color: var(--accent);">□</div><div>At least one italic pull-quote in any section over 400 words.</div>
          <div class="mono" style="color: var(--accent);">□</div><div>Hover states are 120ms, single-property, no scale.</div>
          <div class="mono" style="color: var(--accent);">□</div><div><code class="inline">text-wrap: pretty</code> on every headline.</div>
        </div>
      </div>
    </div>
  </div>
</section>

<footer style="padding: 56px 0; border-top: 1px solid var(--line);">
  <div class="container" style="display: flex; justify-content: space-between; align-items: center;">
    <div class="mono" style="font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: 0.14em;">
      Every Last Joule · Design System · v1.0 · canonical files in docs/design/
    </div>
    <div style="display:flex; gap: 12px;">
      <a class="pill outline" href="/">Dashboard →</a>
    </div>
  </div>
</footer>

</div>
