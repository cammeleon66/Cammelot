# Minister of Cammelot — checklist voor morgen

Datum bijgewerkt: 2026-09-17
Status: werkende lokale preview, niet gedeployed
Preview: `http://127.0.0.1:4318/minister.html`
Model: `minister-care-3-paired`
Geluid: tijdens ontwikkelen en testen uit laten

## Wat vandaag af is

- [x] Council pauzeert de simulatie volledig.
- [x] Council opent pas wanneer de speler op **Council ready** drukt.
- [x] Beweging en zorglogica zijn losgemaakt van de renderfrequentie.
- [x] Specialist aannemen verhoogt behandelcapaciteit en verandert niet meer de klinische norm.
- [x] Verwijzingen registreren wachten, behandelstart, overlijden vóór behandeling en vertrek.
- [x] Aankooppreview gebruikt dezelfde effectieve berekening als de aankoop.
- [x] Geforceerd overlijden bij niets doen verwijderd.
- [x] Externe omstandigheden zijn seed-vast en gelijk voor speler en referentie.
- [x] Jaarlijkse vergrijzingsdruk loopt in beide werelden gelijk.
- [x] Vergelijking gebruikt dezelfde eind-tick, ook bij vroeg politiek verlies.
- [x] Negatieve zorgverschillen blijven zichtbaar.
- [x] Politieke uitslag en zorguitkomst zijn afzonderlijk zichtbaar.
- [x] **Try another approach** bewaart de vorige poging voor dezelfde seed/modelversie.
- [x] Vijf strategieën × drie seeds volledig automatisch gespeeld; resultaten gedocumenteerd.
- [x] PNG-scoreknop vervangen door optionele community-scoreflow.
- [x] Leaderboard-backend heeft validatie, gegenereerde namen, ranking, duplicaatdetectie, rate limiting en persistente JSON-opslag.
- [x] Prominente moraliserende eindtekst verwijderd; eindtekst gebruikt runfeiten.
- [x] Eerste pass op beleids- en gebeurtenisteksten uitgevoerd.

## Morgen — uitvoervolgorde

### 1. Werkende boom opnieuw vaststellen

- [x] Bekijk `git status --short` en `git diff --stat`; raak niet-gerelateerde wijzigingen niet aan.
- [x] Draai eerst de gerichte suites:
  - `node --test tests/leaderboard.test.js`
  - `node --test tests/minister_browser.test.js`
- [x] Draai daarna `npm test` — 150 geslaagd, 0 mislukt/geannuleerd op 2026-09-17.
- [x] Draai `git diff --check` — geen whitespace-errors; alleen bestaande CRLF-waarschuwingen voor twee Obsidian-bestanden.
- [x] Controleer editorfouten in alle gewijzigde bestanden.

**Klaar wanneer:** alle tests slagen, geen cancellations, geen nieuwe diagnostics en geen whitespace-errors.

### 2. Leaderboard end-to-end valideren

- [ ] Installeer/gebruik Docker op een omgeving waar Docker beschikbaar is.
- [ ] Draai `docker compose config`.
- [ ] Bouw beide containers met `docker compose build leaderboard cammelot`.
- [ ] Start lokaal met `docker compose up` en controleer poort 8080.
- [ ] Speel een korte termijn uit en publiceer met:
  - een ingevulde publieke naam;
  - een leeg naamveld;
  - een ongeldige naam;
  - dezelfde run tweemaal.
- [ ] Herstart de containers en controleer dat scores in het volume blijven staan.
- [ ] Controleer dat het leaderboard alleen dezelfde modelversie en hetzelfde scenario toont.
- [x] Controleer mobiel: naamveld en knop minimaal 44 px, geen horizontale overflow (Chromium-emulatie).
- [x] Controleer graceful fallback wanneer de leaderboard-service uitstaat.
- [x] Leg vast hoe een beledigende maar syntactisch geldige naam verwijderd kan worden — offline command, backup vóór verwijderen, geen publiek admin-endpoint.

**Klaar wanneer:** de echte Nginx→Node-route werkt, opslag een restart overleeft, foutmeldingen bruikbaar zijn en er een eenvoudige moderatie-/verwijderprocedure bestaat.

**Bekende beperking:** scores zijn community-scores en niet fraudebestendig. De server speelt de beslissingen nog niet opnieuw af. Niet presenteren als geverifieerde wereldranglijst.

### 3. Volledige tekstopschoning afronden

Controleer alle zichtbare teksten; niet alleen het eindscherm:

