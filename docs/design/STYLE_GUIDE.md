# Every Last Joule — Design System

A comprehensive spec for applying the Ledger look-and-feel to the entire site. Hand this file to Claude (Claude Code, a new chat, etc.) along with `tokens.css` and `design-system.html`. The three together are the brief.

---

## How to use this document

**Pasting into Claude Code:**

```
Read STYLE_GUIDE.md, tokens.css, and design-system.html in full before touching any other file.
Then refactor [PAGE/COMPONENT] to match. Do not invent new colors, fonts, or spacing values —
every visual decision must reference a token or a pattern defined in those three files.
If a pattern isn't covered, ASK before improvising.
```

**The rule of three:** any new screen must reuse at least three patterns from this doc. If you find yourself inventing a fourth new pattern, the design is drifting — stop and check.

---

## 1 · The idea behind the look

Every Last Joule is a **ledger**, not a magazine. The design is meant to feel like a Bloomberg terminal that learned to write essays — quiet, dense, factual, with one piece of editorial italic per page to remind you a human is reading the data.

Three forces are always in tension on a good page:

1. **Mono numerals** — every number is in Geist Mono. Numbers are evidence. They get the data-terminal treatment.
2. **Sans body** — Inter Tight does the structural work. Headlines, nav, buttons, body copy.
3. **Italic serif accents** — Newsreader italic appears once per section as the *emotional* word. One per headline, max. Never sets a whole paragraph except in pull-quotes.

When in doubt, the page should look like 80% terminal, 20% library.

---

## 2 · Color

Tokens live in `tokens.css`. Rules for using them:

| Token | Hex | Use for | Do NOT use for |
|---|---|---|---|
| `--ink` | `#0A0A0A` | Page background | Don't use pure `#000` — too cold |
| `--surface` | `#141414` | Cards, chart panels | Don't stack >2 surface layers |
| `--line` | `#222222` | Section dividers, card borders | Don't use as text |
| `--text` | `#F2F2F0` | Primary text | Don't use pure white |
| `--muted` | rgba 62% | Secondary text, captions | Body paragraphs (use `--text`) |
| `--dim` | rgba 42% | Metadata, ticker, micro-copy | Anything you need someone to read |
| `--accent` | `#D4FF3A` | ONE accent per viewport — a CTA, a key number, an italic word | Backgrounds, body text, large fills |
| `--cool` | `#7AA6FF` | Secondary chart series only | UI chrome |
| `--hot` | `#FF5447` | Down/alarm indicators only | Headlines, primary actions |

**The accent rule.** Acid lime is loud. One use per fold. If a section has an accent button, the headline does NOT also have a lime italic word. Pick one.

**No gradients.** No glass. No drop shadows on UI. The one exception: the soft area-fill gradient *under* a chart line (set to ~32% → 0% of the line color).

---

## 3 · Typography

