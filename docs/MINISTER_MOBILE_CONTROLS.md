# Minister mobile controls: touch and readability expectations

**Scope:** `site/minister.html` presentation only (issue [#13](https://github.com/cammeleon66/Cammelot/issues/13), L04). No model, clinical or numerical behaviour changes; the model version is unchanged. The pixel-art game shell, named residents and keyboard access are preserved.

## Expectations

| Tier | Controls | Touch target | Label size |
|------|----------|--------------|------------|
| 1 — primary play | Toolbar (`#cbar`), speed/sound, "People to follow" and "Town figures" disclosures, Pause/Council buttons, council banner and return, wizard Back/Next, council options, law/funding buttons, dossier "← Ministry", opening and ending buttons | at least 44 × 44 CSS px (width may be larger) | at least 10 px computed (enforced by the browser test); pixel-font labels are not smaller than 10 px |
| 2 — site chrome | "Back to Cammelot", "About", theme toggle | at least 24 × 24 CSS px (WCAG 2.2 SC 2.5.8) | 11 px or more |

Layout expectations at 375, 390 and 412 px portrait and short landscape (the `(max-height: 500px) and (orientation: landscape)` breakpoint, e.g. 667 × 375 and 844 × 390):

- The document, header and panels do not scroll or clip horizontally.
- Every tier 1 control can be scrolled fully into view and is not covered by another element.
- Disclosures show their state: a pixel chevron plus a SHOW/HIDE chip, not only a text label. They remain native `<details>`/`<summary>`, so Enter and Space toggle them.
- While the council is hidden by "Inspect town", a "Return to council" banner stays on the map, whether or not the people list is open or a dossier is shown. The dossier's "← Ministry" control is a keyboard-operable button.
- Short landscape uses a side-by-side map and panel and the compact phone header, so the map, controls and council remain usable at about 375 px of height.

Known tier 2 exceptions: the opening screen's secondary disclosure links ("Why this game?", "Research context", "Replay a complete command record") are text links below 44 px; they are not required for play.

## Automated coverage

`tests/minister_browser.test.js` → "L04 mobile controls …" drives a full run (opening, town, disclosures, council, inspect, funding, ending) in Chromium mobile emulation with touch at 375×667, 390×844, 412×915, 667×375 and 844×390. It checks size, font, viewport containment, hit-testing and horizontal overflow. Leaderboard reads are stubbed and writes are refused, so nothing is published.

## Before/after browser screenshots

Captured in Chromium at 375×667 and 768×1024 with the cabinet-crisis scenario, seed 2468. Before images use `master` at `f0c86dc`; after images show the updated branch with the inspector return banner.

| Viewport | Before | After |
|----------|--------|-------|
| 375 × 667 | [Screenshot](screenshots/minister-mobile-before-375.png) | [Screenshot](screenshots/minister-mobile-after-375.png) |
| 768 × 1024 | [Screenshot](screenshots/minister-mobile-before-768.png) | [Screenshot](screenshots/minister-mobile-after-768.png) |

## What emulation does not prove

Chromium emulation checks layout, CSS sizing and tap dispatch. It does not prove dynamic browser toolbars, safe-area notches, on-screen keyboards, real touch accuracy, font rendering, performance or audio policy on devices. Record the following on physical hardware as part of release validation (see [release status](MINISTER_RELEASE_STATUS.md#human-validation)):

- [ ] Android Chrome and iPhone Safari, portrait and landscape: device, OS and browser versions noted.
- [ ] One-handed taps on the toolbar, speed/sound, "People to follow", "Town figures", "Return to council" and wizard Next without mis-taps.
- [ ] "People to follow" and "Town figures" are recognisable as expandable without prompting.
- [ ] Council, funding, inspection and ending reachable in both orientations, with no horizontal scroll, after rotating mid-council.