- [ ] Picker en onboarding.
- [ ] Walkthrough.
- [ ] Manifesto en KPI’s.
- [ ] Alle intervention cards en tooltips.
- [ ] Alle wetten.
- [ ] Alle dilemma’s.
- [ ] Alle events en banners.
- [ ] Flash decisions.
- [ ] Gazette.
- [ ] Burgerstatus en dossier.
- [ ] Jaarafsluitingen.
- [ ] Eindscherm, research-details, kopieertekst en leaderboard.

Per tekst gelden deze regels:

- [x] Maximaal één feitelijke contextzin en één consequentiezin vóór details in de actieve dilemma-/event-/requestlaag.
- [x] Geen formuleringen zoals “not heroic”, “the hard route”, “staying the course”, “the system won”, “your successor inherits”, “rare praise” of “strongest AI outcome” in bereikbare Minister-schermen.
- [x] Geen verzonnen citaten die doen alsof een aankoop al aantoonbaar werkte in actieve beleidsfeedback; burgerfeedback komt uit zorggeschiedenis/snapshots.
- [ ] Geen vaste succespercentages tenzij ze uit de actuele run zijn berekend.
- [ ] Geen Nederlandse en Engelse UI door elkaar, behalve herkenbare vaktermen zoals Treeknorm en zorginfarct.
- [ ] Gebruik gewone woorden vóór technische termen.
- [ ] Toon modelmechaniek als modelmechaniek: “modeled deterioration ×0.90”, niet “better outcomes”.
- [ ] Resultaattekst noemt oorzaak alleen als de simulatie die oorzaak daadwerkelijk kan onderbouwen.

**Klaar wanneer:** zoekopdrachten naar bovenstaande slop-frases niets relevants vinden en een volledige Cabinet Crisis-run geen scherm met overbodige of verzonnen tekst oplevert.

### 4. Resultaatscherm verder inkorten

- [x] Zet bovenaan alleen:
  1. politieke uitslag;
  2. zorgvergelijking op dezelfde datum;
  3. drie belangrijkste verschillen;
  4. **Try another approach**;
  5. optioneel score publiceren.
- [x] Verplaats volledige beslissingslijst, gebeurtenissen, wetten, jaarbonussen en bronnen naar inklapbare details.
- [x] Verwijder dubbele cijfers die al in de zorgvergelijking staan.
- [x] Maak score visueel secundair aan politieke en zorguitkomsten.
- [x] Controleer het eindscherm op 375×667, 390×844, 412×915 en desktop in Chromium.
- [x] Test 200% Chromium-zoom en toetsenbordnavigatie.

**Klaar wanneer:** een speler binnen tien seconden kan beantwoorden: “bleef ik minister?” en “was de zorg beter of slechter dan de referentie?”

### 5. Strategy benchmark verbeteren

De huidige smoke-test staat in [MINISTER_STRATEGY_BENCHMARK.md](MINISTER_STRATEGY_BENCHMARK.md). Resultaten zijn nog geen balansbewijs.

- [ ] Splits aankoopstrategie en dilemma-/flashresponsbeleid.
- [ ] Voeg ten minste deze responsprofielen toe:
  - vertrouwen beschermen;
  - budget beschermen;
  - zorguitkomst beschermen;
  - altijd eerste optie als controle.
- [ ] Draai eerst 20 ontwikkelseeds.
- [ ] Gebruik daarna een aparte holdout-set.
- [ ] Rapporteer medianen, spreiding, politieke uitval en paired care differences.
- [ ] Controleer waarom de platformstrategie een hoge score maar de hoogste gemiddelde sterfte kreeg.
- [ ] Controleer waarom actieve strategieën zo vaak politiek verliezen.
- [x] Controleer of de enkele totaalscore misleidt; scoreberekening staat ingeklapt en is secundair.
- [x] Stem leaderboard-ranking af op zorguitkomst: uitsluitend dezelfde seed/model/scenario; systeemsterfte, sterfte vóór behandeling, behandelingen en wachttijd gaan vóór politieke voltooiing en score.

**Niet doen:** prijzen of incidenten aanpassen totdat een favoriete strategie wint.

**Klaar wanneer:** geen dominante of onverwachte uitkomst onverklaard blijft en de ranking niet evident slechtere zorg beloont.

### 6. Echte playtests voorbereiden

- [ ] Maak een observatieformulier met:
  - tijd tot eerste keuze;
  - tijd naar het dorp kijken;
  - begrepen hoofddoel;
  - gevolgde burger;
  - begrepen trade-off;
  - begrip politiek versus zorg;
  - reden om opnieuw te spelen;
  - verwarrende tekst/schermen.
