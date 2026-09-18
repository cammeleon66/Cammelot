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

Follow the improvement plan below while physical-device and human playtests proceed in parallel.

## Improvement plan

### 1. Make the balance experiment complete

The 20-seed purchase × response matrix is valid for those two dimensions, but it enacts no laws. It cannot establish that Cabinet Crisis is unwinnable.

- Add a separate governance policy: no laws, parliament-first laws, care-bottleneck laws and resilience-first laws.
- Keep purchase, response and governance policies independent in output.
- Retry wishlist purchases at later councils when they are temporarily unavailable instead of discarding them permanently.
- Record every ending tick, final-vote reason, trust delta source, law, purchase, response and cascade stage.
- Add parser tests for representative option text so trust/budget/care heuristics select what their names claim.

**Exit:** sampled traces reconstruct every trust and budget change; policies actually enact distinct laws and purchases.

### 2. Prove Cabinet Crisis has a legitimate winning path

- Build one documented survival policy using only information visible to a player; no direct state mutation or hidden future knowledge.
- Run it through the real UI on fixed development seeds.
- Identify which condition blocks a win: parliament, citizen trust, doctor trust, death cap or cascade.
- Check whether a player can discover the required actions from previews and target cards.

**Exit:** at least one reproducible, non-cheating path passes the final vote. If none exists after laws are included, treat that as a model defect.

### 3. Correct political balance at its source

Do not lower every target or add arbitrary bonuses. Use the trust ledger from steps 1–2.

- Fix contradictory, duplicated or unavoidable parliament penalties first.
- Align option previews with the trust changes they actually apply.
- If the 40-point threshold remains unreachable under coherent play, adjust the smallest responsible penalty/gain or threshold and document why.
- Keep mortality, care capacity and the paired reference unchanged unless a separate clinical defect is found.
- Ensure no single law or purchase becomes a mandatory obvious answer.

**Exit:** multiple coherent strategies can reach the final vote, but none is uniformly best on care, politics and cost.

### 4. Revalidate without tuning to the test seeds

- Rerun the 20 development seeds after the justified correction.
- Freeze parameters, then run a separate holdout set not used during correction.
- Report medians, ranges, ending ticks, final-vote criteria and paired care differences.
- Continue ranking community scores by same-seed care outcomes, not scalar score.

**Exit:** the winning path remains feasible on holdout seeds; worse care is not rewarded merely by a higher score.

### 5. Audit the remaining care-model risk

- Trace emergency admissions through the legacy bypass and routine staffed-capacity paths.
- Define when emergency care may bypass the routine queue and what capacity it still consumes.
- Add fixtures for simultaneous emergency and routine demand.
- Retain cautious `model-classified system deaths` language until domain review.

**Exit:** emergency priority cannot create unlimited hospital throughput or silently displace routine care without being measured.

### 6. Human release gates

- Test the latest build on physical Android Chrome and iPhone Safari.
- Run five uncoached playtests, including one healthcare-domain reviewer.
- Require players to explain the target, a followed person, a trade-off, political versus care outcome and what they would change on replay.
- Resolve comprehension blockers before adding scenarios or mechanics.

**Exit:** four of five players complete and explain the loop without coaching; no physical-device blocker remains.