Load these three families and nothing else:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700;800;900&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,400..600&family=Geist+Mono:wght@300;400;500&display=swap" rel="stylesheet">
```

### Scale

| Role | Family | Weight | Size | Tracking | Notes |
|---|---|---|---|---|---|
| Display (hero) | Inter Tight | 800 | clamp(96px, 14vw, 220px) | -0.05em | Line-height 0.86 |
| H2 (section) | Inter Tight | 700 | 56–68px | -0.04em | Line-height 0.95–1 |
| H3 (card title) | Inter Tight | 600 | 28–32px | -0.025em | |
| Accent word | Newsreader | 500 italic | inherit | -0.015em | Lives inside H1/H2 |
| Pull quote | Newsreader | 400 italic | 32–48px | -0.02em | One per long section |
| Body | Inter Tight | 400 | 15–16px | 0 | Line-height 1.55–1.65 |
| Eyebrow | Geist Mono | 500 | 11px | 0.16em uppercase | Above every section title |
| Stat numeral | Geist Mono | 500 | 38–56px | -0.03em | Line-height 1 |
| Micro / metadata | Geist Mono | 400 | 11–12px | 0.04–0.14em | |

### Type rules

1. **Numbers go in mono. Always.** Dates, counts, percentages, slide numbers, prices, ISBNs, timestamps. If it's a number, it's `font-family: var(--font-mono)`.
2. **Eyebrows are mandatory.** Every section title is preceded by a Geist Mono eyebrow (uppercase, 0.16em tracking). It tells the reader what they're looking at before the headline tries to be clever.
3. **One italic word per headline.** The Newsreader italic serif word is the editorial voice. Use it to call out the noun the section is actually about: "Every joule, *accounted for*." "Reporting from *the grid edge*." Never two in a row.
4. **No all-caps body.** Uppercase belongs to eyebrows, tabs, and the ticker. Anything longer than ~30 characters loses legibility.
5. **`text-wrap: pretty`** on every headline and pull quote. Not optional.

---

## 4 · Layout

- **Container:** `max-width: 1280px; padding: 0 40px;` — every section uses this. The hero may break out, but content always returns to the rail.
- **Section rhythm:** `padding: 96px 0;` with a single `border-bottom: 1px solid var(--line)` between every section. Hairlines do the work that whitespace alone cannot.
- **Grids:** lean on `display: grid` with explicit column ratios (`0.5fr 1fr`, `1.3fr 1fr`). Asymmetric ratios feel editorial; equal columns feel like marketing.
- **Eyebrow + content split:** the manifesto/subscribe pattern (`0.5fr 1fr`, eyebrow on the left, content on the right) is the workhorse two-column. Use it for any "label + body" moment.
- **No card grids of 3-up marketing tiles.** That's marketing slop. If you want three things side by side, they should be `stat-card`s with real numbers, or `note-card`s with real titles.

---

## 5 · Components

All implemented in `design-system.html`. Copy the markup verbatim.

### Pill button

Three variants:

- `.pill.primary` — acid-lime fill, ink text. Reserved for the single primary action per section.
- `.pill.outline` — 1.5px text-colored border. The secondary action.
- `.pill.ghost` — text only, used in nav-adjacent positions ("All notes →").

Pills are always pills (border-radius 999px). No square buttons anywhere on the site.

### Stat card

```
[eyebrow]
[BIG MONO NUMBER]  [unit in muted mono]
[bar fill — 3px, animated on enter]
[delta in muted mono · 30d]
```

Use for: live network metrics, dataset coverage, anything where the headline is a number.

### Note card

A 96 / 1fr / 130 three-column row:
- Left: mono index number in accent, mono date in muted.
- Middle: small eyebrow (Essay / Field / Method), then italic serif title.
- Right: "12 min →" in mono, right-aligned.

On hover: row shifts 8px right, arrow turns acid, no other movement. This is the only "fancy" hover on the site.

### Tab (pill segmented control)

Geist Mono uppercase 11px, 0.14em tracking, inside a 999px pill. Active state: acid fill + ink text. Inactive: hairline border, muted text, hairline darkens on hover. Used for chart filters and any place a `<select>` would be tempting.

### Range slider

Custom-styled `<input type="range">`. 4px track in `--line-soft`, 16px acid thumb with a 4px translucent acid ring. Always paired with a mono label above (`Through 2026`) and mono min/max under the track.

### Ticker

A single horizontal strip between `--ink` rules, scrolling left at ~60s loop. All caps Geist Mono in `--muted`, items separated by an acid `·`. Use **once** per page, after the hero. It's the heartbeat.

### Chart

- Single thin stroke (2.4px) in the series color.
- Area fill: gradient of the same color from 32% → 0% alpha, top to bottom.
- 5 horizontal gridlines at 5% white. No vertical gridlines, no axis labels — replace them with the year-range slider.
- One filled dot at the latest data point. No tooltips on hover (this is editorial, not a Bloomberg terminal — though it pretends).
- Title block above the chart: eyebrow + giant mono numeral + unit + tiny mono delta.

---

## 6 · Motion

Three motion primitives, used sparingly:

1. **Live dot pulse** — 1.8s ease-in-out, opacity 1 → 0.35. Only on truly live indicators (current block, "live" pill in nav).
2. **Ticker scroll** — linear, 60s loop. Set-and-forget.
3. **Bar fill** — `transform: scaleX(0 → 1)`, 1.2s with our `--ease`, staggered 80ms per item. Plays once on enter.

Everything else is `transition: <prop> 120ms ease`. Hovers are subtle: an underline appears, a row nudges 8px, an arrow turns acid. No bounces, no scale-on-hover, no parallax.

---

## 7 · Voice (this changes design choices, so it lives here)

The copy is *quietly confident*. Sentences are short, claims are specific, numbers are exact. The site never sells; it reports.

- ✅ "642.18 EH/s. Up 2.4% over 30 days."
- ❌ "Massive growth in network security!"

- ✅ "Reporting from the grid edge."
- ❌ "Discover the future of Bitcoin energy."

- ✅ "Ships Sept 2026"
- ❌ "Coming soon!"

The italic serif word does the emotional lifting so the surrounding sans copy can stay clinical. If a sentence needs an exclamation point to land, the sentence is wrong.

---

## 8 · Imagery

Photography only — no illustration, no 3D, no AI-generated landscapes. Subjects: industrial sites, grids, weather, hands on hardware. Treatment: cool slight-desaturation, deep shadows preserved, never crushed to pure black. Always full-bleed within its container; never floated with text wrapping around it.

If a real photograph isn't available, leave a `<div>` placeholder with a hairline border and a mono caption — explicit absence is better than stock.

---

## 9 · Anti-patterns (the slop list)

These are auto-rejects:

- Gradient backgrounds. Especially purple-to-pink. Especially radial.
- Rounded-corner cards with a 4px left-border accent stripe.
- Glassmorphism / frosted blur on anything except the sticky nav.
- Emoji. The brand has zero emoji. None.
- Lottie animations, animated SVG mascots, illustrated humans.
- Three-up "feature tiles" with an icon + headline + 20 words of copy.
- "Trusted by" logo strips.
- Hero rotators / carousels.
- Drop shadows on cards. The hairline border IS the edge.
- "Get started for free" / "Join 10,000+ users" social proof copy.
- Pure black backgrounds, pure white text. Always `--ink` and `--text`.
- Iconography for the sake of it. If a label is "Hashrate" you do not need a lightning bolt next to it.

---

## 10 · Checklist for any new page

Before shipping, walk through this:

- [ ] Every section has a Geist Mono eyebrow above its headline.
- [ ] Every headline contains exactly one italic serif accent word — or zero, but never two.
- [ ] Every number on the page is in Geist Mono.
- [ ] The accent color (`#D4FF3A`) appears at most once per viewport.
- [ ] Sections are separated by a single 1px hairline, not whitespace alone.
- [ ] No drop shadows, gradients (except chart area fills), or emoji.
- [ ] Buttons are pills (border-radius: 999px). Primary is lime, secondary is outline.
- [ ] At least one mono-numeral stat card or chart appears above the fold.
- [ ] At least one italic Newsreader pull-quote appears in any section >400 words.
- [ ] Hover states are 120ms, single-property, no scale or bounce.
- [ ] `text-wrap: pretty` is set on every headline.

If a page passes all eleven, it's on-system.
