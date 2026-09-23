# Font sources

All fonts in `src/fonts/*.woff2` (excluding the Gotham `.ttf` set, which has a separate licence) are SIL Open Font License (OFL) v1.1.

| Family | Weights | Source |
|---|---|---|
| Fraunces | 400, 600, 800 | Google Fonts (https://fonts.google.com/specimen/Fraunces) |
| Inter | 400, 500, 700 | Google Fonts (https://fonts.google.com/specimen/Inter) |
| Spectral | 400, 500, 700 | Google Fonts (https://fonts.google.com/specimen/Spectral) |
| Frank Ruhl Libre | 700, 900 | Google Fonts (https://fonts.google.com/specimen/Frank+Ruhl+Libre) |
| IBM Plex Sans | 400, 500, 700 | Google Fonts (https://fonts.google.com/specimen/IBM+Plex+Sans) |
| IBM Plex Mono | 500 | Google Fonts (https://fonts.google.com/specimen/IBM+Plex+Mono) |
| Schibsted Grotesk | 400–700 (variable, latin subset) | Google Fonts (https://fonts.google.com/specimen/Schibsted+Grotesk) |
| Geist | 100–900 (variable, latin subset) | npm `@fontsource-variable/geist` 5.3.0, file `geist-latin-wght-normal.woff2` (upstream: https://github.com/vercel/geist-font) |
| Geist Mono | 100–900 (variable, latin subset) | npm `@fontsource-variable/geist-mono` 5.3.0, file `geist-mono-latin-wght-normal.woff2` |
| Newsreader | 200–800, opsz 6–72 (variable, latin subset), roman + italic | npm `@fontsource-variable/newsreader` 5.3.0, files `newsreader-latin-opsz-normal.woff2` and `newsreader-latin-opsz-italic.woff2` (both carry wght and opsz) (upstream: https://fonts.google.com/specimen/Newsreader) |

Fetched 2026-04-27; Schibsted Grotesk fetched 2026-09-20 from
`https://fonts.gstatic.com/s/schibstedgrotesk/v7/Jqz55SSPQuCQF3t8uOwiUL-taUTtap9GayojdSFO.woff2`
(one variable file, both weights). To refresh: re-run the curl block in `docs/superpowers/plans/2026-04-27-theme-system.md` Task 2 Step 1.

Geist, Geist Mono and Newsreader fetched 2026-09-23 for the light/dark redesign,
renamed to `Geist-Variable-latin.woff2`, `GeistMono-Variable-latin.woff2`,
`Newsreader-Variable-latin.woff2` and `Newsreader-Italic-Variable-latin.woff2`.
All OFL 1.1. The latin subset covers every region name (latin-1: `ã é í ø`)
and the `×` and `·` the controls use. SHA-256 as committed:

```
19f9c92546aa300c312235e3125af1b81394d8db9a4bc4a425cd5b641d2d54e1  Geist-Variable-latin.woff2
684ad5b531f81d43c1e8c7038262d5db7cdc1f68006e04d6c7769efa8d33c8cc  GeistMono-Variable-latin.woff2
5dfcd10d24af8c82927ba57f7983dd997f7b200594c09c35a1b1ed9fc4597506  Newsreader-Italic-Variable-latin.woff2
6e4f2958c3a7c4a80acde4e5a679abe7e01bc1e30b92be3c7a8b696ef401d101  Newsreader-Variable-latin.woff2
```

Once the redesign ships, IBM Plex Sans/Mono and Schibsted Grotesk are
referenced by nothing on the dashboard. Fraunces and Inter stay:
`src/embed/globe.md` (the DARI paper figure) sets both. Delete unused faces in
a separate PR after a grep, not in the redesign PRs.

License text: SIL Open Font License v1.1 — https://scripts.sil.org/OFL.

The existing Gotham `.ttf` files (Stacked brand) are NOT covered by OFL and are governed by the parent project's licence; they remain in place during this PR but are no longer referenced once the theme system lands.
