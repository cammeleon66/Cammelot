# Minister of Cammelot — release status

Updated: 2026-09-17
Public game: https://cammelot.org/minister.html
Model: `minister-care-3-paired`
Reference protocol: `no-discretionary-action-v1`

This is the canonical status list. Older plans describe how the current release was built; their unchecked boxes are not active tasks.

## Live and verified

- [x] Two public modes: Cabinet Crisis and The Full Term.
- [x] Fixed logical simulation independent of rendering, speed and reading time.
- [x] Hard pause at quarter boundaries with a prominent Council ready action.
- [x] Fixed 12-week model norm separated from specialist treatment capacity.
- [x] Referral episodes record waiting, treatment, death before treatment, relocation and other exits.
- [x] Same-seed, same-date no-discretionary-action reference with exact-tick snapshots.
- [x] Signed care differences; political and care verdicts are separate.
- [x] Same-town replay through Try another approach.
- [x] Compact mobile KPI dashboard and simplified Ministry-first panel.
- [x] Followed residents and clinicians show current context, thoughts and recorded care history.
- [x] Road-safe citizen movement with no blocked route nodes or teleport fallback.
- [x] Town requests pause without a timer and show the immediate modeled effect before closing.
- [x] Continuous soundtrack through gameplay and councils; Android unmute starts media in the tap gesture.
- [x] Public player-name entry with five random-name styles.
- [x] Care-first, same-seed community leaderboard labeled as unverified submissions.
- [x] Azure App Service backend with HTTPS, exact-origin CORS and persistent `/home` storage.
- [x] Managed-identity ACR pull; no registry password enabled.
- [x] Production submit, restart, read, backup and test-entry removal proven.
- [x] Offline moderation command creates a backup before removal.
- [x] Superseded Azure experiments and identities removed.
- [x] GitHub Pages and CI deployment workflow operational.
- [x] Automated desktop and emulated mobile regression coverage; repository suite passed with 155 tests on the main release checkpoint.

## Remaining agent work

These improve evidence and quality; they do not mean the currently deployed game or leaderboard is offline.

- [x] Complete the active-copy pass: council newspaper, escalation banners, aging/flu updates and confidence-vote choices now report actual mechanics without invented testimonials or moralizing verdicts.
- [ ] Complete balance validation: the 20-seed purchase × response development matrix is done; diagnose why 0/400 automated policies pass the final vote, make only justified corrections, then validate on holdout seeds.
- [ ] Audit the legacy emergency-care bypass against the routine staffed-capacity model.

## Human validation

These require people or physical devices and cannot be honestly checked by automation.

- [ ] Test the latest build on physical Android Chrome and iPhone Safari in portrait and landscape, including sound and end-screen publishing; record devices, OS and browser versions.
- [ ] Complete five uncoached playtests; at least four players should explain the target, one followed person, one trade-off, political versus care outcome and a replay choice.
- [ ] Include one healthcare-domain reviewer for the system-death classification, deterioration assumptions and emergency-capacity model.
- [ ] Assign an operational owner and retention period for production leaderboard backups.

## Deliberate limitations

- Community submissions are not server-replayed and remain explicitly labeled unverified.
- A single run is an illustration, not causal or statistical evidence.
- The playable engine uses 45 named residents scaled to a town of 5,000.
- `model-classified system deaths` remains cautious terminology pending domain review.
- The scalar score is secondary; leaderboard order prioritizes care outcomes.

## Next action

Run the twenty-seed benchmark while physical-device and human playtests proceed in parallel.
