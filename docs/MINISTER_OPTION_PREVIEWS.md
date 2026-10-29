# Minister option previews — B02

Scope: issue [#53](https://github.com/cammeleon66/Cammelot/issues/53), PR
[#58](https://github.com/cammeleon66/Cammelot/pull/58), baseline
`729a2c815c410fec0164721216d438e0980ab307` (B01 base `42f2904`).
These are authored game rules and software checks, not clinical validation or
evidence that a policy improves health. The [model contract](MINISTER_MODEL_CONTRACT.md),
[claim sources](MINISTER_CLAIM_SOURCES.md), and
[reference protocol](MINISTER_REFERENCE_PROTOCOL.md) still apply.

## Inventory and application paths

The exhaustive gate pins **137 stable IDs**: 18 purchases, 9 laws, 66 dilemma
responses (29 dilemmas), 16 event responses (7 events), 16 resident-request
responses (8 requests), 4 named-resident/accountability beat responses,
3 confidence-vote responses, and 5 manifesto promises.

Both scenario catalogs are checked independently. Cabinet Crisis does not offer
manifesto selection: those five entries are explicitly verified absent, not
silently treated as clicks. Full Term uses the real manifesto buttons. The six
responses of the disabled legacy event families remain inventoried and are
exercised as real council choices in fixtures, without enabling them in play.

The table below retains **baseline copy**, not new copy. Explicit `fx` values are
authored data; dynamic plans/callbacks are resolved and measured by the browser
trace. The machine-readable evidence retains independent before/after state and
the B01 write-interception trust/budget ledger per action. IDs use catalog IDs and
original slot/index; labels are never identifiers.

## Single source of truth

`previewOption` projects `choicePlans`, `shopPlan`, or the direct request/vote
data consumed by the real handler. No preview invokes an outcome callback or
draws RNG. Immediate chips show current-state deltas and before/after values,
including effective adoption scaling, two-stage trust clamps, zero floors, and
ceilings. Costs include hiring increments, co-funding withdrawal, and FastTrack
integration debt. Temporary inverses, delayed deliveries, stochastic branches,
access commands, and other conditional consequences are separate lines.

Care validation includes existing schedules; an infeasible care or funded plan
is unavailable, not a secretly clamped effect. The confidence-vote budget return
is explicitly different: its original handler permits a deficit. Promises change
no immediate trust/budget/care state and are judged with aggregate election gates.
Trust, money and care use the existing pixel icons and green/red/gold chips;
words and numbers carry the meaning without relying on color.

## Text/application disagreements corrected

- Ransomware's old notes omitted citizen/parliament/doctor effects and permanent
  capacity loss. Both security/dependence-sensitive plans are now displayed.
- Flash requests previously showed little beyond labels and price. Score-only
  actions, health ceilings, all-trust clamps and both random outcomes are explicit.
- The in-house build claimed eighteen months but schedules **eight quarters**.
  The startup purchase claimed an annual cost but charges once. Only option
  descriptions changed; historical receipt labels and effects remain unchanged.
- Platform copy advertised an unconditional paperwork reduction and silo drop;
  actual low-adoption paperwork and the zero silo floor are now shown.
- Law previews now include their treasury charge, irreversible status, and
  digital-access beat rather than only the `fx` object.
- Confidence-vote failure can settle the current objective before ending;
  this score-only consequence is included, not mistaken for a care improvement.

## B03 inputs — observed rules, deliberately unchanged

1. A death can reduce trust in engine death handling **and** in quarterly council
   dynamics; live-score/death and election gates also account for it. Inspect
   compounding, rather than assuming each ledger entry is an accidental duplicate.
2. Low doctor trust can combine conditional work-to-rule absence, a temporary
   strike, continuing-strike increments, and the exodus cascade. A strike dilemma
   can additionally schedule doctor trust loss four ticks later.
3. Low citizen trust can combine care avoidance, repeated household relocation
   cash/parliament losses, and eventual protest termination.
4. Parliament below 35 raises purchase prices; question hour below 55 subtracts
   trust; deficit and no-law-in-act penalties can accumulate. The confidence
   recovery plan adds trust now and subtracts more later regardless of recovery.
5. Digital rollout adds temporary admin and persistent GP burnout; crossing the
   silo threshold adds another temporary admin cost. Fragmentation, dependence,
   adoption, and historical exclusion may each also reduce final score.
6. FastTrack grants immediate parliament trust while adding silos and a later
   integration surcharge. Rejecting it changes dividend **eligibility**, not a
   guaranteed event date.
7. An exclusion is historical and score-penalized even with no active referral;
   manual release/Officer mitigation does not erase the decision. Repeated holds
   accumulate. This is not a new death or a fixed mortality penalty.
8. “Return the budget reserve” can spend below zero, unlike funded council
   choices. That inconsistency is exposed, not repaired in B02.

## Reference identity and validation

Baseline full-horizon serialized reference bytes were captured **before the first
HTML edit**, using seed 2468 and `git show 729a2c8:site/minister.html` served locally:

| Scenario | Ticks | Bytes | SHA-256 |
|---|---:|---:|---|
| Cabinet Crisis | 416 | 556914 | `bcb84cbe10d07e98029c78c32322bd02253e5e5423d254f0235fcb782933007b` |
| Full Term | 2080 | 2756109 | `f6ef76684ae9e290087c3dc7a195bca3e110eb6e81e10521529030c85c1250f4` |

The payload includes every tick snapshot, final care state, environmental
schedule/log, and compact resident clinical state. The runner compares the
original and current serialized strings, not just rounded metrics.

Validation results and screenshots will be recorded after execution. No physical
device or human playtest is implied. All browser fixtures block non-GET/HEAD
requests **before navigation**, stub external reads, and serve only loopback
GET/HEAD. No production leaderboard writes are permitted.

## Baseline option table

| Stable ID | Baseline label / effect text | Applied data / real path |
|---|---|---|
| `purchase:scribes1` | 🎙 EchoScribe pilot — Documentation support. Benefit depends on staff adoption; adds digital dependence. | {"admin":-0.18,"dep":2}; shopPlan → buy |
| `purchase:scribes2` | 🎙 EchoScribe full rollout — Extend documentation support. Adoption limits the immediate benefit; adds dependence. | {"admin":-0.07,"ai":0.1,"dep":1}; shopPlan → buy |
| `purchase:hire` | 🩺 Recruit specialists — Adds 1 nominal routine start/week and corresponding routine treatment places. Active next tick; actual starts need demand and credit. No GP productivity change. Later hires cost more. | {"capacity":1,"trustD":3}; shopPlan → buy |
| `purchase:a2a` | 🔗 Referral mesh — Referral scheduling adds 1.5 treatment starts/week at full adoption. Requires scribe rollout; adds digital dependence. | {"capacity":1.5,"dep":3}; shopPlan → buy |
| `purchase:twin` | 🪞 Mirrorware digital twins — Monitoring reduces modeled deterioration, scaled by staff adoption. Adds dependence. | {"drainMult":0.85,"dep":3}; shopPlan → buy |
| `purchase:mtvp` | ⏳ More Time for the Patient — Modeled deterioration ×0.90. Citizen trust +2; doctor trust +3. | {"drainMult":0.9,"trustC":2,"trustD":3}; shopPlan → buy |
| `purchase:audit` | ⚖ Fairness audit — Independent triage review. Parliament trust +5. Maximum three. | {"trustP":5}; shopPlan → buy |
| `purchase:prevention` | 🥦 Prevention programme — Halves annual aging-pressure growth and reduces scheduled flu impact. No immediate capacity gain. | {"trustC":2}; shopPlan → buy |
| `purchase:resilience` | 🔋 Resilience pack — Backup power and offline procedures. Dependence -2; reduces modeled shock impact. Maximum two. | {"dep":-2}; shopPlan → buy |
| `purchase:security` | 🛡 Security hardening — Vendor audit and network segmentation. Dependence -1; all trust +1. | {"dep":-1,"trust":1}; shopPlan → buy |
| `purchase:campaign` | 📣 Public Awareness Campaign — Public information campaign. Citizen trust +6. No clinical capacity change. Maximum two. | {"trustC":6}; shopPlan → buy |
| `purchase:gpfund` | 🩺 GP Retention Fund — Retention payment for GP teams. Doctor trust +8; sick leave -1 percentage point. | {"trustD":8,"sick":-0.01}; shopPlan → buy |
| `purchase:pilotgrant` | 📄 AI Pilot Grant — Standalone pilot: 2 silos and up to 4 parliament trust on first purchase. No direct clinical benefit; low-adoption rollout and silo thresholds can add temporary GP paperwork and burnout. | {"trustP":4,"frag":2}; shopPlan → buy |
| `purchase:platform` | 🏗 Health Data Platform — Shared data layer. Paperwork -5 points; silos -3; platform +1. Requires the scribe pilot. | {"admin":-0.05,"frag":-3,"platform":1}; shopPlan → buy |
| `purchase:platformai` | 🤖 Platform AI Applications — Shared-data applications reduce modeled paperwork and deterioration. Benefit depends on adoption. | {"admin":-0.1,"drainMult":0.9,"trustD":3}; shopPlan → buy |
| `purchase:changeprog` | 📊 Change Management Programme — Training and workflow redesign. Adoption +15 points; doctor trust +3. Maximum two. | {"trustD":3}; shopPlan → buy |
| `purchase:inclofficer` | 🤝 Digital Inclusion Officer — Citizen trust +3; releases current access holds and stops recurring exclusion. Requires AI Triage Gate. | {"trustC":3}; shopPlan → buy |
| `purchase:carersupport` | 🫂 Carer Support Programme — Respite support for informal carers. Carer pressure -15; citizen trust +2. Maximum two. | {"trustC":2,"mantelzorg":-15}; shopPlan → buy |
| `law:dig1` | Cloud-First Records Act — All records move to Halcyon One. Admin -2%, +1 dependence. Irreversible. | {"admin":-0.02,"dep":1}; projectCarePlan → law click |
| `law:dig2` | AI Triage Gate — Authored scheduling rule: +0.5 nominal routine starts/week, +2 dependence, Trust -2. Not a GP request-screening mechanism. Irreversible. | {"capacity":0.5,"dep":2,"trust":-2}; projectCarePlan → law click |
| `law:dig3` | AI-Gated Specialist Access — Algorithm required for referral. +1 treatment start/week, +2 dependence. Risks digital exclusion. Irreversible. | {"capacity":1,"dep":2}; projectCarePlan → law click |
| `law:work1` | Task Differentiation Act — Nurses and assistants take over routine GP tasks. Admin -3%. Irreversible. | {"admin":-0.03}; projectCarePlan → law click |
| `law:work2` | Regional Staffing Pool — Shared locum pool across the region. Sick leave -1%. Irreversible. | {"sick":-0.01}; projectCarePlan → law click |
| `law:work3` | Community Health Workers — Neighbourhood teams reach citizens before crisis. Drain -8%, Trust +2. Irreversible. | {"drainMult":0.92,"trust":2}; projectCarePlan → law click |
| `law:inno1` | Open Algorithm Register — All health algorithms used in Cammelot must be publicly registered. Parliament +3. Fragmentation -1 (visibility forces consolidation). Irreversible. | {"trustP":3,"frag":-1}; projectCarePlan → law click |
| `law:inno2` | Platform-First Procurement Mandate — Requires data interoperability for new health AI. Fragmentation -2; Parliament +2. Irreversible. | {"frag":-2,"trustP":2}; projectCarePlan → law click |
| `law:inno3` | Regional AI Adoption Board — Joint board of GPs, data scientists, and patient reps evaluates all health AI before deployment. Parliament +3, Doctors +2. Irreversible. | {"trustP":3,"trustD":2}; projectCarePlan → law click |
| `dilemma:insurer:a` | Take the deal — +€60K · Citizens -8 · Doctors -4 · +1 dependence | {"budget":60000,"trustC":-8,"trustD":-4,"dep":1}; choicePlan → applyChoice |
| `dilemma:insurer:b` | Decline: patient data is not a bargaining chip — Citizens +3 · Doctors +2 | {"trustC":3,"trustD":2}; choicePlan → applyChoice |
| `dilemma:assistant:a` | Fund the assistant — -€15K · admin -2% | {"budget":-15000,"admin":-0.02}; choicePlan → applyChoice |
| `dilemma:assistant:b` | Decline — All trust -3 | {"trust":-3}; choicePlan → applyChoice |
| `dilemma:press:a` | Face the press — Trust +5 if few model system deaths, else -5 | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `dilemma:press:b` | No comment — Trust -3 | {"trust":-3}; choicePlan → applyChoice |
| `dilemma:flu:a` | Fund the campaign — -€20K · drain -5% | {"budget":-20000,"drainMult":0.95}; choicePlan → applyChoice |
| `dilemma:flu:b` | Skip it this year — Staff sick leave +1% | {"sick":0.01}; choicePlan → applyChoice |
| `dilemma:locum:a` | Hire the locums — -€25K · +0.5 starts/week | {"budget":-25000,"capacity":0.5}; choicePlan → applyChoice |
| `dilemma:locum:b` | Hold out for permanent staff — No change | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `dilemma:overtime:a` | Pay overtime — -€30K · sick leave -2% · Doctors +6 · Parliament -2 | {"budget":-30000,"sick":-0.02,"trustD":6,"trustP":-2}; choicePlan → applyChoice |
| `dilemma:overtime:b` | Refuse — Sick leave +2 points · Doctors -7 | {"sick":0.02,"trustD":-7}; choicePlan → applyChoice |
| `dilemma:subsidy:a` | Accept the subsidy — +€80K · +2 dependence · Trust -2 | {"budget":80000,"dep":2,"trust":-2}; choicePlan → applyChoice |
| `dilemma:subsidy:b` | Decline — All trust +1 | {"trust":1}; choicePlan → applyChoice |
| `dilemma:bus:a` | Fund the bus — -€15K · Trust +4 · drain -5% | {"budget":-15000,"trust":4,"drainMult":0.95}; choicePlan → applyChoice |
| `dilemma:bus:b` | Decline politely — Trust -2 | {"trust":-2}; choicePlan → applyChoice |
| `dilemma:merger:a` | Merge night services — +0.5 starts/week · Trust -4 | {"capacity":0.5,"trust":-4}; choicePlan → applyChoice |
| `dilemma:merger:b` | Keep care close to home — Trust +2 · sick leave +1% | {"trust":2,"sick":0.01}; choicePlan → applyChoice |
| `dilemma:cyberins:a` | Take the policy — -€20K · -1 dependence | {"budget":-20000,"dep":-1}; choicePlan → applyChoice |
| `dilemma:cyberins:b` | Self-insure — No immediate change | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `dilemma:shortage:a` | Pay for imports — -€25K · Citizens +4 | {"budget":-25000,"trustC":4}; choicePlan → applyChoice |
| `dilemma:shortage:b` | Substitute generics — Citizens -3 · modeled deterioration ×1.03 | {"trustC":-3,"drainMult":1.03}; choicePlan → applyChoice |
| `dilemma:seh:a` | Accept the closure — +€30K savings · Citizens -7 · Parliament +2 | {"budget":30000,"trustC":-7,"trustP":2}; choicePlan → applyChoice |
| `dilemma:seh:b` | Subsidise it to stay open — -€35K · Citizens +5 | {"budget":-35000,"trustC":5}; choicePlan → applyChoice |
| `dilemma:algo:a` | Deploy with public audit board — -€15K · +0.5 starts/week · +1 dep · Citizens +2 | {"budget":-15000,"capacity":0.5,"dep":1,"trustC":2}; choicePlan → applyChoice |
| `dilemma:algo:b` | Deploy fast, audit later — +0.5 starts/week · +1 dep · 40% chance of a bias scandal | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `dilemma:grid:a` | Run the generators — Citizens -4 · Dependence +1 | {"trustC":-4,"dep":1}; choicePlan → applyChoice |
| `dilemma:grid:b` | Delay the data centre — AI capacity multiplier -0.03 | {"ai":-0.03}; choicePlan → applyChoice |
| `dilemma:verpleeghuis:a` | Fund respite care beds — -€30K · Citizens +6 · drain -3% | {"budget":-30000,"trustC":6,"drainMult":0.97}; choicePlan → applyChoice |
| `dilemma:verpleeghuis:b` | Prioritise the GP system first — Citizens -4 | {"trustC":-4}; choicePlan → applyChoice |
| `dilemma:poach:a` | Match with a retention bonus — -€40K · Doctors +6 · sick -1% | {"budget":-40000,"trustD":6,"sick":-0.01}; choicePlan → applyChoice |
| `dilemma:poach:b` | Let the market decide — Doctors -6 · sick +1.5% | {"trustD":-6,"sick":0.015}; choicePlan → applyChoice |
| `dilemma:digibeten:a` | Keep a staffed phone line — -€12K · admin +1% · Citizens +5 | {"budget":-12000,"admin":0.01,"trustC":5}; choicePlan → applyChoice |
| `dilemma:digibeten:b` | Digital-only, with a helpdesk leaflet — Citizens -6 · admin -1% | {"trustC":-6,"admin":-0.01}; choicePlan → applyChoice |
| `dilemma:interop:a` | Connect the systems — +0.5 starts/week · +1 dep · Doctors +3 | {"capacity":0.5,"dep":1,"trustD":3}; choicePlan → applyChoice |
| `dilemma:interop:b` | Demand a security audit first — -€10K · connection delayed but safe | {"budget":-10000}; choicePlan → applyChoice |
| `dilemma:sugarlobby:a` | Endorse the sugar tax — Parliament +3 · Citizens -2 · drain -3% long-term | {"trustP":3,"trustC":-2,"drainMult":0.97}; choicePlan → applyChoice |
| `dilemma:sugarlobby:b` | Stay neutral, protect jobs — Citizens +2 · Parliament -2 | {"trustC":2,"trustP":-2}; choicePlan → applyChoice |
| `dilemma:sabbatical:a` | Grant it, hire a locum — -€20K · Doctors +5 · sick -1% | {"budget":-20000,"trustD":5,"sick":-0.01}; choicePlan → applyChoice |
| `dilemma:sabbatical:b` | Ask them to push through — Doctors -3 · 35% risk of a burnout wave | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `dilemma:mivd:a` | Quiet patch + silence — Dependence -1 · Parliament +3 · citizens suspicious | {"dep":-1,"trustP":3}; choicePlan → applyChoice |
| `dilemma:mivd:b` | Go public, full transparency — Citizens +5 · Parliament -4 · attackers now know you know (+1 dep) | {"trustC":5,"trustP":-4,"dep":1}; choicePlan → applyChoice |
| `dilemma:longcovid:a` | Open a dedicated Long COVID clinic — -€70K · Citizens +6 · Doctors +3 · sick -0.8% | {"budget":-70000,"trustC":6,"trustD":3,"sick":-0.008}; choicePlan → applyChoice |
| `dilemma:longcovid:b` | Route them through existing GPs — Citizens -4 · Doctors -3 (overloaded) · sick +1% | {"trustC":-4,"trustD":-3,"sick":0.01}; choicePlan → applyChoice |
| `dilemma:longcovid:c` | Commission a national research study first — Citizens -2 (delay) · Parliament +2 (responsible) | {"trustC":-2,"trustP":2}; choicePlan → applyChoice |
| `dilemma:refugees:a` | Extra subsidy per registration — -€40K · Doctors +4 · Citizens +3 · slight demand rise | {"budget":-40000,"trustD":4,"trustC":3,"sick":0.005}; choicePlan → applyChoice |
| `dilemma:refugees:b` | Mandatory intake, no extra funding — Doctors -5 (furious) · Citizens +2 (solidarity) | {"trustD":-5,"trustC":2}; choicePlan → applyChoice |
| `dilemma:refugees:c` | Refer to regional asylum health service — Cammelot off the hook · Citizens -3 · Parliament +2 | {"trustC":-3,"trustP":2}; choicePlan → applyChoice |
| `dilemma:nzatariff:a` | Top up the full 40% — -€55K · Doctors +5 · Saturday access maintained | {"budget":-55000,"trustD":5}; choicePlan → applyChoice |
| `dilemma:nzatariff:b` | Offer 20%, negotiate the rest — 50/50: deal at -€28K (Doctors +2) or capacity -0.5/week, Doctors -4 | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `dilemma:nzatariff:c` | Reject: not a municipal responsibility — Doctors -6 · Parliament +3 (fiscal discipline) | {"trustD":-6,"trustP":3}; choicePlan → applyChoice |
| `dilemma:gpstrike:a` | Emergency mediator, grant a 10% bonus — -€45K · Doctors +8 · Citizens +2 · sick -1% | {"budget":-45000,"trustD":8,"trustC":2,"sick":-0.01}; choicePlan → applyChoice |
| `dilemma:gpstrike:b` | Publicly condemn the strike — Doctors -10 · Citizens -3 · Parliament +4 | {"trustD":-10,"trustC":-3,"trustP":4}; choicePlan → applyChoice |
| `dilemma:gpstrike:c` | Let it run, wait them out — Sick +2% (ongoing) · Citizens -5 · Doctors -6 after 1 model week (4 ticks); canceled if term ends first | {"sick":0.02,"trustC":-5}; choicePlan → applyChoice |
| `dilemma:mantelzorg:a` | Formalise: pay informal carers a stipend — -€25K · Citizens +5 · Carer pressure -10 | {"budget":-25000,"trustC":5,"mantelzorg":-10}; choicePlan → applyChoice |
| `dilemma:mantelzorg:b` | Redirect to community networks (neighbours, faith groups) — Carer pressure +10 · Citizens -3 (feel abandoned) | {"mantelzorg":10,"trustC":-3}; choicePlan → applyChoice |
| `dilemma:mantelzorg:c` | Pilot: respite care slots within existing budget — -€12K · Doctors +2 · Citizens +3 · Carer pressure -5 | {"budget":-12000,"trustD":2,"trustC":3,"mantelzorg":-5}; choicePlan → applyChoice |
| `dilemma:buildorbuy:a` | Buy the startup tool, deploy fast — -€40K/yr · Parliament +3 (decisive) · Fragmentation +2 | {"budget":-40000,"trustP":3,"frag":2}; choicePlan → applyChoice |
| `dilemma:buildorbuy:b` | Build in-house, own the data — -€70K · Doctors +2 now · 18-month delay then: Doctors +3, Admin -3% | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `dilemma:buildorbuy:c` | Require platform-first: no tool without shared data access — If platform built: Frag -1, Doctors +3, -€40K · If no platform: Parliament -2 | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `dilemma:phddata:a` | Grant full access — science matters — Parliament +3 (open science) · Fragmentation +1 (another external data consumer) | {"trustP":3,"frag":1}; choicePlan → applyChoice |
| `dilemma:phddata:b` | Refuse — patient data stays local — Parliament -3 · Citizens +2 (trust their data stays private) | {"trustP":-3,"trustC":2}; choicePlan → applyChoice |
| `dilemma:phddata:c` | Grant access only via federated query — data stays, insights travel — If platform: Parliament +4, Doctors +2 · If no platform: Parliament -1 | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `dilemma:aistartup:a` | Yes — innovation needs pilots — +€20K · Parliament +2 · Fragmentation +2 (vendor-owned data silo) | {"budget":20000,"trustP":2,"frag":2}; choicePlan → applyChoice |
| `dilemma:aistartup:b` | No — patient data leaving Cammelot is unacceptable — Citizens +3 (data protection) · Parliament -2 (blocking innovation) | {"trustC":3,"trustP":-2}; choicePlan → applyChoice |
| `dilemma:aistartup:c` | Yes, if data residency is Cammelot-controlled — If platform: +€20K, Doctors +2, Frag +1 (managed) · If no platform: Parliament -2 | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `event:lockstep:0` | Negotiate quietly — -€50K · Parliament -8 (secrecy) · disruption scales with your dependence | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `event:lockstep:1` | Refuse and disclose everything — Citizens -8 now, +6 later (honesty) · longer disruption · doctors respect it | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `event:codeblack:0` | Push the staff harder — Sick leave +3% for 2 quarters · Doctors -6 | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `event:codeblack:1` | Transfer patients across the region — Drain +15% for a quarter · Citizens -4 | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `event:meds:0` | Therapeutic substitution — GPs spend time switching medication: admin +3% for a quarter | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `event:meds:1` | Emergency import — -€20K | {"budget":-20000}; choicePlan → applyChoice |
| `event:meds:2` | Rationing protocol — Trust -5 | {"trust":-5}; choicePlan → applyChoice |
| `event:gemeenteraad:0` | Full accountability session — open the books — Parliament +6 · Citizens +2 · signals transparency | {"trustP":6,"trustC":2}; choicePlan → applyChoice |
| `event:gemeenteraad:1` | Defend the record, deflect the questions — Parliament −2 · opposition grows louder | {"trustP":-2}; choicePlan → applyChoice |
| `event:algodubbelop:0` | Halt the new tool, mandate integration — Fragmentation -1 · Parliament +2 | {"frag":-1,"trustP":2}; choicePlan → applyChoice |
| `event:algodubbelop:1` | Let both run — clinical choice is valuable — Fragmentation +1 · Admin +2% | {"frag":1,"admin":0.02}; choicePlan → applyChoice |
| `event:researchgrant:0` | Quick AI pilot: early sepsis detection — +€30K · Fragmentation +2 · Parliament +3 | {"budget":30000,"frag":2,"trustP":3}; choicePlan → applyChoice |
| `event:researchgrant:1` | Platform investment: shared data infrastructure — +€80K · Platform +1 · Fragmentation -2 | {"budget":80000,"platform":1,"frag":-2}; choicePlan → applyChoice |
| `event:researchgrant:2` | GP recruitment and retention — +€80K · Doctors +5 · +0.5 treatment starts/week | {"budget":80000,"trustD":5,"capacity":0.5}; choicePlan → applyChoice |
| `event:fasttrack:0` | Take the deal — Parliament +6 · Fragmentation +2 · Platform AI costs +50% later | {"trustP":6,"frag":2}; choicePlan → applyChoice |
| `event:fasttrack:1` | Not now. Stay the course. — Nothing now · Platform dividend fires 2 quarters earlier | Dynamic plan / conditional / callback; see measured trace; choicePlan → applyChoice |
| `request:0:a` | Assign case manager (−€5K) — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:0:b` | Keep normal queue — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:1:a` | Switch to paper — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:1:b` | Continue digitally — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:2:a` | Fund insurance (−€3K) — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:2:b` | Decline — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:3:a` | Emergency courier (−€4K) — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:3:b` | Wait for national supply — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:4:a` | Confirm the review — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:4:b` | Deny the review — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:5:a` | Use safe mode — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:5:b` | Keep systems online — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:6:a` | Discuss retention — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:6:b` | Take no action — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:7:a` | Fund two weeks (−€4K) — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `request:7:b` | Refer to local service — (no effect line) | Dynamic plan / conditional / callback; see measured trace; maybeFlash → request click |
| `beat:digigate:a` | digigate a — (no effect line) | Dynamic plan / conditional / callback; see measured trace; openCouncil → applyChoice → after |
| `beat:digigate:b` | digigate b — (no effect line) | Dynamic plan / conditional / callback; see measured trace; openCouncil → applyChoice → after |
| `beat:archipchallenge:a` | archipchallenge a — (no effect line) | Dynamic plan / conditional / callback; see measured trace; openCouncil → applyChoice → after |
| `beat:archipchallenge:b` | archipchallenge b — (no effect line) | Dynamic plan / conditional / callback; see measured trace; openCouncil → applyChoice → after |
| `vote:promise` | promise — (no effect line) | Dynamic plan / conditional / callback; see measured trace; confidenceVote → vote click |
| `vote:sacrifice` | sacrifice — (no effect line) | Dynamic plan / conditional / callback; see measured trace; confidenceVote → vote click |
| `vote:defy` | defy — (no effect line) | Dynamic plan / conditional / callback; see measured trace; confidenceVote → vote click |
| `promise:waits` | Waits ≤8w — (no effect line) | Dynamic plan / conditional / callback; see measured trace; showManifesto → selection → evaluateElection |
| `promise:nodeaths` | &lt;3 deaths — (no effect line) | Dynamic plan / conditional / callback; see measured trace; showManifesto → selection → evaluateElection |
| `promise:admin` | Admin &lt;15% — (no effect line) | Dynamic plan / conditional / callback; see measured trace; showManifesto → selection → evaluateElection |
| `promise:digital` | 2+ tech — (no effect line) | Dynamic plan / conditional / callback; see measured trace; showManifesto → selection → evaluateElection |
| `promise:doctors` | Doctors ≥60 — (no effect line) | Dynamic plan / conditional / callback; see measured trace; showManifesto → selection → evaluateElection |