- [ ] Test met minimaal vijf personen.
- [ ] Zorg voor minimaal één zorginhoudelijke reviewer.
- [ ] Test echte iPhone Safari en Android Chrome; noteer toestel- en browserversies.
- [ ] Geef vooraf geen uitleg; observeer waar mensen vastlopen.
- [ ] Noteer fouten apart van voorkeuren.

**Klaar wanneer:** minstens vier van vijf testers zonder hulp het doel, één burgeruitkomst, één trade-off en het verschil tussen politieke en zorguitkomst kunnen uitleggen.

### 7. LinkedIn/carrousel pas daarna bijwerken

- [ ] Werk oude claims bij over scenario-aantal, promise-aantal en timing.
- [ ] Verwijder claims die het spel nog niet aantoont.
- [ ] Maak duidelijk onderscheid tussen:
  - de eerdere IST/SOLL-onderzoekssimulatie;
  - dit participatieve beleidsspel;
  - community-scores zonder server-side verificatie.
- [ ] Gebruik resultaten van menselijke tests en de uiteindelijke benchmark, niet de huidige drie-seed smoke-test.
- [ ] Behoud de kernvraag: welke interventie, in welke volgorde, met welke bijwerking?

**Klaar wanneer:** de post exact beschrijft wat een speler werkelijk kan doen en zien.

### 8. Releasebeslissing

Niet deployen voordat:

- [ ] Docker/backend-route is getest.
- [ ] Leaderboardmoderatie en back-up zijn geregeld.
- [ ] Volledige tekstpass af is.
- [ ] Ranking geen aantoonbaar slechtere zorg beloont zonder uitleg.
- [ ] Echte iPhone- en Android-tests slagen.
- [ ] Menselijke playtestblokkades zijn opgelost.
- [ ] Alle tests groen zijn.
- [ ] Simone expliciet akkoord geeft op deployment.

## Bekende open punten

- Het leaderboard valideert velden maar kan zonder accounts/server-side replay worden gemanipuleerd.
- Emergency care gebruikt nog een oudere bypass; normale ziekenhuiscapaciteit is wel begrensd.
- De classificatie “system death” bevat nog causale aannames die zorginhoudelijk moeten worden beoordeeld.
- Sommige oudere, verborgen simulation/tour-teksten bevatten nog marketingachtige AI-claims; controleren of ze in de Minister-flow bereikbaar zijn en anders verwijderen of isoleren.
- De huidige scoreformule kan hoge score combineren met slechte sterfte. Rankingbesluit is open.
- Docker kon vandaag niet worden gebouwd omdat Docker niet geïnstalleerd is.
- De huidige benchmarkrunner voert vaste responses uit; aankoopstrategie is daardoor niet volledig geïsoleerd.

## Belangrijkste bestanden

- Game: [site/minister.html](../site/minister.html)
- Browsertests: [tests/minister_browser.test.js](../tests/minister_browser.test.js)
- Leaderboard: [src/leaderboard/server.js](../src/leaderboard/server.js)
- Leaderboardtests: [tests/leaderboard.test.js](../tests/leaderboard.test.js)
- Container: [Dockerfile.leaderboard](../Dockerfile.leaderboard), [docker-compose.yml](../docker-compose.yml), [nginx.conf](../nginx.conf)
- Strategy runner: [scripts/benchmark_minister_strategies.cjs](../scripts/benchmark_minister_strategies.cjs)
- Ruwe benchmark: [scripts/output/minister_strategy_benchmark.json](../scripts/output/minister_strategy_benchmark.json)
- Benchmarkanalyse: [MINISTER_STRATEGY_BENCHMARK.md](MINISTER_STRATEGY_BENCHMARK.md)
- Referentieprotocol: [MINISTER_REFERENCE_PROTOCOL.md](MINISTER_REFERENCE_PROTOCOL.md)
- Hoofdplan: [MINISTER_IMPROVEMENT_PLAN.md](MINISTER_IMPROVEMENT_PLAN.md)
- Leaderboarduitleg: [COMMUNITY_LEADERBOARD.md](COMMUNITY_LEADERBOARD.md)

## Eerste actie morgen

Begin met **1. werkende boom opnieuw vaststellen**. Ga daarna direct naar **2. leaderboard end-to-end** als Docker beschikbaar is; anders naar **3. volledige tekstopschoning**. Niet beginnen met nieuwe features, nieuwe scenario’s of visuele polish.
