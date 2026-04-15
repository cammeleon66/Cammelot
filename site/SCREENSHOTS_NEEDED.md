# Screenshots Needed for cammelot.org

Take these in the **Live Simulation** (world.html) at 1200×800px or higher.
Use dark mode for consistency. Save as `.png` in `site/img/`.

---

## Hub Page (index.html)

| Filename | What to capture | Where it goes |
|----------|----------------|---------------|
| `hero-sim.png` | Wide shot of the pixel town — citizens walking, buildings visible, green grass, blue water. The "pretty" overview. | Hero section background or below title |
| `ist-queue.png` | IST mode with visible queue congestion — sprites stacked at hospital, red `!` icons, burnout meter high. | Chapter 0 teaser card |
| `soll-smooth.png` | SOLL mode running smoothly — shorter queues, green indicators, proactive alerts visible. | Chapter 0 teaser card (comparison) |

## Chapter 0: Why I Built This (`ch0.html`)

| Filename | What to capture | Where it goes |
|----------|----------------|---------------|
| `hendrik-alive.png` | Hendrik Veenstra (age 70) sprite with speech bubble, walking near hospital. HP bar visible. | Near "first death" paragraph |
| `hendrik-ghost.png` | Hendrik's ghost sprite (grey/transparent) after HP reaches 0. | Near mortality explanation |
| `cognitive-loop.png` | Simulation panel showing Memory → Reflection → Planning cycle for any agent. | Architecture section |

## Chapter 1: A2A + FHIR Architecture (`ch1.html`)

| Filename | What to capture | Where it goes |
|----------|----------------|---------------|
| `agent-card.png` | Agent Card panel for Dr. de Jong — showing skills, wait time, queue size. | Agent Cards section |
| `referral-flow.png` | A referral in progress — GP sprite with speech bubble "Referring to cardiology", message arrow to hospital. | Referral lifecycle section |
| `fhir-log.png` | FHIR resource log panel showing Encounter, Observation, Condition entries for a patient. | FHIR memory section |

## Chapter 2: Agentic Mesh (`ch2.html`)

| Filename | What to capture | Where it goes |
|----------|----------------|---------------|
| `mesh-overview.png` | Full town view showing multiple agents communicating — speech bubbles, referral lines, agent cards visible. | Hero/intro of chapter |
| `research-agent.png` | Research agent running queries (if visible in SOLL mode). | Research section |
| `ist-vs-soll.png` | Side-by-side or toggle comparison showing IST (congested) vs SOLL (flowing). | Core comparison |

## Chapter 3: What's Coming (`ch3.html`)

| Filename | What to capture | Where it goes |
|----------|----------------|---------------|
| `dashboard-stats.png` | End-of-simulation dashboard showing key metrics (deaths, burnout, costs, fairness). | Results teaser |
| `chart-mortality.png` | The mortality by age group chart (bar chart from the simulation stats). | Mortality preview |

---

## How to take them

1. Open `https://cammelot.org/world.html` (or `localhost:8766/world.html`)
2. Click **Play Simulation**
3. Let it run ~500 cycles for IST screenshots, then toggle to SOLL
4. Use browser DevTools → `Ctrl+Shift+P` → "Capture screenshot" for clean captures
5. Crop to the relevant area
6. Save at 2× resolution if possible (retina)

## File naming convention

- All lowercase, hyphens between words
- Always `.png` format
- Place in `site/img/` directory
