# Font sources

All fonts in `src/fonts/` are SIL Open Font License (OFL) v1.1.

| Family | Weights | Source |
|---|---|---|
| Fraunces | 400, 600, 800 | Google Fonts (https://fonts.google.com/specimen/Fraunces) |
| Inter | 400, 500, 700 | Google Fonts (https://fonts.google.com/specimen/Inter) |
| IBM Plex Mono | 500 | Google Fonts (https://fonts.google.com/specimen/IBM+Plex+Mono) |
| Schibsted Grotesk | 400–900 (variable, latin subset) | Google Fonts (https://fonts.google.com/specimen/Schibsted+Grotesk) |

Fraunces and Inter fetched 2026-04-27. To refresh: re-run the curl block in `docs/superpowers/plans/archive/2026-04-27-theme-system.md` Task 2 Step 1.

Schibsted Grotesk and IBM Plex Mono are the brand system's faces and set
both modes. Schibsted Grotesk was fetched 2026-09-20 as
[one variable file from Google Fonts' v7 release](https://fonts.gstatic.com/s/schibstedgrotesk/v7/Jqz55SSPQuCQF3t8uOwiUL-taUTtap9GayojdSFO.woff2);
IBM Plex Mono 500 was fetched 2026-04-27. The redesign's
clean-up deleted both; they were restored byte-for-byte from git on
2026-09-24, when the modes moved back to them. SHA-256 as committed:

```
01d285447409c8a588692162439a038b8cbd7871309ee20267b0d2d91c6e8e22  IBMPlexMono-Medium.woff2
e3b56e90510a84ac0ed465b822e112983eaf58e37436bf769681c31f77b1f3a7  SchibstedGrotesk-Variable.woff2
```

The same change deleted Geist, Geist Mono and Newsreader (fetched 2026-09-23
for the light/dark redesign), which nothing loads any more.

Fraunces and Inter are the paper figure's faces: `src/embed/globe.md` (the
DARI paper figure) sets both, and no other page loads them. The redesign's
clean-up (2026-09-24) deleted the faces nothing loaded any more, after a
check of what each page actually loads: IBM Plex Sans, and the Gotham
`.ttf` set (which had its own licence). It also deleted IBM Plex Mono and
Schibsted Grotesk, which are back (above).

License text: SIL Open Font License v1.1 — https://scripts.sil.org/OFL.

