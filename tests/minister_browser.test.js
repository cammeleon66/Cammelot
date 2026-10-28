import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-chromium';

const SITE_ROOT = join(process.cwd(), 'site');
const launchBrowser = async () => {
  const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  // Cosmetic third-party assets must not make local care regressions depend on
  // internet access. Page-specific leaderboard mocks retain precedence.
  browser.on('context', context => context.route(/https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|plausible\.io)\//,
    route => route.fulfill({status:200,body:''})));
  return browser;
};
const MIME_TYPES = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
};

function startSiteServer() {
  const server = createServer((request, response) => {
    const urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relativePath = urlPath === '/' ? 'minister.html' : urlPath.replace(/^\/+/, '');
    const filePath = normalize(join(SITE_ROOT, relativePath));
    if (!filePath.startsWith(SITE_ROOT) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function openCouncilActions(page) {
  for (let step = 0; step < 4 && !(await page.locator('#moc-shop').count()); step++) {
    const choices = page.locator('#moc-council .moc-opt:not(:disabled)');
    if (await choices.count()) await choices.first().click();
    await page.locator('#moc-wiz-next').click();
  }
  assert.ok(await page.locator('#moc-shop').count(), 'council must reach funding');
}

test('Public entry pages distinguish evidence, synthetic residents and legacy provenance', () => {
  for (const file of ['index.html', 'about.html', 'ch0.html', 'ch0-alternative.html', 'ch1.html', 'ch2.html', 'ch3.html', 'world.html', 'minister.html']) {
    const html = readFileSync(join(SITE_ROOT, file), 'utf8');
    assert.match(html, /(?:id="evidence"|href="index\.html#evidence")/, `${file} must link its evidence boundary`);
    assert.doesNotMatch(html, /strictly factual|5,000 agents \(CBS scaled\)|first preventable death|Real Dutch data|runs on real CBS|Treeknorm says under 4 weeks|today's crisis/i, `${file} must not reintroduce unsupported claims`);
    if (/^(?:ch[0-3]|world)/.test(file)) {
      assert.match(html, /legacy World/i, `${file} must identify its legacy executable`);
    }
  }
  const landing = readFileSync(join(SITE_ROOT, 'index.html'), 'utf8');
  for (const category of ['Empirical input data', 'Model assumptions', 'Authored game rules', 'Observed simulation outputs']) {
    assert.ok(landing.includes(category), `public evidence contract must define ${category}`);
  }
  const minister = readFileSync(join(SITE_ROOT, 'minister.html'), 'utf8');
  assert.match(minister, /needle:'model system death'/, 'objective help must follow renamed mortality wording');
  assert.doesNotMatch(minister, /needle:'preventable death'/);
  assert.match(minister, /Within-model comparison, not clinical evidence\. Model /, 'copied results must retain the evidence qualification');
});

test('Browser fixtures isolate cosmetic requests offline for both context creation paths', { timeout: 30000 }, async () => {
  const browser = await launchBrowser();
  try {
    for (const explicitContext of [false, true]) {
      const page = explicitContext
        ? await (await browser.newContext()).newPage()
        : await browser.newPage();
      const context = page.context();
      await context.setOffline(true);
      for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com', 'plausible.io']) {
        const response = await page.goto(`https://${host}/fixture-isolation`);
        assert.equal(response.status(), 200);
        assert.equal(await response.text(), '', `${host} must be fulfilled without network access`);
      }
      await page.route('https://plausible.io/fixture-isolation', route => route.fulfill({ body: 'page override' }));
      const response = await page.goto('https://plausible.io/fixture-isolation');
      assert.equal(await response.text(), 'page override', 'page-specific mocks must retain precedence');
      await context.close();
    }
  } finally {
    await browser.close();
  }
});

test('Minister picker offers two responsive game modes', { timeout: 30000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/minister.html`;
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('moc_muted_v2','true'));
  const failedRequests = [];
  page.on('requestfailed', (request) => failedRequests.push(request.url()));

  try {
    await page.goto(`${baseUrl}?picker=test`, { waitUntil: 'domcontentloaded' });
    await page.locator('.moc-game-card').first().waitFor();
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 412, height: 915 },
      { width: 375, height: 667 },
    ]) {
      await page.setViewportSize(viewport);
      const cards = page.locator('.moc-game-card');
      assert.equal(await cards.count(), 2, 'public picker should expose exactly two modes');
      for (let index = 0; index < 2; index += 1) {
        const box = await cards.nth(index).boundingBox();
        assert.ok(box, 'game mode should be visible');
        assert.ok(box.x >= 0 && box.x + box.width <= viewport.width, 'game mode should fit viewport width');
        assert.ok(box.y >= 0 && box.y + box.height <= viewport.height, 'game mode should fit viewport height');
      }
      assert.equal(await page.locator('#term-seed').isVisible(), false, 'legacy picker status should stay hidden');
    }

    await page.getByRole('button', { name: /Cabinet Crisis/ }).click();
    await page.waitForURL(/scn=cabinetcrisis/);
    await page.goto(`${baseUrl}?picker=full`, { waitUntil: 'domcontentloaded' });
    await page.locator('.moc-game-card').first().waitFor();
    await page.getByRole('button', { name: /Full Term/ }).click();
    await page.waitForURL(/scn=campaign/);
    assert.deepEqual(failedRequests, []);
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Drawing the town cannot advance a paused patient', { timeout: 30000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`, { waitUntil: 'domcontentloaded' });
    const limits = await page.locator('#play-overlay details').filter({ hasText: 'Why this game? Model & limits' }).textContent();
    assert.match(limits, /45 synthetic residents/);
    assert.match(limits, /not 5,000 individual agents/);
    assert.match(limits, /game rules, not national financing/);
    assert.match(limits, /not proven preventability/);
    assert.equal(await page.evaluate(()=>MoC.audio.isMuted()),false,'new visitors should start with sound enabled');
    assert.match(await page.locator('#moc-opening-sound').innerText(),/SOUND ON/);
    const openingSoundBox=await page.locator('#moc-opening-sound').boundingBox();
    assert.ok(openingSoundBox&&openingSoundBox.height>=44);
    const result = await page.evaluate(() => {
      MoC.audio.setMuted(true);
      const person = agents.find(a => a.type === 'patient' && a.hp > 0);
      person.insideBuilding = null;
      person.chatTimer = 120;
      person.grievingTimer = 100;
      const snapshot = () => JSON.stringify(agents.map(a => ({ id:a.id, x:a.x, y:a.y, path:a.path, pathIdx:a.pathIdx,
        pathComplete:a.pathComplete, chatTimer:a.chatTimer, grievingTimer:a.grievingTimer, hp:a.hp, behavior:a.behaviorState })));
      const before = snapshot();
      for (let i = 0; i < 20; i++) render();
      return { before, after:snapshot(), paused:MoC.paused };
    });
    assert.equal(result.paused, true);
    assert.equal(result.after, result.before, 'render must not mutate logical positions, social timers or patient state');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('Elapsed model clock uses quarter-week ticks and exact calendar boundaries', { timeout: 30000 }, async () => {
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,{waitUntil:'domcontentloaded'});
    const outcome=await page.evaluate(()=>{
      clearInterval(autoTimer);autoTimer=null;
      const annualProbability=0.12;
      const rate=MoC.annualProbabilityToTick(annualProbability);
      const expectedRate=1-Math.pow(1-annualProbability,1/208);
      const overdueDrain=overdueWaitDrainPerTick(13,12,'moderate',0.3);
      const oldSeedTick=MoC.seedTick,oldAdvance=MoC.environment.advance;
      const oldQuarter=MoC.onQuarter,oldTermEnd=MoC.onTermEnd;
      const oldTransition=window.transitionDiseaseState;
      const oldReferencePolicy=MoC.referencePolicy,oldPaused=MoC.paused,oldOver=MoC.S.over;
      const oldRandom=Math.random;
      const councilTicks=[];
      const resident=agents.find(a=>a.type==='patient'||a.type==='citizen');
      agents.filter(a=>a.type==='patient'||a.type==='citizen').forEach(a=>{a.moved=true;});
      Object.assign(resident,{moved:false,insideBuilding:'hospital',behaviorState:'at_hospital',state:'managed',
        stateTimer:1000,hp:100,age:70,_ageStart:70,_ageElapsedTicks:0,
        conditions:[{code:'I25',name:'Fixture condition',severity:'mild'}]});
      const initialAge=resident.age,progressionTicks=[];
      window.transitionDiseaseState=function(code,state){progressionTicks.push(modelTick);return state;};
      MoC.seedTick=function(){Math.random=()=>0.5;};
      MoC.environment.advance=function(){};
      MoC.onQuarter=function(q){councilTicks.push({q,tick:modelTick});};
      let terminalAtTerm=null;
      MoC.onTermEnd=function(){terminalAtTerm={dead:resident.state==='dead',finalized:resident.deathFinalized};};
      MoC.paused=false;MoC.S.over=false;MoC.referencePolicy=true;
      const advanceTo=target=>{
        const limit=Math.max(0,target-modelTick);
        for(let step=0;modelTick<target&&step<limit;step++){
          const before=modelTick;tick();
          if(modelTick!==before+1)throw new Error(`Clock stopped at elapsed tick ${modelTick}; expected ${before+1}`);
        }
        if(modelTick!==target)throw new Error(`Clock did not reach elapsed tick ${target}; stopped at ${modelTick}`);
      };
      try {
        MoC.paused=true;
        let boundedPauseError='';
        try { advanceTo(1); } catch(error) { boundedPauseError=error.message; }
        MoC.paused=false;
        if(!boundedPauseError.includes('Clock stopped at elapsed tick 0'))
          throw new Error('Bounded clock fixture did not report a stalled tick clearly');
        logEvent('time_fixture',resident,'cycle offset check');
        const eventTick=EVENT_LOG[EVENT_LOG.length-1].cycle;
        const initial={cycle,elapsed:MoC.elapsedTick(),ticksPerWeek:MoC.TICKS_PER_WEEK,
          ticksPerDay:MoC.TICKS_PER_DAY,ticksPerQuarter:MoC.QUARTER_TICKS,
          ticksPerYear:MoC.TICKS_PER_YEAR,modelVersion:MoC.MODEL_VERSION};
        const openingCopy={story:MoC.SCENARIOS.cabinetcrisis.story,brief:MoC.SCENARIOS.cabinetcrisis.brief.situation};
        advanceTo(1);
        const short={cycle,elapsed:MoC.elapsedTick(),age:resident.age,progressions:progressionTicks.length,
          phases:[0,1,2,3].map(getTimeOfDay).map(clock=>clock.phase)};
        advanceTo(52);
        const quarter={cycle,elapsed:MoC.elapsedTick(),quarter:MoC.S.quarter,
          lastProgression:progressionTicks.at(-1)};
        advanceTo(208);
        const year={cycle,elapsed:MoC.elapsedTick(),quarter:MoC.S.quarter,age:resident.age,
          progressionCount:progressionTicks.length};
        advanceTo(415);
        resident.hp=0;
        advanceTo(416);
        const term={cycle,elapsed:MoC.elapsedTick(),over:MoC.S.over,terminalAtTerm};
        return {initial,openingCopy,short,quarter,year,term,councilTicks,eventTick,initialAge,rate,expectedRate,overdueDrain,boundedPauseError,
          zeroRate:MoC.annualProbabilityToTick(0),terminalDeaths:EVENT_LOG.filter(e=>e.type==='died').length};
      } finally {
        MoC.seedTick=oldSeedTick;MoC.environment.advance=oldAdvance;
        MoC.onQuarter=oldQuarter;MoC.onTermEnd=oldTermEnd;
        window.transitionDiseaseState=oldTransition;
        MoC.referencePolicy=oldReferencePolicy;MoC.paused=oldPaused;MoC.S.over=oldOver;
        Math.random=oldRandom;
      }
    });
    assert.deepEqual(outcome.initial,{cycle:30,elapsed:0,ticksPerWeek:4,ticksPerDay:4/7,ticksPerQuarter:52,ticksPerYear:208,
      modelVersion:'minister-care-10-access-time-replay'});
    assert.match(outcome.openingCopy.story,/Seven allocation councils remain, from Q2 through Q8/);
    assert.match(outcome.openingCopy.brief,/Seven allocation councils from Q2 through Q8/);
    assert.match(outcome.openingCopy.brief,/opening quarter has no purchase window/);
    assert.match(outcome.boundedPauseError,/Clock stopped at elapsed tick 0; expected 1/);
    assert.equal(outcome.eventTick,0,'event timestamps use elapsed ticks rather than the cycle-30 display offset');
    assert.deepEqual(outcome.short,{cycle:31,elapsed:1,age:70+1/208,progressions:0,
      phases:['night','dusk','day','dawn']});
    assert.equal(outcome.quarter.elapsed,52,'the first full quarter ends on elapsed tick 52');
    assert.equal(outcome.quarter.quarter,2,'quarter advancement occurs after clinical processing at tick 52');
    assert.equal(outcome.quarter.lastProgression,52,'weekly disease progression includes the exact quarter boundary tick');
    assert.equal(outcome.year.elapsed,208,'one model year contains exactly 208 elapsed ticks');
    assert.equal(outcome.year.quarter,5);
    assert.ok(Math.abs(outcome.year.age-(outcome.initialAge+1))<1e-9,'age advances exactly one model year');
    assert.equal(outcome.year.progressionCount,52,'disease progression is evaluated every four elapsed ticks');
    assert.deepEqual(outcome.term,{cycle:446,elapsed:416,over:true,terminalAtTerm:{dead:true,finalized:true}},
      'the final clinical tick is processed before the term-end callback');
    assert.deepEqual(outcome.councilTicks.map(({q,tick})=>[q,tick]),
      [[2,52],[3,104],[4,156],[5,208],[6,260],[7,312],[8,364]],
      'Cabinet Crisis offers seven allocations at Q2-Q8; the opening quarter has no allocation council');
    assert.equal(outcome.zeroRate,0,'zero annual probability remains zero per tick');
    assert.ok(Math.abs(outcome.rate-outcome.expectedRate)<1e-15,'annual probability conversion uses the 208-tick year');
    assert.ok(Math.abs(outcome.overdueDrain-0.975)<1e-12,'one overdue week at moderate severity converts the 3 HP/week rule to per-tick drain');
    assert.equal(outcome.terminalDeaths,1,'terminal death is finalized exactly once at the year/term boundary');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Aging preserves completed-year bands, initializes new destinations, and formats displayed age', { timeout: 30000 }, async () => {
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(()=>{
      clearInterval(autoTimer);autoTimer=null;
      const oldSeedTick=MoC.seedTick,oldAdvance=MoC.environment.advance;
      const oldReferencePolicy=MoC.referencePolicy,oldPaused=MoC.paused,oldOver=MoC.S.over,oldRandom=Math.random;
      const resident=agents.find(a=>(a.type==='patient'||a.type==='citizen')&&a.hp>0);
      agents.filter(a=>a.type==='patient'||a.type==='citizen').forEach(a=>Object.assign(a,{
        moved:true,insideBuilding:'test-isolation',behaviorState:'at_hospital',state:'managed',
        hp:100,conditions:[],age:40,_ageStart:40,_ageElapsedTicks:0,lifeStage:'adult'
      }));
      const bands=[5.999,6,12.999,13,17.004,18,67.999,68,79.004,80].map(age=>[age,lifeStageForAge(age)]);
      MoC.seedTick=function(){Math.random=()=>0.5;};
      MoC.environment.advance=function(){};
      MoC.referencePolicy=true;MoC.paused=false;MoC.S.over=false;
      try {
        Object.assign(resident,{moved:true,age:5.999,_ageStart:5.999,_ageElapsedTicks:0,lifeStage:'toddler',
          schoolPos:null,schoolTimer:0,workplace:null,workplacePos:null,atWork:false,workTimer:0});
        tick();
        const child={age:resident.age,lifeStage:resident.lifeStage,schoolPos:resident.schoolPos};
        Object.assign(resident,{moved:true,age:17.999,_ageStart:17.999,_ageElapsedTicks:0,lifeStage:'teen',
          schoolPos:{x:0.42,y:0.18},schoolTimer:9,workplace:null,workplacePos:null});
        tick();
        const adult={age:resident.age,lifeStage:resident.lifeStage,schoolPos:resident.schoolPos,
          workplace:resident.workplace,workplacePos:resident.workplacePos};
        const oldWorkplace=resident.workplace;
        Object.assign(resident,{moved:true,age:67.999,_ageStart:67.999,_ageElapsedTicks:0,lifeStage:'adult',
          behaviorState:'roaming',insideBuilding:oldWorkplace,atWork:true,workTimer:12,schoolPos:null,schoolTimer:0});
        tick();
        const senior={age:resident.age,lifeStage:resident.lifeStage,workplace:resident.workplace,
          workplacePos:resident.workplacePos,insideBuilding:resident.insideBuilding,atWork:resident.atWork,workTimer:resident.workTimer};
        const treatmentBirthdays=[
          {behavior:'at_hospital',building:'hospital'},
          {behavior:'at_gp',building:getGPDest(resident.gpName).building}
        ].map(({behavior,building})=>{
          Object.assign(resident,{age:67.999,_ageStart:67.999,_ageElapsedTicks:0,lifeStage:'adult',
            behaviorState:behavior,insideBuilding:building,workplace:building,workplacePos:{x:0.5,y:0.5},
            atWork:true,workTimer:12,stateTimer:8});
          tick();
          return {building,behavior:resident.behaviorState,insideBuilding:resident.insideBuilding,
            lifeStage:resident.lifeStage,workplace:resident.workplace,atWork:resident.atWork,stateTimer:resident.stateTimer};
        });
        resident.age=70+1/208;
        resident.causeOfDeath='natural';
        finalizeAgentDeath(resident);
        const naturalEvent=EVENT_LOG.filter(e=>e.type==='natural_death'&&e.agentId===resident.id).at(-1);
        const deathHistory=resident.actionHistory.filter(e=>e.type==='died').at(-1);
        const grave=GRAVE_MARKERS.at(-1);
        showMemorial(grave);
        return {bands,child,adult,senior,treatmentBirthdays,preciseAge:resident.age,eventDetail:naturalEvent.detail,
          deathHistory:deathHistory.text,graveAge:grave.age,memorial:document.getElementById('agent-detail').innerText};
      } finally {
        MoC.seedTick=oldSeedTick;MoC.environment.advance=oldAdvance;
        MoC.referencePolicy=oldReferencePolicy;MoC.paused=oldPaused;MoC.S.over=oldOver;Math.random=oldRandom;
      }
    });
    assert.deepEqual(result.bands,[
      [5.999,'toddler'],[6,'child'],[12.999,'child'],[13,'teen'],[17.004,'teen'],
      [18,'adult'],[67.999,'adult'],[68,'senior'],[79.004,'senior'],[80,'elderly']
    ]);
    assert.equal(result.child.lifeStage,'child');
    assert.deepEqual(result.child.schoolPos,{x:0.42,y:0.18},'new students need a school destination');
    assert.equal(result.adult.lifeStage,'adult');
    assert.equal(result.adult.schoolPos,null,'adults must not retain a school destination');
    assert.ok(result.adult.workplace&&result.adult.workplacePos,'new adults need a workplace destination');
    assert.equal(result.senior.lifeStage,'senior');
    assert.equal(result.senior.workplace,null);
    assert.equal(result.senior.workplacePos,null);
    assert.equal(result.senior.insideBuilding,null);
    assert.equal(result.senior.atWork,false);
    assert.equal(result.senior.workTimer,0);
    for(const visit of result.treatmentBirthdays){
      assert.equal(visit.insideBuilding,visit.building,'retirement must preserve an active treatment location, even at the former workplace');
      assert.ok(['at_hospital','at_gp'].includes(visit.behavior));
      assert.equal(visit.lifeStage,'senior');
      assert.equal(visit.workplace,null);
      assert.equal(visit.atWork,false);
      assert.equal(visit.stateTimer,8,'retirement must not alter the active treatment timer');
    }
    assert.equal(result.preciseAge,70+1/208,'clinical age retains its fractional-year precision');
    assert.equal(result.eventDetail,'Age 70');
    assert.equal(result.deathHistory,'Passed away peacefully at age 70.');
    assert.equal(result.graveAge,70+1/208,'grave data retains the precise numeric age');
    assert.match(result.memorial,/Age 70\b/i);
    assert.doesNotMatch(result.memorial,/70\.004/);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Gazette keeps partial days and HP breakdown shows the actual overdue wait drain', { timeout: 30000 }, async () => {
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(()=>{
      const p=M[mode],resident=agents.find(a=>a.type==='patient'||a.type==='citizen');
      Object.assign(resident,{waitWeeks:13,receivingKetenzorg:false,persona:null,personality:null,
        conditions:[{code:'I25',name:'Fixture condition',severity:'moderate'}]});
      const expected=overdueWaitDrainPerTick(resident.waitWeeks,p.tree,'moderate',p.admin);
      const breakdown=buildDrainBreakdown(resident);
      const base=DISEASE_DB.I25.hpDrainPerTick*p.drain;
      const actualWait=calculateHPDrain({code:'I25'},'moderate',resident.waitWeeks,p,resident)-base;
      return {days:getSeasonAndDay(3),seasonBoundary:getSeasonAndDay(52),yearBoundary:getSeasonAndDay(208),
        expected,actualWait,breakdown};
    });
    assert.deepEqual(result.days,{day:6,dayOfYear:5,year:1,season:'Spring'});
    assert.deepEqual(result.seasonBoundary,{day:92,dayOfYear:91,year:1,season:'Summer'});
    assert.deepEqual(result.yearBoundary,{day:365,dayOfYear:0,year:2,season:'Spring'});
    assert.ok(Math.abs(result.expected-0.975)<1e-12);
    assert.ok(Math.abs(result.actualWait-result.expected)<1e-12);
    assert.ok(result.breakdown.includes('+0.975/tick'), 'the resident inspector must show the same wait penalty as the clinical calculation');
    assert.ok(!result.breakdown.includes('+0.195/tick'), 'the inspector must not understate the penalty');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Weekly report numbering follows elapsed weeks after retention reaches 50 reports', { timeout: 30000 }, async () => {
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(()=>{
      clearInterval(autoTimer);autoTimer=null;
      const oldReports=WEEKLY_REPORTS.slice(),oldLast=lastWeeklyReportCycle,oldTick=modelTick;
      try {
        WEEKLY_REPORTS.splice(0,WEEKLY_REPORTS.length,...Array.from({length:50},(_,i)=>({weekNumber:i+2})));
        modelTick=208;lastWeeklyReportCycle=204;
        const week52=generateWeeklyReport();
        modelTick=212;
        const week53=generateWeeklyReport();
        return {week52:week52.weekNumber,week53:week53.weekNumber,count:WEEKLY_REPORTS.length,
          oldest:WEEKLY_REPORTS[0].weekNumber,newest:WEEKLY_REPORTS.at(-1).weekNumber};
      } finally {
        WEEKLY_REPORTS.splice(0,WEEKLY_REPORTS.length,...oldReports);
        lastWeeklyReportCycle=oldLast;modelTick=oldTick;
      }
    });
    assert.deepEqual(result,{week52:52,week53:53,count:50,oldest:4,newest:53});
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Full Term horizon ends after 40 elapsed quarters', { timeout: 30000 }, async () => {
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=campaign&seed=2468`,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(()=>{
      clearInterval(autoTimer);autoTimer=null;
      const councils=[];
      let endedAt=null;
      let currentTick=0;
      MoC.onQuarter=q=>councils.push({q,tick:currentTick});
      MoC.onTermEnd=()=>{endedAt=currentTick;};
      for(let elapsedTick=1;elapsedTick<=MoC.TOTAL_QUARTERS*MoC.QUARTER_TICKS;elapsedTick++){currentTick=elapsedTick;MoC.onTick(elapsedTick);}
      return {quarters:MoC.TOTAL_QUARTERS,ticksPerQuarter:MoC.QUARTER_TICKS,endedAt,councils};
    });
    assert.equal(result.quarters,40);
    assert.equal(result.ticksPerQuarter,52);
    assert.equal(result.endedAt,2080);
    assert.equal(result.councils.length,39,'allocation councils begin after the first quarter and run through Q40');
    assert.deepEqual(result.councils[0],{q:2,tick:52});
    assert.deepEqual(result.councils.at(-1),{q:40,tick:2028});
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('GP journeys retain their destination across a night tick', { timeout: 30000 }, async () => {
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(()=>{
      clearInterval(autoTimer);autoTimer=null;
      const oldSeedTick=MoC.seedTick,oldRandom=Math.random;
      const oldReferencePolicy=MoC.referencePolicy,oldPaused=MoC.paused;
      const person=agents.find(a=>a.type==='patient'&&a.hp>0);
      agents.filter(a=>a.type==='patient'||a.type==='citizen').forEach(a=>{a.moved=true;});
      const gp=getGPDest(person.gpName).entrance;
      const gpWaypoint=nearestWaypointIdx(gp.x,gp.y);
      const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
      const start=ROAD_WAYPOINTS.reduce((best,wp)=>distance(wp,gp)>distance(best,gp)?wp:best);
      const home=ROAD_WAYPOINTS.find(wp=>distance(wp,start)>0.1&&distance(wp,gp)>0.1
        &&findWaypointPath(nearestWaypointIdx(start.x,start.y),nearestWaypointIdx(wp.x,wp.y))?.length>1);
      if(!home)throw new Error('Fixture needs distinct reachable home and GP destinations');
      Object.assign(person,{moved:false,x:start.x,y:start.y,insideBuilding:null,homePos:{x:home.x,y:home.y},
        age:40,_ageStart:40,_ageElapsedTicks:0,lifeStage:'adult',conditions:[],hp:100,state:'managed',
        behaviorState:'going_to_gp',isNightOwl:false,chatTimer:100,grievingTimer:0,atWork:false,
        queueLeaveTimer:0,queueType:null,queueBuilding:null,personality:null,persona:null});
      Object.values(QUEUES).forEach(queue=>{queue.agents=queue.agents.filter(id=>id!==person.id);});
      MoC.seedTick=()=>{Math.random=()=>0.5;};
      MoC.referencePolicy=true;MoC.paused=false;
      try {
        sendAgentTo(person,gp);
        const originalPath=person.path.slice();
        modelTick=2;cycle=MoC.STARTUP_CYCLE+modelTick;
        tick();
        tick();
        const journey={tick:modelTick,phase:getTimeOfDay(modelTick).phase,path:person.path.slice(),
          behavior:person.behaviorState,queued:Object.values(QUEUES).some(queue=>queue.agents.includes(person.id))};
        person.behaviorState='roaming';person.chatTimer=100;
        sendAgentTo(person,gp);
        modelTick=3;cycle=MoC.STARTUP_CYCLE+modelTick;
        tick();
        return {originalPath,gpWaypoint,journey,roamingDestination:person.path.at(-1),
          homeWaypoint:nearestWaypointIdx(home.x,home.y)};
      } finally {
        MoC.seedTick=oldSeedTick;Math.random=oldRandom;
        MoC.referencePolicy=oldReferencePolicy;MoC.paused=oldPaused;
      }
    });
    assert.equal(result.originalPath.at(-1),result.gpWaypoint);
    assert.equal(result.journey.tick,4);
    assert.equal(result.journey.phase,'night');
    assert.deepEqual(result.journey.path,result.originalPath,'nightfall must not replace an active GP journey with a home route');
    assert.equal(result.journey.behavior,'going_to_gp');
    assert.equal(result.journey.queued,false,'a resident still travelling must not join the GP queue');
    assert.equal(result.roamingDestination,result.homeWaypoint,'ordinary roaming residents should still head home at night');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Clinical replay is independent of drawing and baseline batching', { timeout: 30000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  try {
    async function replay(frames, baseline, width) {
      const context = await browser.newContext({ viewport:{ width, height:844 } });
      const page = await context.newPage();
      await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
      await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468${baseline ? '&baseline=1' : ''}`, { waitUntil:'domcontentloaded' });
      const state = await page.evaluate(frames => {
        clearInterval(autoTimer);autoTimer=null;
        MoC.audio.setMuted(true);
        MoC.referencePolicy = true;
        MoC.paused = false;
        for (let step = 0; step < 80; step++) {
          const before=modelTick;
          tick();
          if(modelTick!==before+1)throw new Error(`Replay stopped at elapsed tick ${modelTick}; expected ${before+1}`);
          for (let f = 0; f < frames; f++) render();
        }
        if(modelTick!==80)throw new Error(`Replay did not reach elapsed tick 80; stopped at ${modelTick}`);
        return { cycle, elapsed:modelTick, agents:agents.map(a => ({id:a.id,x:a.x,y:a.y,hp:a.hp,behavior:a.behaviorState,
          wait:a.waitWeeks,conditions:a.conditions,path:a.path,pathIdx:a.pathIdx,inside:a.insideBuilding})),
          graves:GRAVE_MARKERS, queues:QUEUES,
          events:EVENT_LOG.map(({timestamp,...event}) => event) };
      }, frames);
      await context.close();
      return state;
    }
    const foreground = await replay(0, false, 390);
    assert.equal(foreground.elapsed,80);
    assert.equal(foreground.cycle,110);
    assert.deepEqual(await replay(2, false, 1440), foreground, 'extra drawing must not alter outcomes');
    assert.deepEqual(await replay(0, true, 390), foreground, 'baseline batching must run the same care simulation');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

// Resource fixtures use the actual tick, movement, admission and terminal paths.
// No reference-policy bypass is left enabled while exercising the player handlers.
async function withResourceTown(run, query='', scenario='cabinetcrisis', seed=2468) {
  const server = await startSiteServer(), browser = await launchBrowser(), page = await browser.newPage();
  const writes = [];
  await page.route('**/*', route => {
    const request = route.request();
    if (request.method() !== 'GET') { writes.push(request.url()); return route.abort(); }
    if (!request.url().startsWith(`http://127.0.0.1:${server.address().port}/`))
      return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    return route.continue();
  });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html${query}#scn=${scenario}&seed=${seed}`, {waitUntil:'domcontentloaded'});
    await page.evaluate(() => {
      clearInterval(autoTimer); autoTimer = null; MoC.audio.setMuted(true);
      const original = {referencePolicy:MoC.referencePolicy,seedTick:MoC.seedTick,
        advance:MoC.environment.advance,transition:window.transitionDiseaseState,random:Math.random};
      MoC.referencePolicy = true; // setup only; never a handler bypass under test
      const people = agents.filter(a => a.type === 'patient' || a.type === 'citizen');
      people.forEach(a => Object.assign(a, {moved:true,insideBuilding:'fixture-isolation',behaviorState:'roaming',
        hp:100,state:'managed',conditions:[],queueType:null,queueBuilding:null}));
      Object.values(QUEUES).forEach(q => { q.agents = []; });
      MoC.care.sync();
      MoC.S.specialistCapacity = 0.25; MoC.S.serviceCredit = 0;
      // Neutral workforce isolates resource conservation from F05 service speed.
      Object.assign(M.IST,{admin:0,sick:0,ai:1});
      agents.filter(a => a.type === 'gp').forEach(g => Object.assign(g,{sickLeaveTimer:0,burnoutLevel:0}));
      MoC.seedTick = () => { Math.random = () => 0.5; };
      MoC.environment.advance = () => {};
      window.transitionDiseaseState = (code,state) => state;
      const samples = [];
      window.resourceFixture = {
        people, samples,
        enableEnvironment(){ MoC.environment.advance=original.advance; },
        activate(index, props={}) {
          const a = people[index];
          Object.assign(a,{moved:false,insideBuilding:null,behaviorState:'roaming',state:'managed',hp:100,
            age:40,_ageStart:40,_ageElapsedTicks:0,conditions:[],path:[],pathIdx:0,pathComplete:true,
            queueType:null,queueBuilding:null,waitWeeks:0,referredToHospital:false,emergencyAdmission:false,
            deathFinalized:false,healingTicksLeft:0,queueLeaveTimer:0,systemAnxiety:0,
            lifeStage:'adult',persona:null,personality:'stoic',x:DESTINATIONS.hospital.entrance.x,
            y:DESTINATIONS.hospital.entrance.y,tx:DESTINATIONS.hospital.entrance.x,ty:DESTINATIONS.hospital.entrance.y,
            ...props});
          return a;
        },
        queue(index, building, props={}) {
          const a = this.activate(index,{behaviorState:'queuing',queueType:building==='hospital'?'hospital':'gp',
            queueBuilding:building,gpName:building==='gp2_bldg'?agents.find(g=>g.id==='gp2').name:agents.find(g=>g.id==='gp1').name,
            ...props});
          QUEUES[building].agents.push(a.id);
          return a;
        },
        advance(count=1) {
          if (count > 48) throw new Error('Resource fixture tick budget exceeded');
          for (let i=0;i<count;i++) {
            const before=modelTick; tick();
            if (modelTick!==before+1) throw new Error(`Resource fixture stalled at tick ${modelTick}`);
            const s=MoC.care.snapshot();
            for (const r of Object.values(s.resources)) {
              if (r.initial+r.starts!==r.occupancy+r.releases || r.occupancy>r.slots+r.retiringSlots
                || r.completions>r.releases || r.occupancy<0) throw new Error('Resource conservation failed');
            }
            if (s.emergencyOverflow>s.emergencyOverflowBound) throw new Error('Overflow bound exceeded');
            samples.push(s);
          }
          return samples.at(-1);
        },
        restore() {
          MoC.seedTick=original.seedTick; MoC.environment.advance=original.advance;
          window.transitionDiseaseState=original.transition; Math.random=original.random;
          MoC.referencePolicy=original.referencePolicy;
        }
      };
      MoC.referencePolicy = original.referencePolicy;
      MoC.paused = false;
    });
    await run(page);
    assert.deepEqual(writes, [], 'resource tests must not publish results');
  } finally {
    await page.evaluate(() => window.resourceFixture?.restore()).catch(() => {});
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
}

async function workforceTrace(parameters) {
  let result;
  await withResourceTown(async page => {
    result = await page.evaluate(parameters => {
      Object.assign(M.IST, {admin:0,sick:0,ai:1}, parameters);
      const f = resourceFixture;
      for (let i=0;i<6;i++) f.queue(i, 'gp1_bldg');
      f.advance(16);
      const s = MoC.care.snapshot();
      return {starts:s.resources.gp1_bldg.starts,
        completions:s.resources.gp1_bldg.completions, work:s.gpService.availableWorkPerWeek,
        routineRate:s.capacity, routineStarts:s.routineStarts};
    }, parameters);
  });
  return result;
}

async function openExclusionCouncil(page, referred=true) {
  await page.evaluate(referred => {
    const a = referred ? resourceFixture.queue(0,'hospital',{waitWeeks:4,referredToHospital:true})
      : resourceFixture.activate(0);
    MoC.S._face=a;
    Object.assign(MoC.S,{pendingBeat:'digigate',quarter:2,trustC:70,trustD:70,trustP:70});
    document.getElementById('play-overlay')?.remove();
    MoC.care.sync();
    window.exclusionEpisode=MoC.care.episodes.findLast(e=>e.agentId===a.id);
    _mocForceCouncil(2);
  },referred);
  await page.locator('#moc-wiz-next').click();
}

test('F06 exclusion holds the actual referral without fabricating elapsed history', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    await openExclusionCouncil(page);
    // Keep the original callback to exercise duplicate dispatch as well as a real click.
    await page.evaluate(()=>window.exclusionButton=[...document.querySelectorAll('button')]
      .find(b=>b.textContent.includes('Hold the line')));
    await page.evaluate(()=>exclusionButton.click());
    const result=await page.evaluate(()=>{
      const a=resourceFixture.people[0], e=exclusionEpisode;
      const callbackWait=a.waitWeeks;
      exclusionButton.click();
      MoC.care.sync(); MoC.care.sync();
      const elapsed=MoC.care.elapsed(a);
      MoC.paused=false;
      resourceFixture.advance(1);
      return {callbackWait,elapsed,behavior:a.behaviorState,start:e.startTick,
        holds:e.accessHolds,bias:MoC.S._biasDeaths};
    });

    assert.equal(result.elapsed,4,'elapsed wait must remain the real four weeks');
    assert.equal(result.callbackWait,4,'exclusion must not invent six weeks of elapsed history');
    assert.equal(result.behavior,'queuing','the actual routine gate must honor the hold');
    assert.equal(result.holds.length,1,'duplicate callback must not create another hold');
    assert.equal(result.holds[0].untilTick-result.holds[0].tick,24);
    assert.equal(result.bias,1);
  });
});

test('F06 access expiry, emergency gating, mitigation and exits conserve episode chronology', {timeout:30000}, async () => {
      await withResourceTown(async page => {
        await openExclusionCouncil(page);
        await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Hold the line')).click());
        const result=await page.evaluate(()=>{
          const a=resourceFixture.people[0], e=exclusionEpisode;
          const start=e.startTick;
          MoC.paused=false;
          resourceFixture.advance(23);
          const before={state:a.behaviorState,remaining:MoC.care.accessRemaining(a),wait:MoC.care.elapsed(a)};
          resourceFixture.advance(1);
          MoC.care.sync();
          const admitted={state:a.behaviorState,wait:e.waitWeeks,status:e.status,hold:e.accessHolds[0].status,start:e.startTick};
          resourceFixture.advance(12);
          const completed=MoC.care.snapshot().resources.routine.completions;
          const b=resourceFixture.activate(1,{behaviorState:'emergency',emergencyAdmission:true,waitWeeks:4});
          MoC.care.sync();
          MoC.care.exclude(b,'emergency-test','Digital identity gate');
          MoC.care.processEmergencies(); MoC.care.sync();
          const emergencyBefore=b.behaviorState;
          MoC.care.mitigateAccess(b,'Manual exception granted');
          MoC.care.processEmergencies(); MoC.care.sync();
          const emergencyAfter=b.behaviorState;
          const exits=[];
          for (const [i,outcome] of [[2,'died_waiting'],[3,'relocated'],[4,'other_exit']]) {
            const c=resourceFixture.queue(i,'hospital',{waitWeeks:4});
            MoC.care.sync(); MoC.care.exclude(c,'exit:'+i,'Digital identity gate');
            if (outcome==='died_waiting') {c.hp=0;c.state='dead';}
            else if(outcome==='relocated') c.moved=true;
            else c.behaviorState='roaming';
            MoC.care.sync(); MoC.care.sync();
            const episode=MoC.care.episodes.findLast(x=>x.agentId===c.id);
            exits.push({status:episode.status,wait:episode.waitWeeks,hold:episode.accessHolds[0].status});
          }
          return {start,before,admitted,completed,emergencyBefore,emergencyAfter,exits};
        });
        assert.deepEqual(result.before,{state:'queuing',remaining:0.25,wait:9.75});
        assert.deepEqual(result.admitted,{state:'at_hospital',wait:10,status:'treatment_started',hold:'expired',start:result.start});
        assert.equal(result.completed,1);
        assert.equal(result.emergencyBefore,'emergency_overflow');
        assert.equal(result.emergencyAfter,'at_hospital');
        assert.deepEqual(result.exits,['died_waiting','relocated','other_exit'].map(status=>({status,wait:4,hold:'closed'})));
      });
    });

    test('F06 absent referral is recorded without manufacturing a future wait', {timeout:30000}, async () => {
      await withResourceTown(async page => {
        await openExclusionCouncil(page,false);
        await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Hold the line')).click());
        const result=await page.evaluate(()=>{
          const a=resourceFixture.people[0];
          const count=MoC.care.episodes.length;
          MoC.care.sync();
          const event=MoC.care.accessEvents.at(-1),wait=a.waitWeeks;
          a.behaviorState='going_to_hospital';a.referredToHospital=true;
          MoC.care.sync();
          return {event,wait,created:MoC.care.episodes.length-count,remaining:MoC.care.accessRemaining(a),
            elapsed:MoC.care.elapsed(a)};
        });
        assert.equal(result.event.outcome,'no_active_referral');
        assert.equal(result.event.episodeId,null);
        assert.equal(result.wait,0); assert.equal(result.remaining,0);assert.equal(result.elapsed,0);
        assert.equal(result.created,1);
      });
    });
async function openStrikeCouncil(page) {
  await page.evaluate(()=>{
    document.getElementById('play-overlay')?.remove();
    Object.assign(MoC.S,{quarter:2,_sinceQuiet:3,_dilemmaOrder:['gpstrike'],trustC:70,trustD:70,trustP:70});
    _mocForceCouncil(2);
  });
  await page.locator('#moc-wiz-next').click();
  await page.locator('#moc-opt-c').click();
}

test('F06 real manual exception and Inclusion Officer release holds without erasing elapsed wait', {timeout:30000}, async () => {
  for (const mitigation of ['manual','officer']) await withResourceTown(async page=>{
    await openExclusionCouncil(page);
    await page.locator('#moc-opt-b').click();
    if(mitigation==='manual') {
      await page.evaluate(()=>{
        document.getElementById('moc-council').remove();
        MoC.S.pendingBeat='digigate';MoC.S.quarter=3;_mocForceCouncil(3);
      });
      await page.locator('#moc-wiz-next').click();
      await page.locator('#moc-opt-a').click();
    } else {
      await page.evaluate(()=>{MoC.S.laws.dig2=1;MoC.S.budget=200000;});
      await openCouncilActions(page);
      if(await page.locator('#moc-shop-more').count())await page.locator('#moc-shop-more').click();
      await page.locator('[data-buy="inclofficer"]').click();
    }
    const state=await page.evaluate(()=>{
      const a=resourceFixture.people[0],e=exclusionEpisode;
      MoC.care.sync();
      return {elapsed:MoC.care.elapsed(a),remaining:MoC.care.accessRemaining(a),hold:e.accessHolds[0].status,
        exclusions:MoC.S._biasDeaths,mitigations:MoC.care.accessEvents.filter(e=>e.outcome==='mitigated').length};
    });
    assert.deepEqual(state,{elapsed:4,remaining:0,hold:'mitigated',exclusions:1,mitigations:1});
  });
});

test('F07 actual strike political consequence waits for logical time, not council reading', {timeout:30000}, async () => {
  await withResourceTown(async page=>{
    await openStrikeCouncil(page);
    const before=await page.evaluate(()=>({tick:modelTick,doctor:MoC.S.trustD}));
    await page.waitForTimeout(4250);
    assert.deepEqual(await page.evaluate(()=>({tick:modelTick,doctor:MoC.S.trustD})),before);
    const result=await page.evaluate(()=>{
      MoC.paused=false;
      resourceFixture.advance(3);
      const beforeDue=MoC.S.trustD;
      resourceFixture.advance(1);
      const atDue=MoC.S.trustD;
      resourceFixture.advance(2);
      return {beforeDue,atDue,after:MoC.S.trustD};
    });
    assert.deepEqual(result,{beforeDue:before.doctor,atDue:before.doctor-6,after:before.doctor-6});
  });
});

test('F07 ending cancels pending strike and stale commands cannot change final output', {timeout:30000}, async () => {
  await withResourceTown(async page=>{
    await openStrikeCouncil(page);
    const previousYears=await page.evaluate(()=>{
      window.staleFlash=document.getElementById('moc-opt-c');
      const count=MoC.S._yearResults.length;
      _mocDebug.endTerm('scandal');
      return count;
    });
    const snapshot=()=>page.evaluate(()=>({tick:modelTick,care:MoC.S._finalSnapshot,trust:MoC.S.trustD,
      budget:MoC.S.budget,score:MoC.S.liveScore,years:MoC.S._yearResults,effects:MoC.S.logicalEffects}));
    const before=await snapshot();
    await page.evaluate(()=>{
      staleFlash.click(); MoC.logicalEffects.advance(); MoC.logicalEffects.strike();
      _mocDebug.applyFx({trustD:-10,budget:-1234},'stale'); MoC.onQuarter(5); MoC.onTick(modelTick);
      _mocDebug.endTerm('served'); tick(); MoC.refreshMinistry();
    });
    await page.waitForTimeout(4250);
    assert.deepEqual(await snapshot(),before);
    assert.equal(before.effects[0].status,'cancelled');
    assert.equal(before.years.length,previousYears+1,'terminal objective settles once');
  },'?debug=1');
});

test('F07 stacked temporary care effects restore exact state without reversing permanent trust', {timeout:30000}, async () => {
  await withResourceTown(async page=>{
    await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.2,sick:0.1});
      MoC.S.quarter=2;MoC.S._sinceQuiet=3;MoC.S._dilemmaOrder=['cyberins'];
      document.getElementById('play-overlay')?.remove();
      MoC.S.timedFx.push({inverse:{admin:-0.02},untilQ:3,label:'first'},
        {inverse:{admin:-0.03},untilQ:4,label:'second'});
      _mocDebug.applyFx({admin:0.05,trustD:50},'stacked fixture');
      _mocDebug.applyFx({admin:-0.05,trustD:-10},'permanent policy');
    });
    assert.deepEqual(await page.evaluate(()=>MoC.S.timedFx.map(e=>Object.keys(e.inverse))),[['admin'],['admin']]);
    await openQuietFunding(page,3);
    assert.ok(Math.abs(await page.evaluate(()=>M.IST.admin)-0.18)<1e-12);
    await openQuietFunding(page,4);
    assert.ok(Math.abs(await page.evaluate(()=>M.IST.admin)-0.15)<1e-12);
    assert.equal(await page.evaluate(()=>MoC.S.timedFx.length),0);
  },'?debug=1');
});

test('F08 complete export includes a mid-quarter resident request and its cash consequence', {timeout:30000}, async () => {
  await withResourceTown(async page=>{
    const result=await page.evaluate(()=>{
      document.getElementById('play-overlay')?.remove();
      resourceFixture.activate(0);
      MoC.record?.begin();
      modelTick=26;cycle=MoC.STARTUP_CYCLE+modelTick;
      _mocForceFlash(0);
      const before=MoC.S.budget;
      document.getElementById('moc-fa').click();
      MoC.saveReplay();
      const record=JSON.parse(localStorage.getItem(MoC.replayKey));
      return {delta:MoC.S.budget-before,record};
    });
    assert.equal(result.delta,-5000);
    assert.ok(result.record.commandRecord?.commands.some(c=>c.kind==='request' && c.tick===26),
      'actual late resident request must be in the full export, not just displayed receipt');
    assert.ok(result.record.commandRecord.events.some(e=>e.reason.includes('Assign case manager')),
      'the cash consequence must retain its authoritative reason');
  });
});

test('F08 real short and long scenario commands replay under distinct render/pause schedules', {timeout:300000}, async t => {
  const server=await startSiteServer(),browser=await launchBrowser();
  const writes=[];
  try {
    for (const [scenario,seed] of [['cabinetcrisis',2468],['campaign',2468],['cabinetcrisis',2]]) {
      const makePage=async()=>{
        const page=await browser.newPage();
        await page.route('**/*',route=>{
          if(route.request().method()!=='GET'){writes.push(route.request().url());return route.abort();}
          if(!route.request().url().startsWith(`http://127.0.0.1:${server.address().port}/`))
            return route.fulfill({contentType:'application/json',body:'{"entries":[]}'});
          return route.continue();
        });
        await page.addInitScript(()=>{localStorage.setItem('moc_muted_v2','true');window.requestAnimationFrame=()=>0;});
        await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=${scenario}&seed=${seed}`,{waitUntil:'domcontentloaded'});
        await page.evaluate(()=>MoC.record.ready);
        return page;
      };
      const source=await makePage();
      const record=await source.evaluate(()=>{
        document.getElementById('play-overlay').remove();
        if(MoC.S.scenario==='campaign') MoC.S.promises=[0,1,2];
        MoC.S._manifestoShown=true;
        // Suppress optional publication only; never alter model/reference policy.
        MoC.S._communityPublishStarted=true;
        launchSimulation();
        const stopClock=()=>{clearInterval(autoTimer);autoTimer=null;};
        stopClock();
        const click=button=>{button.click();stopClock();};
        let actions=0;
        while(!MoC.S.over && actions++<5000) {
          if(MoC.seed===2 && MoC.S.logicalEffects.some(e=>e.status==='applied'))break;
          const flash=document.querySelector('.moc-flash');
          if(flash) {click(flash.querySelector('#moc-flash-continue') || flash.querySelector('button:not(:disabled)'));continue;}
          const year=document.getElementById('moc-yearend-btn');
          if(year){click(year);continue;}
          const vote=document.querySelector('[data-vote="promise"]');
          if(vote){click(vote);continue;}
          if(MoC.S._councilDue){click(document.getElementById('moc-town-council'));continue;}
          const council=document.getElementById('moc-council');
          if(council){
            const choices=[...council.querySelectorAll('.moc-opt:not(:disabled)')];
            if(choices.length){
              click(choices.find(b=>b.textContent.includes('Let it run')) || choices[0]);continue;
            }
            const law=council.querySelector('[data-law]:not(:disabled)');
            if(law){click(law);continue;}
            const more=document.getElementById('moc-shop-more');
            if(more){click(more);continue;}
            const priorities=MoC.S.owned.pilotgrant ? ['gpfund','mtvp','prevention','hire','resilience'] :
              ['pilotgrant','gpfund','mtvp','prevention','hire','resilience'];
            const buy=priorities.map(id=>council.querySelector(`[data-buy="${id}"]:not(:disabled)`)).find(Boolean);
            if(buy){click(buy);continue;}
            const next=document.getElementById('moc-wiz-next');
            if(next&&!next.disabled){click(next);continue;}
            throw new Error('Unresolved council at '+modelTick);
          }
          MoC.paused=false;
          const previous=modelTick;tick();
          if(modelTick!==previous+1)throw new Error('Stalled at '+modelTick);
          stopClock();
        }
        if(!MoC.S.over && !(MoC.seed===2 && MoC.S.logicalEffects.some(e=>e.status==='applied')))
          throw new Error('Recorded player exceeded bounded action budget');
        return MoC.record.export();
      });
      assert.ok(record.commands.some(c=>c.kind==='request'),'real mid-quarter request recorded');
      assert.ok(record.commands.some(c=>c.kind==='decision'));
      assert.ok(record.commands.some(c=>c.kind==='law'));
      assert.ok(record.commands.some(c=>c.kind==='purchase'));
      const deliveries=record.events.filter(e=>e.kind==='effect' && /Effect ended:|Strike ends bitter/.test(e.reason));
      t.diagnostic(`${scenario} seed ${seed}: ${record.tick} ticks, ${record.ending}, ${record.commands.length} commands, ${record.events.length} events; deliveries: ${deliveries.map(e=>e.reason).join(', ')}`);
      if(scenario==='campaign')assert.ok(deliveries.length,'long scenario must actually replay delayed effects/expiry');
      if(seed===2)assert.ok(deliveries.some(e=>/Strike ends bitter/.test(e.reason)),'actual strike consequence must replay at its logical boundary');
      const target=await makePage();
      const savedHistory=await target.evaluate(record=>{
        const history=JSON.stringify([{seed:record.inputs.seed,scenario:record.inputs.scenario,endTick:record.tick,
          score:777,livesSaved:2,systemDeaths:9,endReason:'prior attempt',verdict:'prior verdict'}]);
        localStorage.setItem('moc_runs_'+MoC.MODEL_VERSION,history);
        return history;
      },record);
      if(record.ending)await target.waitForFunction(()=>MoC.baselineFrame?.contentWindow,null,{timeout:15000,polling:100});
      const replay=await target.evaluate(record=>MoC.record.run(record,{renderEvery:3,pauseMs:5}),record);
      assert.deepEqual(replay.snapshot,record.final);
      assert.equal(replay.commands,record.commands.length);
      if(record.ending){
        const late=await target.evaluate(()=>{
          const share=document.getElementById('moc-sharetext');
          share.textContent='Awaiting late reference';
          const payload={type:'mocBaseline',seed:MoC.seed,scenario:MoC.S.scenario,
            modelVersion:MoC.MODEL_VERSION,protocol:MoC.REFERENCE_PROTOCOL,
            scheduleId:MoC.environment.scheduleId,snapshots:MoC.runSnapshots,tick:modelTick};
          window.dispatchEvent(new MessageEvent('message',{origin:location.origin,
            source:MoC.baselineFrame.contentWindow,data:payload}));
          return {accepted:MoC.baseline===payload,share:share.textContent,
            history:localStorage.getItem('moc_runs_'+MoC.MODEL_VERSION)};
        });
        assert.equal(late.accepted,true,'late reference must reach the real replay callback');
        assert.notEqual(late.share,'Awaiting late reference','comparison sharing must still refresh');
        assert.equal(late.history,savedHistory,'replay and late references must not rewrite another saved attempt');
      }
      await source.close();await target.close();
    }
    assert.deepEqual(writes,[],'recorded tests and replay must not submit scores');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('F08 incompatible, reordered, unavailable and altered records fail visibly without publication', {timeout:120000}, async () => {
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage();
  const writes=[];
  await page.route('**/*',route=>{
    if(route.request().method()!=='GET'){writes.push(route.request().url());return route.abort();}
    if(!route.request().url().startsWith(`http://127.0.0.1:${server.address().port}/`))
      return route.fulfill({contentType:'application/json',body:'{"entries":[]}'});
    return route.continue();
  });
  const url=`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`;
  const open=async()=>{await page.goto('about:blank');await page.goto(url,{waitUntil:'domcontentloaded'});await page.evaluate(()=>MoC.record.ready);};
  try {
    await open();
    const record=await page.evaluate(()=>{
      document.getElementById('play-overlay').remove();MoC.S._manifestoShown=true;
      launchSimulation();clearInterval(autoTimer);autoTimer=null;
      for(let i=0;i<16;i++)tick();
      document.querySelector('.moc-flash button:not(:disabled)').click();
      document.getElementById('moc-flash-continue').click();
      clearInterval(autoTimer);autoTimer=null;
      for(let i=0;i<4;i++)tick();
      return MoC.record.export();
    });
    for (const field of ['schema','eventSchema','replayVersion','modelVersion','executableId']) {
      await open();
      const error=await page.evaluate(async ({record,field})=>{
        record[field]='incompatible';
        try{await MoC.record.run(record);return null;}catch(e){return e.message;}
      },{record,field});
      assert.match(error,/incompatible/);
      assert.match(await page.locator('#moc-record-status').innerText(),/Replay refused/);
      assert.equal(await page.evaluate(()=>modelTick),0);
    }
    for (const mutation of ['order','unavailable','initial','effect','missing','selector']) {
      await open();
      const error=await page.evaluate(async ({record,mutation})=>{
        if(mutation==='order')record.commands[1].order=record.commands[0].order;
        if(mutation==='unavailable')record.commands[0].selector='[data-buy="hire"]';
        if(mutation==='initial')record.initial.government.budget++;
        if(mutation==='effect')record.events.at(-1).data.stateHash='altered';
        if(mutation==='missing')record.commands=[];
        if(mutation==='selector')record.commands[0].selector='#moc-export-record';
        try{await MoC.record.run(record);return null;}catch(e){return e.message;}
      },{record,mutation});
      assert.match(error,/Replay refused/,mutation);
      assert.match(await page.locator('#moc-record-status').innerText(),/Replay refused/);
    }
    await open();
    await page.evaluate(record=>MoC.record.run(record,{renderEvery:1}),record);
    const before=await page.evaluate(()=>MoC.record.snapshot());
    const repeated=await page.evaluate(async record=>{
      try{await MoC.record.run(record);return null;}catch(e){return e.message;}
    },record);
    assert.match(repeated,/fresh matching town/);
    assert.deepEqual(await page.evaluate(()=>MoC.record.snapshot()),before);
    assert.deepEqual(writes,[]);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('F05 aggregate absence reduces actual GP service', {timeout:30000}, async t => {
  const low = await workforceTrace({sick:0.1}), high = await workforceTrace({sick:0.8});
  assert.ok(low.completions > high.completions, JSON.stringify({low,high}));
  assert.equal(low.routineRate,high.routineRate);
  assert.equal(low.routineStarts,0);
  t.diagnostic(JSON.stringify({low,high}));
});

test('F05 productivity increases actual unconstrained GP service', {timeout:30000}, async t => {
  const base = await workforceTrace({ai:1}), productive = await workforceTrace({ai:3});
  assert.ok(productive.completions > base.completions, JSON.stringify({base,productive}));
  assert.equal(productive.work,base.work*3);
  assert.equal(productive.routineRate,base.routineRate);
  t.diagnostic(JSON.stringify({base,productive}));
});

test('F05 administration changes actual GP work and overdue drain only once', {timeout:30000}, async t => {
  const low = await workforceTrace({admin:0.1}), high = await workforceTrace({admin:0.8});
  assert.ok(low.completions > high.completions, JSON.stringify({low,high}));
  assert.equal(low.routineRate,high.routineRate);
  await withResourceTown(async page => {
    const result = await page.evaluate(() => {
      const cond = {code:'I25',severity:'moderate'}, p={...M.IST,admin:0.5};
      const a=resourceFixture.activate(0,{conditions:[cond],personality:'stoic',waitWeeks:14});
      const noAdmin=calculateHPDrain(cond,'moderate',14,{...p,admin:0},a);
      const withAdmin=calculateHPDrain(cond,'moderate',14,p,a);
      Object.assign(M.IST,p);
      return {extra:withAdmin-noAdmin, expected:3*2*0.5/4,
        drain:withAdmin, html:buildDrainBreakdown(a),
        healthy:overdueWaitDrainPerTick(14,12,'healthy',0.5),
        deceased:overdueWaitDrainPerTick(14,12,'deceased',0.5)};
    });
    assert.ok(Math.abs(result.extra-result.expected)<1e-9);
    assert.equal(result.healthy,0,'healthy severity multiplier zero must not become one');
    assert.equal(result.deceased,2.25,'preserve the existing non-finalizing condition-state factor');
    assert.ok(result.html.includes(result.drain.toFixed(3)+' HP/tick'));
    assert.match(result.html,/included in overdue wait penalty only/);
  });
  t.diagnostic(JSON.stringify({low,high}));
});

test('F05 combined workforce effects count named absences once and preserve zero service', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    const result = await page.evaluate(() => {
      const f=resourceFixture, gp1=agents.find(a=>a.id==='gp1'), gp2=agents.find(a=>a.id==='gp2');
      const a=f.activate(0,{behaviorState:'at_gp',insideBuilding:'gp1_bldg',stateTimer:100});
      const b=f.activate(1,{behaviorState:'at_gp',insideBuilding:'gp2_bldg',stateTimer:100});
      Object.assign(M.IST,{admin:0.25,sick:0.6,ai:2});
      MoC.care.sync(); f.advance();
      const both={a:a.stateTimer,b:b.stateTimer,work:MoC.care.snapshot().gpService.availableWorkPerWeek};
      gp2.sickLeaveTimer=10;
      const before=a.stateTimer; f.advance();
      const one={delta:before-a.stateTimer,b:b.stateTimer,work:gpServiceCapacity().availableWorkPerWeek};
      M.IST.sick=0.25; // one named absence already exceeds the aggregate floor
      const beforeNamed=a.stateTimer; f.advance();
      const named=beforeNamed-a.stateTimer;
      M.IST.sick=1;
      const stopped=a.stateTimer; f.advance();
      const fullAbsence=a.stateTimer===stopped;
      M.IST.sick=0; M.IST.admin=1; f.advance();
      const fullAdmin=a.stateTimer===stopped;
      gp1.sickLeaveTimer=10; M.IST.admin=0; M.IST.ai=1e6;
      f.advance();
      const allAbsent=gpServiceCapacity().availableWorkPerWeek;
      return {both,one,named,fullAbsence,fullAdmin,allAbsent};
    });
    assert.ok(Math.abs(result.both.a-99.4)<1e-9);
    assert.ok(Math.abs(result.both.b-99.4)<1e-9);
    assert.ok(Math.abs(result.both.work-4.8)<1e-9);
    assert.ok(Math.abs(result.one.delta-1.2)<1e-9);
    assert.equal(result.one.b,result.both.b);
    assert.ok(Math.abs(result.one.work-4.8)<1e-9);
    assert.equal(result.named,1.5,'named half-roster absence is not charged another 25%');
    assert.equal(result.fullAbsence,true);
    assert.equal(result.fullAdmin,true);
    assert.equal(result.allAbsent,0);
  });
  for (const parameters of [{sick:1},{admin:1}]) {
    const trace=await workforceTrace(parameters);
    assert.equal(trace.starts,0);
    assert.equal(trace.completions,0);
    assert.equal(trace.work,0);
  }
});

test('F05 recruitment changes routine starts and places but a downstream constraint can absorb GP gains', {timeout:30000}, async t => {
  const traces=[];
  for (const capacity of [0.25,1.25]) {
    await withResourceTown(async page => {
      traces.push(await page.evaluate(capacity => {
        const f=resourceFixture;
        _mocDebug.applyFx({capacity:capacity-MoC.S.specialistCapacity});
        for(let i=0;i<6;i++) f.queue(i,'hospital',{referredToHospital:true});
        MoC.care.sync(); f.advance(16);
        const s=MoC.care.snapshot();
        return {starts:s.routineStarts,places:s.resources.routine.slots,work:s.gpService.availableWorkPerWeek};
      },capacity));
    },'?debug=1');
  }
  assert.equal(traces[0].starts,1);
  assert.equal(traces[1].starts,4,'existing capped routine credit yields one start per four ticks at 1.25/week');
  assert.equal(traces[0].places,1);
  assert.equal(traces[1].places,4);
  assert.equal(traces[0].work,traces[1].work);
  const constrained=[];
  for(const ai of [1,3]) {
    await withResourceTown(async page => {
      constrained.push(await page.evaluate(ai => {
        M.IST.ai=ai;
        const f=resourceFixture;
        f.activate(0,{behaviorState:'at_hospital',insideBuilding:'hospital',stateTimer:100});
        for(let i=1;i<7;i++) f.queue(i,'gp1_bldg',{hp:55,
          conditions:[{code:'I25',name:'Heart disease',severity:'moderate'}]});
        MoC.care.sync();
        // Real consultation/referral paths; remove only geographic travel as a separate bottleneck.
        for(let i=0;i<16;i++){
          f.people.filter(a=>a.behaviorState==='going_to_hospital').forEach(a=>{
            a.path=[]; a.pathIdx=0; a.pathComplete=true;
          });
          f.advance();
        }
        const s=MoC.care.snapshot();
        return {gp:s.resources.gp1_bldg.completions,routine:s.routineStarts,
          waiting:s.waiting,credit:MoC.S.serviceCredit};
      },ai));
    });
  }
  assert.ok(constrained[1].gp>constrained[0].gp);
  assert.equal(constrained[0].routine,0);
  assert.equal(constrained[1].routine,0,'full downstream routine place prevents starts despite GP gains');
  assert.equal(constrained[0].credit,1);
  assert.equal(constrained[1].credit,1);
  t.diagnostic(JSON.stringify({hiring:traces,constrained}));
});

test('F05 bounds reject atomically, retain legitimate zeros and preview adoption mechanisms', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    const result=await page.evaluate(() => {
      const errors=[];
      const check=(fn)=>{try {fn();return false;}catch(e){errors.push(e.message);return e instanceof RangeError;}};
      const p={...M.IST};
      const invalid=[
        ...['admin','sick'].flatMap(key=>[-0.01,1.01,NaN,Infinity].map(v=>()=>validateCareParameters({...p,[key]:v}))),
        ...['ai','drain'].flatMap(key=>[0,-1,NaN,Infinity].map(v=>()=>validateCareParameters({...p,[key]:v}))),
        ...[0,0.249,Infinity,NaN,Number.MAX_VALUE].map(v=>()=>validateCareParameters(p,v)),
        ...[-0.01,1.01,NaN,Infinity].map(v=>()=>validateCareParameters(p,0.25,v)),
        ()=>validateCareParameters({...p,ai:Number.MAX_VALUE}),
        ()=>overdueWaitDrainPerTick(14,12,'unknown',0)
      ].map(fn=>check(fn));
      validateCareParameters({...p,admin:0,sick:0,ai:Number.MIN_VALUE,drain:Number.MIN_VALUE},0.25,0);
      const before={...M.IST},budget=MoC.S.budget;
      const rejected=[{admin:-0.01},{sick:1.01},{capacity:-0.01},{ai:NaN},{drainMult:0}]
        .map(fx=>_mocDebug.applyFx({...fx,budget:100})===false);
      const atomic=JSON.stringify(before)===JSON.stringify(M.IST)&&budget===MoC.S.budget;
      MoC.S.adoptionRate=0;
      const zero=MoC.previewPolicy('scribes2');
      const zeroMesh=MoC.previewPolicy('a2a'),zeroTwin=MoC.previewPolicy('twin');
      MoC.S.adoptionRate=1;
      const full=MoC.previewPolicy('scribes2');
      MoC.S.adoptionRate=0.5;
      const half=MoC.previewPolicy('scribes2');
      Object.assign(M.IST,{admin:0.3,sick:0.1,ai:1,drain:1});
      const applied=_mocDebug.applyFx(half);
      const after={admin:M.IST.admin,ai:M.IST.ai,rate:MoC.S.specialistCapacity,drain:M.IST.drain};
      // Exact zero outcomes remain zero, with no 3%/2% floor or rounding.
      const zeroApplied=_mocDebug.applyFx({admin:-M.IST.admin,sick:-M.IST.sick});
      const zeros={admin:M.IST.admin,sick:M.IST.sick};
      const tiny=_mocDebug.applyFx({drainMult:0.001});
      const tinyDrain=M.IST.drain;
      const url=location.href;
      history.replaceState(null,'','?admin=0&sick=0&ai=1.5&drain=0.001'+location.hash);
      applyURLParams();
      const urlZeros={admin:M.IST.admin,sick:M.IST.sick,ai:M.IST.ai,drain:M.IST.drain};
      history.replaceState(null,'','?admin=0.3&sick=NaN'+location.hash);
      const urlBefore=JSON.stringify(M.IST);
      applyURLParams();
      const urlAtomic=urlBefore===JSON.stringify(M.IST);
      history.replaceState(null,'',url);
      // Invalid direct state cannot advance time or allocate service.
      M.IST.sick=Infinity;
      const tickBefore=modelTick; tick();
      const stalled=modelTick===tickBefore&&MoC.paused;
      M.IST.sick=0;
      return {invalid,errors,rejected,atomic,zero,zeroMesh,zeroTwin,full,half,applied,after,
        zeroApplied,zeros,tiny,tinyDrain,urlZeros,urlAtomic,stalled,error:MoC.lastInputError};
    });
    assert.ok(result.invalid.every(Boolean));
    assert.ok(result.errors.every(message=>message.startsWith('Invalid care input:')));
    assert.ok(result.rejected.every(Boolean));
    assert.equal(result.atomic,true);
    assert.equal(result.zero.ai,0);
    assert.equal(result.zero.admin,0.01,'zero adoption retains declared temporary rollout paperwork');
    assert.equal(result.zeroMesh.capacity,0);
    assert.equal(result.zeroTwin.drainMult,1);
    assert.equal(result.full.ai,0.1);
    assert.equal(result.full.admin,-0.07);
    assert.equal(result.half.ai,0.05);
    assert.ok(Math.abs(result.half.admin+0.025)<1e-9);
    assert.equal(result.applied,true);
    assert.ok(Math.abs(result.after.admin-0.275)<1e-9);
    assert.equal(result.after.ai,1.05);
    assert.equal(result.after.rate,0.25);
    assert.equal(result.after.drain,1);
    assert.equal(result.zeroApplied,true);
    assert.deepEqual(result.zeros,{admin:0,sick:0});
    assert.equal(result.tiny,true);
    assert.equal(result.tinyDrain,0.001);
    assert.deepEqual(result.urlZeros,{admin:0,sick:0,ai:1.5,drain:0.001});
    assert.equal(result.urlAtomic,true);
    assert.equal(result.stalled,true);
    assert.match(result.error,/Invalid care input: sick/);
  },'?debug=1');
});

test('F05 zero-adoption shop preview executes its named effects and invalid offers are unavailable', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    page.setDefaultTimeout(4000);
    await page.evaluate(() => {
      Object.assign(M.IST,{admin:0.3,sick:0.1,ai:1});
      MoC.S.adoptionRate=0; MoC.S.budget=1000000;
      document.getElementById('play-overlay')?.remove();
      _mocForceCouncil(2);
    });
    await openCouncilActions(page);
    const before=await page.evaluate(()=>({p:{...M.IST},fx:MoC.previewPolicy('scribes1'),rate:MoC.S.specialistCapacity}));
    await page.locator('[data-buy="scribes1"]').click();
    const after=await page.evaluate(()=>({p:{...M.IST},rate:MoC.S.specialistCapacity,owned:MoC.S.owned.scribes1}));
    assert.equal(after.owned,1);
    assert.ok(Math.abs(after.p.admin-before.p.admin-before.fx.admin)<1e-9);
    assert.equal(after.p.ai,before.p.ai);
    assert.equal(after.rate,before.rate);
    assert.match(await page.evaluate(()=>MoC.S._policyReceipt),/Care outcomes are not guaranteed/);
    // Full adoption at zero paperwork would make another reduction invalid.
    // Re-open the real council UI so availability is computed from that state.
    await page.evaluate(() => {
      document.getElementById('moc-council')?.remove();
      M.IST.admin=0; MoC.S.adoptionRate=1; MoC.S.buysThisCouncil=0;
      _mocForceCouncil(3);
    });
    await openCouncilActions(page);
    const offer=page.locator('.moc-item').filter({has:page.locator('[data-buy="scribes2"]')});
    assert.equal(await page.locator('[data-buy="scribes2"]').isDisabled(),true);
    assert.match(await offer.innerText(),/Unavailable: Invalid care input: admin/);
  });
});

async function openRansomwareCouncil(page, capacity=0.5, admin=0.3) {
  page.setDefaultTimeout(5000);
  await page.evaluate(({capacity,admin}) => {
    Object.assign(M.IST,{admin,sick:0.1,ai:1});
    Object.assign(MoC.S,{specialistCapacity:capacity,dependence:8,budget:200000,quarter:2,
      trust:70,trustC:70,trustD:70,trustP:70});
    MoC.S.owned.scribes1=1;
    document.getElementById('play-overlay')?.remove();
    const rng=MoC.mulberry32;
    try { MoC.mulberry32=()=>()=>0.7; _mocForceCouncil(2); }
    finally { MoC.mulberry32=rng; }
  },{capacity,admin});
  await page.locator('#moc-wiz-next').click();
  assert.match(await page.locator('#moc-wiz-body').innerText(),/RANSOMWARE/);
}

test('F05 review invalid complete council choices cannot charge repeatedly or deadlock funding', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    await openRansomwareCouncil(page);
    const snapshot=()=>page.evaluate(()=>({budget:MoC.S.budget,p:{...M.IST},rate:MoC.S.specialistCapacity,
      trust:[MoC.S.trustC,MoC.S.trustD,MoC.S.trustP],timed:MoC.S.timedFx,delayed:MoC.S.delayed,
      interventions:MoC.S.interventions}));
    const before=await snapshot();
    const negotiate=page.locator('[data-evtopt="0"]');
    for(let i=0;i<2;i++) if (!await negotiate.isDisabled()) await negotiate.click();
    const after=await snapshot();
    assert.deepEqual(after,before,'rejected complete choice must not charge or install a partial effect');
    assert.equal(await negotiate.isDisabled(),true);
    assert.equal(await page.locator('[data-evtopt="1"]').isDisabled(),true);
    assert.match(await page.locator('#moc-wiz-body').innerText(),/Unavailable: Invalid care input: capacity/);
    await page.locator('#moc-defer-decision').click();
    assert.equal(await page.locator('#moc-wiz-next').isDisabled(),false);
    await page.locator('#moc-wiz-next').click();
    await page.locator('#moc-wiz-next').click();
    assert.equal(await page.locator('#moc-shop').count(),1);
    assert.deepEqual(await snapshot(),before,'explicit unavailable-choice deferral has no policy effects');
  });
});

test('F05 review temporary expiry is reserved before accepting a permanent policy', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    await openRansomwareCouncil(page,1,0.02);
    await page.locator('[data-evtopt="0"]').click();
    const result=await page.evaluate(()=>{
      const before={budget:MoC.S.budget,admin:M.IST.admin,timed:JSON.stringify(MoC.S.timedFx)};
      const accepted=_mocDebug.applyFx({admin:-0.04,budget:-1000});
      return {accepted,before,after:{budget:MoC.S.budget,admin:M.IST.admin,timed:JSON.stringify(MoC.S.timedFx)}};
    });
    assert.equal(result.accepted,false,'a permanent reduction must not consume temporary paperwork that expires');
    assert.deepEqual(result.after,result.before);
    await page.evaluate(()=>{
      document.getElementById('moc-council')?.remove();
      MoC.S._sinceQuiet=3; MoC.S.quarter=3; _mocForceCouncil(3);
    });
    const expired=await page.evaluate(()=>({admin:M.IST.admin,timed:MoC.S.timedFx.length}));
    assert.ok(Math.abs(expired.admin-0.02)<1e-9);
    assert.equal(expired.timed,0);
  },'?debug=1');
});

test('F05 review delayed delivery is validated before any decision cost', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.02,sick:0.1,ai:1});
      Object.assign(MoC.S,{budget:200000,quarter:2,_sinceQuiet:3,_dilemmaOrder:['buildorbuy']});
      document.getElementById('play-overlay')?.remove(); _mocForceCouncil(2);
    });
    await page.locator('#moc-wiz-next').click();
    const build=page.locator('#moc-opt-b');
    const before=await page.evaluate(()=>({budget:MoC.S.budget,delayed:MoC.S.delayed,trust:MoC.S.trustD}));
    if (!await build.isDisabled()) await build.click();
    assert.deepEqual(await page.evaluate(()=>({budget:MoC.S.budget,delayed:MoC.S.delayed,trust:MoC.S.trustD})),before);
    assert.equal(await build.isDisabled(),true);
    assert.match(await build.innerText(),/Unavailable:/);
  },'','campaign');
});

async function openQuietFunding(page,q) {
  await page.evaluate(q=>{
    document.getElementById('play-overlay')?.remove();
    document.getElementById('moc-council')?.remove();
    Object.assign(MoC.S,{quarter:q,_sinceQuiet:3,_dilemmaOrder:[['cyberins','insurer','locum'][q-2]]});
    _mocForceCouncil(q);
  },q);
  await openCouncilActions(page);
  if (await page.locator('#moc-shop-more').count()) await page.locator('#moc-shop-more').click();
}

test('F05 scope post-term in-house delivery cannot block a valid council law', {timeout:30000}, async()=>{
  await withResourceTown(async page=>{
    page.setDefaultTimeout(4000);
    await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.04,sick:0.1,ai:1});
      Object.assign(MoC.S,{budget:200000,quarter:2,_sinceQuiet:3,_dilemmaOrder:['buildorbuy']});
      document.getElementById('play-overlay')?.remove(); _mocForceCouncil(2);
    });
    await page.locator('#moc-wiz-next').click();
    await page.locator('#moc-opt-b').click();
    assert.equal(await page.evaluate(()=>MoC.S.delayed[0].atQ),10);
    await page.locator('#moc-wiz-next').click();
    const law=page.locator('[data-law="work1"]');
    assert.equal(await law.isDisabled(),false,'Q10 delivery cannot reserve admin beyond the Q8 terminal horizon');
    await law.click();
    assert.ok(Math.abs(await page.evaluate(()=>M.IST.admin)-0.01)<1e-15);
  });
});

test('F05 scope work-to-rule begin, real policy choices and recovery preserve the conditional obligation', {timeout:30000}, async()=>{
  await withResourceTown(async page=>{
    page.setDefaultTimeout(4000);
    await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.2,sick:0.01,ai:1});
      Object.assign(MoC.S,{budget:1000000,trustC:70,trustP:70,trustD:32,quarter:2,
        _sinceQuiet:3,_dilemmaOrder:['overtime']});
      document.getElementById('play-overlay')?.remove(); _mocForceCouncil(2);
    });
    assert.deepEqual(await page.evaluate(()=>({sick:M.IST.sick,wtr:MoC.S.activeStates.docWTR})),{sick:0.03,wtr:true});
    await page.locator('#moc-wiz-next').click();
    const overtime=page.locator('#moc-opt-a');
    const overtimeDisabled=await overtime.isDisabled();
    if (!overtimeDisabled) await overtime.click(); // reproduces the pinned lost-inverse path
    else await page.locator('#moc-opt-b').click();
    await page.locator('#moc-wiz-next').click(); await page.locator('#moc-wiz-next').click();
    if (await page.locator('#moc-shop-more').count()) await page.locator('#moc-shop-more').click();
    await page.locator('[data-buy="gpfund"]').click();
    // The safe alternative refusal lowers trust. A real no-cost accountability
    // council decision restores it without spending any conditional absence.
    await page.evaluate(()=>{
      document.getElementById('moc-council')?.remove();
      Object.assign(MoC.S,{quarter:3,_sinceQuiet:3,_dilemmaOrder:['press']}); _mocForceCouncil(3);
    });
    await page.locator('#moc-wiz-next').click(); await page.locator('#moc-opt-a').click();
    await page.evaluate(()=>{
      document.getElementById('moc-council')?.remove();
      Object.assign(MoC.S,{quarter:4,_sinceQuiet:3,_dilemmaOrder:['cyberins']}); _mocForceCouncil(4);
    });
    assert.equal(overtimeDisabled,true,'overtime must not consume the absence reserved for morale recovery');
    assert.equal(await page.evaluate(()=>MoC.careInputErrorCount || 0),0);
    assert.equal(await page.evaluate(()=>MoC.S.activeStates.docWTR),false);
    assert.ok(Math.abs(await page.evaluate(()=>M.IST.sick)-0.02)<1e-15);
  });
});

test('F05 scope quarter obligations execute at the last council but not the terminal tick in both scenarios', {timeout:30000}, async()=>{
  for (const scenario of ['cabinetcrisis','campaign']) {
    await withResourceTown(async page=>{
      page.setDefaultTimeout(4000);
      const projection=await page.evaluate(()=>{
        const n=MoC.TOTAL_QUARTERS;
        Object.assign(M.IST,{admin:0.04,sick:0.1,ai:1});
        Object.assign(MoC.S,{budget:1000000,trustC:70,trustD:70,trustP:70,quarter:n-1,
          _sinceQuiet:3,_dilemmaOrder:['cyberins'],delayed:[
            {atQ:n,fx:{admin:-0.01},label:'Last executable council'},
            {atQ:n+1,fx:{admin:-0.03},label:'Preempted terminal council'}
          ]});
        document.getElementById('play-overlay')?.remove();
        return _mocDebug.applyFx({admin:-0.02});
      });
      assert.equal(projection,true,scenario+': only the executable delivery reserves admin');
      await page.evaluate(()=>{
        modelTick=(MoC.TOTAL_QUARTERS-1)*MoC.QUARTER_TICKS-1;
        cycle=MoC.STARTUP_CYCLE+modelTick; MoC.paused=false; tick();
      });
      if (await page.locator('#moc-council-ready-banner button').count())
        await page.locator('#moc-council-ready-banner button').click();
      assert.equal(await page.locator('#moc-council').count(),1);
      assert.ok(Math.abs(await page.evaluate(()=>M.IST.admin)-0.01)<1e-15);
      const terminal=await page.evaluate(()=>{
        document.getElementById('moc-council')?.remove();
        modelTick=MoC.TOTAL_QUARTERS*MoC.QUARTER_TICKS-1;
        cycle=MoC.STARTUP_CYCLE+modelTick; MoC.paused=false; tick();
        return {over:MoC.S.over,admin:M.IST.admin,delayed:MoC.S.delayed.length,
          errors:MoC.careInputErrorCount || 0,tick:modelTick};
      });
      assert.equal(terminal.over,true);
      assert.equal(terminal.tick,scenario==='campaign'?2080:416);
      assert.ok(Math.abs(terminal.admin-0.01)<1e-15);
      assert.equal(terminal.delayed,1);
      assert.equal(terminal.errors,0);
    },'?debug=1',scenario);
  }
});

test('F05 scope environmental inverses still reserve and execute on the terminal tick in both scenarios', {timeout:30000}, async()=>{
  for (const scenario of ['cabinetcrisis','campaign']) {
    await withResourceTown(async page=>{
      const start=await page.evaluate(()=>{
        const n=MoC.TOTAL_QUARTERS;
        Object.assign(M.IST,{admin:0.2,sick:0,drain:1,ai:1});
        Object.assign(MoC.S,{budget:1000000,trustC:70,trustD:70,trustP:70,specialistCapacity:2,
          quarter:n-1,_sinceQuiet:3,_dilemmaOrder:['cyberins']});
        document.getElementById('play-overlay')?.remove();
        resourceFixture.enableEnvironment();
        modelTick=(n-1)*MoC.QUARTER_TICKS-1; cycle=MoC.STARTUP_CYCLE+modelTick;
        MoC.paused=false; tick();
        const shock=MoC.environment.log.at(-1),sick=M.IST.sick;
        const accepted=_mocDebug.applyFx({sick:-sick/2});
        return {shock,sick,accepted,after:M.IST.sick};
      });
      assert.equal(start.shock.kind,'flu');
      assert.equal(start.shock.endTick,scenario==='campaign'?2080:416);
      assert.ok(start.sick>0);
      assert.equal(start.accepted,false,'the terminal environment callback must still be reserved');
      assert.equal(start.after,start.sick);
      const ended=await page.evaluate(()=>{
        const errors=MoC.careInputErrorCount || 0;
        document.getElementById('moc-council')?.remove();
        modelTick=MoC.TOTAL_QUARTERS*MoC.QUARTER_TICKS-1; cycle=MoC.STARTUP_CYCLE+modelTick;
        MoC.paused=false; tick();
        return {over:MoC.S.over,sick:M.IST.sick,drain:M.IST.drain,errors:(MoC.careInputErrorCount || 0)-errors};
      });
      assert.equal(ended.over,true);
      assert.equal(ended.sick,0);
      assert.ok(Math.abs(ended.drain-1)<1e-15);
      assert.equal(ended.errors,0);
    },'?debug=1',scenario,13);
  }
});

test('F05 scope conditional and dated recoveries are feasible together at every prefix', {timeout:30000}, async()=>{
  await withResourceTown(async page=>{
    await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.2,sick:0.01,ai:1});
      Object.assign(MoC.S,{budget:1000000,trustC:70,trustP:70,trustD:19,quarter:2,
        _sinceQuiet:3,_dilemmaOrder:['overtime']});
      document.getElementById('play-overlay')?.remove(); _mocForceCouncil(2);
    });
    const result=await page.evaluate(()=>{
      const before={sick:M.IST.sick,budget:MoC.S.budget};
      // Either inverse alone would fit after this reduction; together they do not.
      const accepted=_mocDebug.applyFx({sick:-0.02,budget:-1000});
      return {accepted,before,after:{sick:M.IST.sick,budget:MoC.S.budget},
        wtr:MoC.S.activeStates.docWTR,struck:MoC.S.activeStates.struck,timed:MoC.S.timedFx};
    });
    assert.ok(Math.abs(result.before.sick-0.09)<1e-15);
    assert.equal(result.wtr,true); assert.equal(result.struck,true);
    assert.equal(result.timed.length,1);
    assert.equal(result.accepted,false);
    assert.deepEqual(result.after,result.before);
  },'?debug=1');
  await withResourceTown(async page=>{
    await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.2,sick:0.01,ai:1});
      Object.assign(MoC.S,{budget:1000000,trustC:70,trustP:70,trustD:32,quarter:2,
        _sinceQuiet:3,_dilemmaOrder:['overtime'],
        delayed:[{atQ:4,fx:{sick:0.03},label:'Later staffing pressure'}]});
      document.getElementById('play-overlay')?.remove(); _mocForceCouncil(2);
    });
    assert.equal(await page.evaluate(()=>_mocDebug.applyFx({sick:-0.02})),false,
      'Q4 positive pressure must not fund a possible Q3 morale recovery');
    assert.ok(Math.abs(await page.evaluate(()=>M.IST.sick)-0.03)<1e-15);
  },'?debug=1');
});

test('F05 scope conditional recovery failures retain flags and obligations until a successful retry', {timeout:30000}, async()=>{
  await withResourceTown(async page=>{
    await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.2,sick:0.01,drain:1,ai:1});
      Object.assign(MoC.S,{budget:1000000,trustC:32,trustP:70,trustD:32,quarter:2,
        _sinceQuiet:3,_dilemmaOrder:['cyberins']});
      document.getElementById('play-overlay')?.remove(); _mocForceCouncil(2);
    });
    assert.deepEqual(await page.evaluate(()=>MoC.S.activeStates),{docWTR:true,citAvoid:true});
    // Inconsistent restored state: legal raw fraction but insufficient to honor
    // the already installed inverse. Normal player policies cannot create it.
    await page.evaluate(()=>{
      M.IST.sick=0.01;
      document.getElementById('moc-council')?.remove();
      Object.assign(MoC.S,{trustD:70,trustC:70,quarter:3,_sinceQuiet:3,_dilemmaOrder:['locum']});
      _mocForceCouncil(3);
    });
    assert.deepEqual(await page.evaluate(()=>MoC.S.activeStates),{docWTR:true,citAvoid:true});
    assert.equal(await page.evaluate(()=>M.IST.sick),0.01);
    assert.equal(await page.evaluate(()=>M.IST.drain),1.12);
    assert.match(await page.evaluate(()=>MoC.lastInputError),/Invalid care input: sick/);
    await page.evaluate(()=>{
      M.IST.sick=0.03;
      document.getElementById('moc-council')?.remove();
      Object.assign(MoC.S,{quarter:4,_sinceQuiet:3,_dilemmaOrder:['press']}); _mocForceCouncil(4);
    });
    assert.deepEqual(await page.evaluate(()=>MoC.S.activeStates),{docWTR:false,citAvoid:false});
    assert.ok(Math.abs(await page.evaluate(()=>M.IST.sick)-0.01)<1e-15);
    assert.equal(await page.evaluate(()=>M.IST.drain),1);
  });
});

test('F05 scope rejected morale onsets do not install flags or strike obligations', {timeout:30000}, async()=>{
  for (const kind of ['work-to-rule','citizen','strike']) {
    await withResourceTown(async page=>{
      await page.evaluate(kind=>{
        Object.assign(M.IST,{admin:kind==='strike'?0.98:0.2,sick:kind==='work-to-rule'?0.99:0.01,
          drain:kind==='citizen'?Number.MAX_VALUE:1,ai:1});
        Object.assign(MoC.S,{budget:1000000,trustC:kind==='citizen'?32:70,trustP:70,
          trustD:kind==='strike'?20:kind==='work-to-rule'?32:70,quarter:2,
          _sinceQuiet:3,_dilemmaOrder:['cyberins']});
        document.getElementById('play-overlay')?.remove(); _mocForceCouncil(2);
      },kind);
      const state=await page.evaluate(()=>({flags:MoC.S.activeStates,timed:MoC.S.timedFx,error:MoC.lastInputError}));
      const key=kind==='strike'?'struck':kind==='citizen'?'citAvoid':'docWTR';
      assert.equal(!!state.flags[key],false);
      assert.equal(state.timed.length,0);
      assert.match(state.error,/Invalid care input/);
    });
  }
});

test('F05 scope rejected strike expiry retains its lifecycle until the dated effect settles', {timeout:30000}, async()=>{
  await withResourceTown(async page=>{
    await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.2,sick:0.01,ai:1});
      Object.assign(MoC.S,{budget:1000000,trustC:70,trustP:70,trustD:19,quarter:2,
        _sinceQuiet:3,_dilemmaOrder:['cyberins']});
      document.getElementById('play-overlay')?.remove(); _mocForceCouncil(2);
    });
    assert.equal(await page.evaluate(()=>MoC.S.activeStates.struck),true);
    await page.evaluate(()=>{
      M.IST.admin=0.01; // inconsistent restored state; inverse cannot apply
      document.getElementById('moc-council')?.remove();
      Object.assign(MoC.S,{trustD:70,quarter:3,_sinceQuiet:3,_dilemmaOrder:['locum']}); _mocForceCouncil(3);
    });
    assert.equal(await page.evaluate(()=>MoC.S.activeStates.struck),true);
    assert.equal(await page.evaluate(()=>MoC.S.timedFx.filter(t=>t.source==='doctor-strike').length),1);
    assert.match(await page.evaluate(()=>MoC.lastInputError),/Invalid care input: admin/);
    await page.evaluate(()=>{
      M.IST.admin=0.25;
      document.getElementById('moc-council')?.remove();
      Object.assign(MoC.S,{quarter:4,_sinceQuiet:3,_dilemmaOrder:['press']}); _mocForceCouncil(4);
    });
    assert.equal(await page.evaluate(()=>MoC.S.activeStates.struck),false);
    assert.equal(await page.evaluate(()=>MoC.S.timedFx.length),0);
    assert.ok(Math.abs(await page.evaluate(()=>M.IST.sick)-0.01)<1e-15);
  });
});

test('F05 scope final-council conditional recovery is not reserved beyond either scenario', {timeout:30000}, async()=>{
  for (const scenario of ['cabinetcrisis','campaign']) {
    await withResourceTown(async page=>{
      page.setDefaultTimeout(4000);
      await page.evaluate(()=>{
        Object.assign(M.IST,{admin:0.2,sick:0.01,ai:1});
        Object.assign(MoC.S,{budget:1000000,trustC:70,trustP:70,trustD:32,quarter:MoC.TOTAL_QUARTERS,
          _sinceQuiet:3,_dilemmaOrder:['overtime']});
        modelTick=(MoC.TOTAL_QUARTERS-1)*MoC.QUARTER_TICKS; cycle=MoC.STARTUP_CYCLE+modelTick;
        document.getElementById('play-overlay')?.remove(); _mocForceCouncil(MoC.TOTAL_QUARTERS);
      });
      assert.equal(await page.evaluate(()=>MoC.S.activeStates.docWTR),true);
      await page.locator('#moc-wiz-next').click();
      assert.equal(await page.locator('#moc-opt-a').isDisabled(),false);
      await page.locator('#moc-opt-a').click();
      assert.ok(Math.abs(await page.evaluate(()=>M.IST.sick)-0.01)<1e-15);
      const ended=await page.evaluate(()=>{
        modelTick=MoC.TOTAL_QUARTERS*MoC.QUARTER_TICKS-1; cycle=MoC.STARTUP_CYCLE+modelTick;
        MoC.paused=false; tick();
        return {over:MoC.S.over,wtr:MoC.S.activeStates.docWTR,sick:M.IST.sick,errors:MoC.careInputErrorCount || 0};
      });
      assert.equal(ended.over,true);
      assert.equal(ended.wtr,true,'no terminal council callback clears the active condition');
      assert.ok(Math.abs(ended.sick-0.01)<1e-15);
      assert.equal(ended.errors,0);
    },'',scenario);
  }
});

test('F05 scope rejected workforce cascade remains retryable', {timeout:30000}, async()=>{
  await withResourceTown(async page=>{
    const cascade=await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.2,sick:0.99,drain:1});
      Object.assign(MoC.S,{trustD:28,pendingBanners:[],cascades:{}});
      _mocDebug.stepCascades(4); _mocDebug.stepCascades(6);
      return {stage:MoC.S.cascades.exodus.stage,sick:M.IST.sick};
    });
    assert.deepEqual(cascade,{stage:1,sick:0.99});
    const retried=await page.evaluate(()=>{
      M.IST.sick=0.1; _mocDebug.stepCascades(6);
      return {stage:MoC.S.cascades.exodus.stage,sick:M.IST.sick};
    });
    assert.equal(retried.stage,2);
    assert.ok(Math.abs(retried.sick-0.12)<1e-15);
  },'?debug=1');
});

test('F05 scope rejected carer onset remains retryable', {timeout:30000}, async()=>{
  await withResourceTown(async page=>{
    const result=await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.2,sick:0.99,drain:1});
      Object.assign(MoC.S,{budget:1000000,trustC:70,trustD:70,trustP:70,quarter:3,mantelzorg:90});
      document.getElementById('play-overlay')?.remove();
      modelTick=155; cycle=MoC.STARTUP_CYCLE+modelTick; MoC.paused=false; tick();
      return {fired:!!MoC.S._mantelzorgFired,sick:M.IST.sick};
    });
    assert.deepEqual(result,{fired:false,sick:0.99});
    const retried=await page.evaluate(()=>{
      M.IST.sick=0.1; MoC.S.quarter=7;
      modelTick=363; cycle=MoC.STARTUP_CYCLE+modelTick; MoC.paused=false; tick();
      return {fired:!!MoC.S._mantelzorgFired,sick:M.IST.sick};
    });
    assert.equal(retried.fired,true);
    assert.ok(Math.abs(retried.sick-0.15)<1e-15);
  });
});

test('F05 review valid ransomware commits once, while stale and cumulative-invalid offers stay atomic', {timeout:30000}, async () => {
  for (const kind of ['valid','stale','cumulative']) {
    await withResourceTown(async page=>{
      await openRansomwareCouncil(page,1,kind==='cumulative'?0.9:0.3);
      if (kind==='stale') await page.evaluate(()=>{MoC.S.specialistCapacity=0.5;});
      const snapshot=()=>page.evaluate(()=>({budget:MoC.S.budget,admin:M.IST.admin,capacity:MoC.S.specialistCapacity,
        trust:[MoC.S.trustC,MoC.S.trustD,MoC.S.trustP],timed:MoC.S.timedFx,interventions:MoC.S.interventions}));
      const before=await snapshot(),button=page.locator('[data-evtopt="0"]');
      if (!await button.isDisabled()) await button.click();
      const after=await snapshot();
      if (kind==='valid') {
        assert.equal(after.budget,before.budget-50000);
        assert.ok(Math.abs(after.admin-before.admin-0.1*4/3)<1e-15);
        assert.equal(after.capacity,0.5);
        assert.equal(after.timed.length,1);
        assert.equal(after.interventions.length,before.interventions.length+1);
        assert.equal(await button.isDisabled(),true);
        await button.dispatchEvent('click');
        assert.deepEqual(await snapshot(),after,'even a duplicate event cannot apply a decided choice twice');
      } else {
        assert.deepEqual(after,before);
        assert.equal(await button.isDisabled(),true);
        assert.equal(await page.locator('#moc-defer-decision').count(),1);
      }
    });
  }
});

test('F05 review valid delayed delivery is reserved and settles exactly once', {timeout:30000}, async () => {
  await withResourceTown(async page=>{
    page.setDefaultTimeout(4000);
    await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.06,sick:0.1,ai:1});
      Object.assign(MoC.S,{budget:200000,quarter:2,_sinceQuiet:3,_dilemmaOrder:['buildorbuy']});
      document.getElementById('play-overlay')?.remove(); _mocForceCouncil(2);
    });
    await page.locator('#moc-wiz-next').click();
    await page.locator('#moc-opt-b').click();
    const accepted=await page.evaluate(()=>({budget:MoC.S.budget,admin:M.IST.admin,delayed:MoC.S.delayed.length}));
    assert.deepEqual(accepted,{budget:130000,admin:0.06,delayed:1});
    assert.equal(await page.evaluate(()=>_mocDebug.applyFx({admin:-0.04,budget:-1000})),false);
    assert.deepEqual(await page.evaluate(()=>({budget:MoC.S.budget,admin:M.IST.admin,delayed:MoC.S.delayed.length})),accepted);
    await page.evaluate(()=>{
      document.getElementById('moc-council')?.remove();
      Object.assign(MoC.S,{quarter:10,_sinceQuiet:3,_dilemmaOrder:['locum']}); _mocForceCouncil(10);
    });
    assert.deepEqual(await page.evaluate(()=>({admin:M.IST.admin,delayed:MoC.S.delayed.length})),{admin:0.03,delayed:0});
    await page.evaluate(()=>{
      document.getElementById('moc-council')?.remove();
      Object.assign(MoC.S,{quarter:11,_sinceQuiet:3,_dilemmaOrder:['cyberins']}); _mocForceCouncil(11);
    });
    assert.equal(await page.evaluate(()=>M.IST.admin),0.03);
  },'?debug=1','campaign');
});

test('F05 review a failed expiry is retained for retry, not silently discarded', {timeout:30000}, async () => {
  await withResourceTown(async page=>{
    await openRansomwareCouncil(page,1,0.02);
    await page.locator('[data-evtopt="0"]').click();
    const active=await page.evaluate(()=>({admin:M.IST.admin,timed:MoC.S.timedFx}));
    // Simulate inconsistent restored state, bypassing normal reserved-policy
    // validation. Runtime must retain the obligation and expose the failure.
    await page.evaluate(()=>{
      M.IST.admin=0.01;
      document.getElementById('moc-council')?.remove();
      Object.assign(MoC.S,{quarter:3,_sinceQuiet:3,_dilemmaOrder:['locum']}); _mocForceCouncil(3);
    });
    assert.deepEqual(await page.evaluate(()=>MoC.S.timedFx),active.timed);
    assert.equal(await page.evaluate(()=>M.IST.admin),0.01);
    assert.match(await page.evaluate(()=>MoC.lastInputError),/Invalid care input: admin/);
    await page.locator('#moc-wiz-next').click();
    await page.locator('#moc-defer-decision').click();
    assert.equal(await page.locator('#moc-wiz-next').isDisabled(),false);
    await page.evaluate(admin=>{
      M.IST.admin=admin;
      document.getElementById('moc-council')?.remove();
      Object.assign(MoC.S,{quarter:4,_sinceQuiet:3,_dilemmaOrder:['cyberins']}); _mocForceCouncil(4);
    },active.admin);
    assert.equal(await page.evaluate(()=>MoC.S.timedFx.length),0);
    assert.ok(Math.abs(await page.evaluate(()=>M.IST.admin)-0.02)<1e-15);
  });
});

test('F05 review gamble availability covers every outcome without speculative mutation', {timeout:30000}, async () => {
  await withResourceTown(async page=>{
    page.setDefaultTimeout(4000);
    await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.3,sick:0.1,ai:1});
      Object.assign(MoC.S,{budget:200000,specialistCapacity:0.25,quarter:2,_sinceQuiet:3,_dilemmaOrder:['nzatariff']});
      document.getElementById('play-overlay')?.remove(); _mocForceCouncil(2);
    });
    await page.locator('#moc-wiz-next').click();
    assert.equal(await page.locator('#moc-opt-b').isDisabled(),true);
    assert.match(await page.locator('#moc-opt-b').innerText(),/Invalid care input: capacity/);
    assert.deepEqual(await page.evaluate(()=>({budget:MoC.S.budget,capacity:MoC.S.specialistCapacity,interventions:MoC.S.interventions})),
      {budget:200000,capacity:0.25,interventions:[]});
    assert.equal(await page.locator('#moc-opt-a').isDisabled(),false);
  });
});

test('F05 review roundoff correction does not accept invalid inputs or substantive overshoots', {timeout:30000}, async () => {
  await withResourceTown(async page=>{
    const results=await page.evaluate(()=>{
      const tryFx=(admin,fx)=>{
        M.IST.admin=admin;
        const before={budget:MoC.S.budget,admin:M.IST.admin};
        const accepted=_mocDebug.applyFx({...fx,budget:-100});
        return {accepted,before,after:{budget:MoC.S.budget,admin:M.IST.admin}};
      };
      return [
        tryFx(0,{admin:-Number.EPSILON}),
        tryFx(-Number.EPSILON,{admin:0.1}),
        tryFx(0.3,{admin:-0.30000001}),
        tryFx(0.9,{admin:0.10000001}),
        tryFx(0.3,{admin:NaN}),
        tryFx(0.3,{ai:Infinity})
      ];
    });
    for (const result of results) {
      assert.equal(result.accepted,false);
      assert.deepEqual(result.after,result.before);
    }
  },'?debug=1');
});

test('F05 review two Pilot Grants expire without a roundoff residue or lost reversal', {timeout:30000}, async () => {
  await withResourceTown(async page=>{
    page.setDefaultTimeout(4000);
    await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0,sick:0.1,ai:1});
      Object.assign(MoC.S,{budget:1000000,adoptionRate:0.7});
    });
    await openQuietFunding(page,2);
    for(let i=0;i<2;i++) {
      const buy=page.locator('[data-buy="pilotgrant"]');
      assert.equal(await buy.isDisabled(),false,'both valid pilots must remain available');
      await buy.click();
    }
    assert.ok(Math.abs(await page.evaluate(()=>M.IST.admin)-0.04)<1e-15);
    await openQuietFunding(page,3);
    assert.ok(Math.abs(await page.evaluate(()=>M.IST.admin)-0.02)<1e-15);
    await openQuietFunding(page,4);
    assert.deepEqual(await page.evaluate(()=>({admin:M.IST.admin,timed:MoC.S.timedFx,errors:MoC.careInputErrorCount || 0})),
      {admin:0,timed:[],errors:0});
  });
});

test('F05 review full-adoption scribe and platform purchases reach exact zero paperwork', {timeout:30000}, async () => {
  await withResourceTown(async page=>{
    page.setDefaultTimeout(4000);
    await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.3,sick:0.1,ai:1});
      Object.assign(MoC.S,{budget:1000000,adoptionRate:1});
    });
    await openQuietFunding(page,2);
    await page.locator('[data-buy="scribes1"]').click();
    await page.locator('[data-buy="scribes2"]').click();
    await openQuietFunding(page,3);
    const platform=page.locator('[data-buy="platform"]');
    assert.equal(await platform.isDisabled(),false,'0.30 - 0.18 - 0.07 - 0.05 is a valid zero');
    await platform.click();
    assert.deepEqual(await page.evaluate(()=>({admin:M.IST.admin,owned:MoC.S.owned.platform,errors:MoC.careInputErrorCount || 0})),
      {admin:0,owned:1,errors:0});
  });
});

test('F05 review storm safe mode explicitly reports score only with no service effect', {timeout:30000}, async () => {
  await withResourceTown(async page=>{
    page.setDefaultTimeout(4000);
    await page.evaluate(()=>{
      Object.assign(M.IST,{admin:0.3,sick:0.08,ai:1});
      MoC.S.liveScore=100;
      document.getElementById('play-overlay')?.remove();
      _mocForceFlash(5);
    });
    const snapshot=()=>page.evaluate(()=>({p:{...M.IST},capacity:MoC.S.specialistCapacity,
      timed:MoC.S.timedFx,delayed:MoC.S.delayed,gp:MoC.care.snapshot().gpService}));
    const before=await snapshot();
    const text=await page.locator('.moc-flash').innerText();
    assert.match(text,/score.only/i);
    assert.match(text,/no modeled service effect/i);
    assert.doesNotMatch(text,/reduces digital capacity/i);
    await page.locator('#moc-fa').click();
    assert.equal(await page.evaluate(()=>MoC.S.liveScore),96);
    assert.deepEqual(await snapshot(),before);
    assert.match(await page.locator('.moc-flash-result').innerText(),/Term score -4/);
  });
});

test('F04 eight emergencies share one place with bounded visible overflow and no routine displacement', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    const result = await page.evaluate(() => {
      const f=resourceFixture;
      for (let i=0;i<8;i++) f.activate(i,{behaviorState:'emergency',hp:80,waitWeeks:13,emergencyAdmission:true,referredToHospital:true});
      f.queue(8,'hospital');
      MoC.S.serviceCredit=1;
      const first=f.advance();
      const overflow=f.people.filter(a=>a.behaviorState==='emergency_overflow');
      const waiting=overflow[0];
      waiting.conditions=[{code:'I25',name:'Fixture',severity:'moderate'}];
      const episode=MoC.care.episodes.findLast(e=>e.agentId===waiting.id&&e.status==='waiting');
      const expectedWait=(modelTick+1-episode.startTick)/MoC.TICKS_PER_WEEK;
      const expectedDrain=calculateHPDrain(waiting.conditions[0],'moderate',expectedWait,M.IST,waiting)
        *getComorbidityMultiplier(waiting.conditions);
      const beforeHP=waiting.hp;
      const second=f.advance();
      const observedDrain=beforeHP-waiting.hp, observedWait=waiting.waitWeeks;
      waiting.hp=0;
      const active=f.people.find(a=>a.behaviorState==='at_hospital'&&a.emergencyAdmission);
      active.stateTimer=1;
      const third=f.advance();
      const endUse=MoC.care.resourceUses.find(u=>u.agentId===active.id);
      const replacement=MoC.care.resourceUses.find(u=>u.resource==='emergency'&&u!==endUse);
      MoC.refreshMinistry();
      return {first,second,third,observedDrain,expectedDrain,observedWait,expectedWait,
        deadEpisode:episode.status,releaseTick:endUse.endTick,replacementTick:replacement.startTick,
        visible:document.querySelector('#moc-emergency-overflow').textContent,
        details:document.querySelector('.moc-resource-report').textContent,referencePolicy:MoC.referencePolicy,roster:f.people.length};
    });
    assert.equal(result.referencePolicy,false);
    assert.equal(result.first.resources.routine.slots,1);
    assert.equal(result.first.resources.emergency.occupancy,1);
    assert.equal(result.first.emergencyStarts,1);
    assert.equal(result.first.routineStarts,1,'separate emergency care must not spend routine start credit');
    assert.equal(result.first.emergencyOverflow,7);
    assert.equal(result.first.emergencyOverflowEntries,7,'only blocked arrivals count as overflow entries');
    assert.equal(result.first.waiting,7);
    assert.equal(result.first.emergencyOverflowBound,result.roster,'overflow is bounded by one entry per resident, not extra treatment places');
    assert.equal(result.second.emergencyOverflowEntries,7,'waiting does not duplicate overflow entries');
    assert.ok(Math.abs(result.observedDrain-result.expectedDrain)<1e-9,
      `overflow uses the existing untreated HP rule: observed ${result.observedDrain}, expected ${result.expectedDrain}, wait ${result.observedWait}/${result.expectedWait}`);
    assert.ok(Math.abs(result.observedWait-result.expectedWait)<1e-9);
    assert.equal(result.third.emergencyStarts,2);
    assert.equal(result.third.resources.emergency.completions,1);
    assert.equal(result.third.emergencyOverflow,5);
    assert.equal(result.deadEpisode,'died_waiting');
    assert.equal(result.third.emergencyDeathsWaiting,1);
    assert.equal(result.third.overflowDeathsWaiting,1);
    assert.equal(result.releaseTick,result.replacementTick,'release is reusable on its observed completion tick');
    assert.equal(result.third.routineStarts,1);
    assert.equal(result.third.routineDisplacements,0);
    assert.match(result.visible,/Emergency overflow: 5 waiting/);
    assert.match(result.details,/Emergency starts \/ completions2 \/ 1/);
  });
});

test('F04 simultaneous GP arrivals respect both providers, absence, completion, death and re-entry', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    const r = await page.evaluate(() => {
      const f=resourceFixture,gp=agents.find(g=>g.id==='gp1');
      for (let i=0;i<3;i++) f.queue(i,'gp1_bldg',{behaviorState:'going_to_gp'});
      f.queue(3,'gp2_bldg',{behaviorState:'going_to_gp'});
      const first=f.advance(),a=f.people[0];
      const oldUse=MoC.care.resourceUses.find(u=>u.agentId===a.id);
      const firstTimer=a.stateTimer;
      gp.sickLeaveTimer=3;
      const absent=f.advance(3),pausedTimer=a.stateTimer;
      a.stateTimer=1;
      const completed=f.advance();
      const duplicate=MoC.care.release(a,'completed',oldUse);
      Object.assign(a,{behaviorState:'going_to_gp',insideBuilding:null,path:[],pathComplete:true});
      const second=f.people[1];
      second.hp=0;
      const death=f.advance();
      const releases=death.resources.gp1_bldg.releases;
      finalizeAgentDeath(second);finalizeAgentDeath(second);
      f.people[2].stateTimer=1;
      const reentry=f.advance();
      const staleRelease=MoC.care.release(a,'completed',oldUse);
      return {first,absent,completed,death,reentry,firstTimer,pausedTimer,duplicate,staleRelease,releases,
        uses:MoC.care.resourceUses.filter(u=>u.agentId===a.id),final:MoC.care.resources(),
        location:a.insideBuilding,behavior:a.behaviorState};
    });
    assert.equal(r.first.resources.gp1_bldg.occupancy,1);
    assert.equal(r.first.resources.gp2_bldg.occupancy,1);
    assert.equal(r.first.resources.gp1_bldg.starts,1);
    assert.equal(r.absent.resources.gp1_bldg.starts,1,'no overlapping start during absence');
    assert.equal(r.pausedTimer,r.firstTimer,'absence pauses active GP service without dropping its occupied place');
    assert.equal(r.completed.resources.gp1_bldg.completions,1);
    assert.equal(r.completed.resources.gp1_bldg.starts,2,'completion reallocates in the same tick');
    assert.equal(r.death.resources.gp1_bldg.starts,3);
    assert.equal(r.reentry.resources.gp1_bldg.starts,4);
    assert.equal(r.final.gp1_bldg.releases,r.releases+1,'repeated death cleanup does not release twice');
    assert.equal(r.duplicate,false);
    assert.equal(r.staleRelease,false,'a previous visit release cannot free a new visit');
    assert.equal(r.uses.length,2);
    assert.equal(r.uses[0].outcome,'completed');
    assert.equal(r.uses[1].endTick,undefined);
    assert.equal(r.final.gp1_bldg.occupancy,1);
    assert.equal(r.location,'gp1_bldg','dawn must preserve the active GP place');
    assert.equal(r.behavior,'at_gp');
  });
});

test('F04 whole-roster emergency demand has unique overflow and terminal treatment death reallocates once', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    const r=await page.evaluate(()=>{
      const f=resourceFixture;
      f.people.forEach((a,i)=>f.activate(i,{behaviorState:'emergency',emergencyAdmission:true,referredToHospital:true}));
      const full=f.advance();
      MoC.care.processEmergencies();MoC.care.processEmergencies();
      const repeated=MoC.care.snapshot();
      const active=f.people.find(a=>a.behaviorState==='at_hospital');
      active.hp=0;
      const death=f.advance();
      finalizeAgentDeath(active);finalizeAgentDeath(active);
      const final=MoC.care.snapshot();
      return {full,repeated,death,final,roster:f.people.length,
        uses:MoC.care.resourceUses.filter(u=>u.resource==='emergency')};
    });
    assert.equal(r.full.emergencyOverflow,r.roster-1);
    assert.equal(r.full.emergencyOverflowBound,r.roster);
    assert.equal(r.full.emergencyOverflowEntries,r.roster-1);
    assert.equal(r.repeated.emergencyOverflowEntries,r.full.emergencyOverflowEntries);
    assert.equal(r.repeated.emergencyStarts,1);
    assert.equal(r.death.emergencyStarts,2);
    assert.equal(r.death.resources.emergency.occupancy,1);
    assert.equal(r.final.resources.emergency.releases,1);
    assert.equal(r.final.resources.emergency.completions,0,'death releases a place but is not a completion');
    assert.equal(r.final.emergencyDeathsWaiting,0,'a treatment death is not a death before treatment');
    assert.equal(r.uses[0].outcome,'death');
    assert.equal(r.uses[0].endTick,r.uses[1].startTick,'terminal cleanup precedes the next admission');
  });
});

test('F04 full routine occupancy conserves capped credit and reallocates by clinical priority', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    const r = await page.evaluate(() => {
      const f=resourceFixture;
      const holder=f.activate(0,{behaviorState:'at_hospital',insideBuilding:'hospital',stateTimer:8});
      const routine=f.queue(1,'hospital');
      const urgent=f.queue(2,'hospital',{conditions:[{code:'I25',name:'Fixture',severity:'severe'}],hp:80});
      QUEUES.hospital.agents.push(routine.id,urgent.id,'stale-id');
      MoC.S.serviceCredit=1;
      agents.filter(a=>a.type==='gp').forEach(g=>{g.sickLeaveTimer=20;});
      const full=f.advance(),creditFull=MoC.S.serviceCredit;
      MoC.care.availableStarts(2);MoC.care.availableStarts(2);
      const creditRepeated=MoC.S.serviceCredit;
      holder.stateTimer=1;
      const discharged=f.advance(),creditUsed=MoC.S.serviceCredit;
      const admitted=urgent.behaviorState;
      urgent.hp=0;
      const dead=f.advance(),fractional=MoC.S.serviceCredit;
      const releaseCount=dead.resources.routine.releases;
      finalizeAgentDeath(urgent);finalizeAgentDeath(urgent);
      // At 0.25 starts/week it takes 16 ticks to accrue the next start.
      const beforeNext=f.advance(14);
      const next=f.advance();
      return {full,creditFull,creditRepeated,discharged,creditUsed,admitted,dead,fractional,releaseCount,
        beforeNext,next,lastBehavior:routine.behaviorState,uses:MoC.care.resourceUses};
    });
    assert.equal(r.full.resources.routine.occupancy,1);
    assert.equal(r.full.routineStarts,0,'initial ongoing care consumes occupancy, not new service credit');
    assert.equal(r.creditFull,1);
    assert.equal(r.creditRepeated,1,'repeated capacity reads cannot accrue more credit in the same tick');
    assert.equal(r.discharged.resources.routine.completions,1);
    assert.equal(r.discharged.routineStarts,1);
    assert.equal(r.admitted,'at_hospital','more urgent routine resident goes ahead of the FIFO front');
    assert.equal(r.creditUsed,0);
    assert.equal(r.dead.routineStarts,1,'a freed slot alone cannot manufacture start credit');
    assert.ok(Math.abs(r.fractional-0.0625)<1e-12);
    assert.equal(r.beforeNext.routineStarts,1);
    assert.equal(r.next.routineStarts,2);
    assert.equal(r.next.resources.routine.releases,r.releaseCount);
    assert.equal(r.lastBehavior,'at_hospital');
    assert.equal(r.next.resources.routine.occupancy,1);
  });
});

test('F04 escalation transfers GP and already-referred residents into emergency priority without erasing waits', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    const r = await page.evaluate(() => {
      const f=resourceFixture,critical={code:'I25',name:'Fixture',severity:'critical'};
      const gpPatient=f.activate(0,{behaviorState:'at_gp',insideBuilding:'gp1_bldg',stateTimer:8,hp:20,conditions:[{...critical}]});
      f.queue(1,'gp1_bldg');
      const referred=f.queue(2,'hospital',{hp:20,conditions:[{...critical}],waitWeeks:5,referredToHospital:true});
      const emergency=f.activate(3,{behaviorState:'at_hospital',insideBuilding:'hospital',stateTimer:8,emergencyAdmission:true});
      f.queue(4,'hospital');
      MoC.S.serviceCredit=1;
      const first=f.advance(),episode=MoC.care.episodes.findLast(e=>e.agentId===referred.id&&e.status==='waiting');
      const before={id:episode.id,startTick:episode.startTick,status:episode.status,wait:MoC.care.elapsed(referred)};
      emergency.stateTimer=1;
      const second=f.advance();
      return {first,second,before,after:{id:episode.id,startTick:episode.startTick,status:episode.status,wait:episode.waitWeeks},
        gpUse:MoC.care.resourceUses.find(u=>u.agentId===gpPatient.id&&u.resource==='gp1_bldg'),
        referredBehavior:referred.behaviorState,gpBehavior:gpPatient.behaviorState,
        emergencyUses:MoC.care.resourceUses.filter(u=>u.resource==='emergency')};
    });
    assert.equal(r.first.resources.gp1_bldg.releases,1);
    assert.equal(r.gpUse.outcome,'transfer');
    assert.equal(r.first.resources.gp1_bldg.occupancy,1,'escalation frees the GP for its next arrival');
    assert.equal(r.first.emergencyOverflow,2);
    assert.equal(r.first.routineStarts,1,'unrelated routine demand retains its separate resource');
    assert.equal(r.before.wait,5,'escalation retains the pre-existing referral episode');
    assert.equal(r.before.status,'waiting');
    assert.equal(r.referredBehavior,'at_hospital','waiting emergency with higher clinical priority takes the freed emergency place');
    assert.equal(r.gpBehavior,'emergency_overflow');
    assert.equal(r.after.id,r.before.id);
    assert.equal(r.after.startTick,r.before.startTick);
    assert.equal(r.after.status,'treatment_started');
    assert.ok(Math.abs(r.after.wait-5.25)<1e-9);
    assert.equal(r.second.routineDisplacements,0);
    assert.equal(r.emergencyUses[0].endTick,r.emergencyUses[1].startTick);
  });
});

test('F04 resource shrink retires occupied places without eviction or extra starts', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    const r=await page.evaluate(()=>{
      const f=resourceFixture;
      MoC.S.specialistCapacity=1;
      for(let i=0;i<3;i++)f.activate(i,{behaviorState:'at_hospital',insideBuilding:'hospital',stateTimer:8});
      f.queue(3,'hospital');
      MoC.S.serviceCredit=1;
      const initial=f.advance();
      MoC.S.specialistCapacity=0.25;
      const reduced=f.advance();
      f.people[0].stateTimer=1;f.people[1].stateTimer=1;
      const partial=f.advance();
      f.people[2].stateTimer=1;
      const reallocated=f.advance();
      return {initial,reduced,partial,reallocated};
    });
    assert.equal(r.initial.resources.routine.occupancy,3);
    assert.equal(r.reduced.resources.routine.slots,1);
    assert.equal(r.reduced.resources.routine.occupancy,3);
    assert.equal(r.reduced.resources.routine.retiringSlots,2,'only already occupied places are temporarily retained');
    assert.equal(r.reduced.routineStarts,0);
    assert.equal(r.partial.resources.routine.occupancy,1);
    assert.equal(r.partial.routineStarts,0,'no start until occupancy falls below the new target');
    assert.equal(r.reallocated.resources.routine.completions,3);
    assert.equal(r.reallocated.resources.routine.retiringSlots,0);
    assert.equal(r.reallocated.resources.routine.occupancy,1);
    assert.equal(r.reallocated.routineStarts,1);
  });
});

test('F04 burnout queue transfers retain destination and cannot overlap the receiving GP', {timeout:30000}, async () => {
  await withResourceTown(async page => {
    const r=await page.evaluate(()=>{
      const f=resourceFixture,gp1=agents.find(g=>g.id==='gp1'),gp2=agents.find(g=>g.id==='gp2');
      const holder=f.activate(0,{behaviorState:'at_gp',insideBuilding:'gp2_bldg',gpName:gp2.name,stateTimer:8});
      const incoming=f.queue(1,'gp1_bldg');
      f.activate(2,{behaviorState:'at_gp',insideBuilding:'gp1_bldg',gpName:gp1.name,stateTimer:8});
      gp1.burnoutLevel=95;
      // The real burnout handler transfers the queued resident after service.
      const first=f.advance();
      const transferred={building:incoming.queueBuilding,name:incoming.gpName,type:incoming.queueType,
        inDestination:QUEUES.gp2_bldg.agents.includes(incoming.id)};
      const second=f.advance();
      holder.stateTimer=1;
      const third=f.advance();
      return {first,second,third,transferred,expectedName:gp2.name,behavior:incoming.behaviorState,building:incoming.insideBuilding};
    });
    assert.deepEqual(r.transferred,{building:'gp2_bldg',name:r.expectedName,type:'gp',inDestination:true});
    assert.equal(r.second.resources.gp2_bldg.occupancy,1);
    assert.equal(r.second.resources.gp2_bldg.starts,0,'the receiving GP is still occupied by its initial consultation');
    assert.equal(r.third.resources.gp2_bldg.starts,1);
    assert.equal(r.third.resources.gp2_bldg.completions,1);
    assert.equal(r.behavior,'at_gp');
    assert.equal(r.building,'gp2_bldg');
  });
});

test('Recruitment adds treatment capacity without changing the clinical norm', { timeout: 30000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html?debug=1#scn=campaign&seed=2468`, { waitUntil:'domcontentloaded' });
    await page.evaluate(() => { MoC.audio.setMuted(true); document.getElementById('play-overlay')?.remove(); window._mocForceCouncil(2); });
    await openCouncilActions(page);
    const before = await page.evaluate(() => ({norm:M.IST.tree, capacity:MoC.S.specialistCapacity,
      drain:calculateHPDrain({code:'I25'},'moderate',11,M.IST,null)}));
    await page.locator('[data-buy="hire"]').click();
    const after = await page.evaluate(() => ({norm:M.IST.tree, capacity:MoC.S.specialistCapacity,
      drain:calculateHPDrain({code:'I25'},'moderate',11,M.IST,null)}));
    assert.equal(after.norm, 12);
    assert.equal(after.drain, before.drain);
    assert.equal(after.capacity, before.capacity + 1);
    // Actual credit/occupancy-limited starts are exercised by the F04 fixtures.
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('Hospital staff do not occupy patient treatment slots', { timeout:30000 }, async()=>{
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage();
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,{waitUntil:'domcontentloaded'});
    const treated=await page.evaluate(()=>{
      MoC.audio.setMuted(true);MoC.referencePolicy=true;
      const patients=agents.filter(a=>a.type==='patient'||a.type==='citizen');
      patients.forEach(a=>{a.insideBuilding=null;a.behaviorState='roaming';a.hp=100;a.conditions=[];});
      const patient=patients[0];
      patient.behaviorState='queuing';patient.queueType='hospital';patient.queueBuilding='hospital';
      QUEUES.hospital.agents=[patient.id];
      MoC.S.serviceCredit=0;MoC.paused=false;
      for(let i=0;i<4;i++)tick();
      return MoC.care.episodes.some(e=>e.agentId===patient.id&&e.status==='treatment_started');
    });
    assert.equal(treated,true,'existing routine capacity must serve a waiting patient even with staff inside hospital');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Lethal disease progression finalizes death before hospital treatment', { timeout:30000 }, async()=>{
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage();
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,{waitUntil:'domcontentloaded'});
    const outcome=await page.evaluate(()=>{
      MoC.audio.setMuted(true); MoC.paused=false;
      const patients=agents.filter(a=>a.type==='patient'||a.type==='citizen');
      patients.forEach(a=>{a.moved=true;a.insideBuilding='test-isolation';a.conditions=[];a.hp=100;});
      const patient=patients[0];
      Object.assign(patient,{moved:false,insideBuilding:'hospital',behaviorState:'at_hospital',state:'active',
        stateTimer:10,hp:2.5,waitWeeks:8,conditions:[{code:'I25',name:'Chronic Ischemic Heart Disease',severity:'critical'}]});
      const queued=patients[1];
      Object.assign(queued,{moved:false,insideBuilding:'test-isolation',behaviorState:'queuing',state:'active',
        queueType:'hospital',queueBuilding:'hospital',hp:2.5,waitWeeks:8,path:[],pathComplete:true,
        conditions:[{code:'I25',name:'Chronic Ischemic Heart Disease',severity:'critical'}]});
      QUEUES.hospital.agents.push(queued.id);
      modelTick=3;cycle=MoC.STARTUP_CYCLE+modelTick;
      const oldRandom=Math.random, oldTransition=window.transitionDiseaseState;
      const graveCount=GRAVE_MARKERS.length, deathCount=EVENT_LOG.filter(e=>e.type==='died').length;
      try {
        Math.random=()=>0.5;
        window.transitionDiseaseState=()=> 'deceased';
        tick();
        const firstTick={hp:patient.hp,state:patient.state,behavior:patient.behaviorState,cause:patient.causeOfDeath,
          graves:GRAVE_MARKERS.length-graveCount,deaths:EVENT_LOG.filter(e=>e.type==='died').length-deathCount,
          history:patient.actionHistory?.filter(e=>e.type==='died').length||0};
        tick();
        return {...firstTick,repeat:{hp:patient.hp,state:patient.state,behavior:patient.behaviorState,
          graves:GRAVE_MARKERS.length-graveCount,deaths:EVENT_LOG.filter(e=>e.type==='died').length-deathCount,
          history:patient.actionHistory?.filter(e=>e.type==='died').length||0},
          queued:{state:queued.state,behavior:queued.behaviorState,inQueue:QUEUES.hospital.agents.includes(queued.id)},
          episode:MoC.care.episodes.find(e=>e.agentId===queued.id)?.status};
      } finally {
        Math.random=oldRandom;
        window.transitionDiseaseState=oldTransition;
      }
    });
    assert.equal(outcome.hp,0,'a lethal transition must not be reversed by hospital healing');
    assert.equal(outcome.state,'dead');
    assert.equal(outcome.behavior,'dead');
    assert.equal(outcome.cause,'system_failure');
    assert.equal(outcome.graves,2,'both terminal patients should be finalized exactly once');
    assert.equal(outcome.deaths,2,'each terminal patient should have one mortality event');
    assert.equal(outcome.history,1,'the patient history should record one death');
    assert.deepEqual(outcome.repeat,{hp:0,state:'dead',behavior:'dead',graves:2,deaths:2,history:1},
      'repeated ticks must not resurrect or double-count a finalized patient');
    assert.deepEqual(outcome.queued,{state:'dead',behavior:'dead',inQueue:false},
      'a terminal queued resident must be removed before hospital admission');
    assert.equal(outcome.episode,'died_waiting','a pending care episode should close with the terminal outcome');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Previously finalized deaths are cleaned before movement and hospital capacity', { timeout:30000 }, async()=>{
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage();
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,{waitUntil:'domcontentloaded'});
    const outcome=await page.evaluate(()=>{
      MoC.audio.setMuted(true); MoC.paused=false;
      const patients=agents.filter(a=>a.type==='patient'||a.type==='citizen');
      patients.forEach(a=>Object.assign(a,{moved:true,insideBuilding:'test-isolation',behaviorState:'roaming',
        state:'managed',hp:100,conditions:[],queueType:null,queueBuilding:null}));
      const patient=patients[0], living=patients[1];
      Object.assign(patient,{moved:false,insideBuilding:null,state:'active',behaviorState:'queuing',hp:80,
        x:0.2,y:0.2,tx:0.8,ty:0.8,path:[],pathIdx:0,pathComplete:false,waitWeeks:3,
        conditions:[{code:'I25',name:'Chronic Ischemic Heart Disease',severity:'critical'}],
        queueType:'hospital',queueBuilding:'hospital',causeOfDeath:'natural'});
      Object.assign(living,{moved:false,state:'managed',behaviorState:'queuing',hp:80,waitWeeks:3,
        conditions:[{code:'I25',name:'Chronic Ischemic Heart Disease',severity:'mild'}],
        queueType:'hospital',queueBuilding:'hospital'});
      QUEUES.hospital.agents=[patient.id,living.id];
      const originalSync=MoC.care.sync;
      let careSyncs=0;
      MoC.care.sync=function(){careSyncs++;return originalSync.call(MoC.care);};
      MoC.care.sync();
      finalizeAgentDeath(patient);
      const syncsAfterFinalization=careSyncs;
      const before={
        graves:GRAVE_MARKERS.length,
        naturalDeaths:EVENT_LOG.filter(e=>e.type==='natural_death').length,
        history:patient.actionHistory.filter(e=>e.type==='died').length,
        episodes:MoC.care.episodes.filter(e=>e.agentId===patient.id).length,
        waiting:MoC.care.snapshot().waiting,
        treatments:MoC.care.episodes.filter(e=>e.status==='treatment_started').length,
        finalizerSyncs:syncsAfterFinalization
      };
      Object.assign(patient,{hp:80,moved:false,behaviorState:'queuing',insideBuilding:null,
        queueType:'hospital',queueBuilding:'hospital'});
      QUEUES.hospital.agents=[patient.id,living.id];
      const startCount=erAdmissionCount;
      MoC.S.serviceCredit=1;
      tick();
      executeLLMAction(patient,{action:'self_medicate'});
      return {before,after:{
        graves:GRAVE_MARKERS.length,
        naturalDeaths:EVENT_LOG.filter(e=>e.type==='natural_death').length,
        history:patient.actionHistory.filter(e=>e.type==='died').length,
        state:patient.state,behavior:patient.behaviorState,hp:patient.hp,inside:patient.insideBuilding,
        finalized:patient.deathFinalized,
        moved:patient.moved,x:patient.x,y:patient.y,
        queueType:patient.queueType,queueBuilding:patient.queueBuilding,inQueue:QUEUES.hospital.agents.includes(patient.id),
        episodes:MoC.care.episodes.filter(e=>e.agentId===patient.id).map(e=>e.status),
        waiting:MoC.care.snapshot().waiting,
        treatments:MoC.care.episodes.filter(e=>e.status==='treatment_started').length,
        finalizerSyncs:careSyncs,livingBehavior:living.behaviorState,
        livingInQueue:QUEUES.hospital.agents.includes(living.id),
        livingEpisode:MoC.care.episodes.find(e=>e.agentId===living.id)?.status,
        starts:erAdmissionCount-startCount,serviceCredit:MoC.S.serviceCredit
      }};
    });
    assert.deepEqual(outcome.after,{
      graves:outcome.before.graves,naturalDeaths:outcome.before.naturalDeaths,history:outcome.before.history,
      state:'dead',behavior:'dead',hp:0,inside:null,finalized:true,moved:false,x:0.2,y:0.2,
      queueType:null,queueBuilding:null,inQueue:false,
      episodes:['died_waiting'],waiting:0,
      treatments:outcome.before.treatments+1,
      finalizerSyncs:outcome.before.finalizerSyncs+2,livingBehavior:'at_hospital',
      livingInQueue:false,livingEpisode:'treatment_started',starts:1,serviceCredit:0
    },'terminal cleanup must precede movement, queue capacity, care bookkeeping, and self-medication');
    assert.equal(outcome.before.episodes,1,'the waiting episode should be closed exactly once');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Natural mortality on the final term tick is finalized before the term ends', { timeout:30000 }, async()=>{
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage();
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,{waitUntil:'domcontentloaded'});
    const outcome=await page.evaluate(()=>{
      MoC.audio.setMuted(true); MoC.paused=false;
      const patients=agents.filter(a=>a.type==='patient'||a.type==='citizen');
      patients.forEach(a=>Object.assign(a,{moved:true,insideBuilding:'test-isolation',behaviorState:'roaming',
        state:'managed',conditions:[],hp:100}));
      const patient=patients[0];
      Object.assign(patient,{moved:false,insideBuilding:null,state:'managed',behaviorState:'queuing',age:90,
        hp:100,causeOfDeath:null,queueType:'hospital',queueBuilding:'hospital',waitWeeks:3});
      QUEUES.hospital.agents=[patient.id];
      modelTick=MoC.QUARTER_TICKS*MoC.TOTAL_QUARTERS-1;cycle=MoC.STARTUP_CYCLE+modelTick;
      MoC.S.quarter=MoC.TOTAL_QUARTERS;
      MoC.S.over=false;
      MoC.care.sync();
      const graves=GRAVE_MARKERS.length;
      const naturalDeaths=EVENT_LOG.filter(e=>e.type==='natural_death').length;
      const systemDeaths=EVENT_LOG.filter(e=>e.type==='died').length;
      const originalSeedTick=MoC.seedTick,originalAdvance=MoC.environment.advance;
      try {
        MoC.seedTick=function(c){originalSeedTick(c);Math.random=()=>0;};
        MoC.environment.advance=function(){};
        tick();
      } finally {
        MoC.seedTick=originalSeedTick;
        MoC.environment.advance=originalAdvance;
      }
      return {cycle:MoC.elapsedTick(),renderCycle:cycle,finalCycle:MoC.QUARTER_TICKS*MoC.TOTAL_QUARTERS,termOver:MoC.S.over,
        state:patient.state,behavior:patient.behaviorState,hp:patient.hp,finalized:patient.deathFinalized,
        cause:patient.causeOfDeath,ghostFloatTimer:patient.ghostFloatTimer,
        inQueue:QUEUES.hospital.agents.includes(patient.id),
        episode:MoC.care.episodes.find(e=>e.agentId===patient.id)?.status,
        history:patient.actionHistory.filter(e=>e.type==='died').length,
        graves:GRAVE_MARKERS.length-graves,
        naturalDeaths:EVENT_LOG.filter(e=>e.type==='natural_death').length-naturalDeaths,
        systemDeaths:EVENT_LOG.filter(e=>e.type==='died').length-systemDeaths};
    });
    assert.deepEqual(outcome,{cycle:416,renderCycle:446,finalCycle:416,termOver:true,state:'dead',behavior:'dead',
      hp:0,finalized:true,cause:'natural',ghostFloatTimer:90,inQueue:false,
      episode:'died_waiting',history:1,graves:1,naturalDeaths:1,systemDeaths:0});
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Recovery exits clear their protection from passive deterioration', { timeout:30000 }, async()=>{
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage();
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,{waitUntil:'domcontentloaded'});
    const outcome=await page.evaluate(()=>{
      MoC.audio.setMuted(true); MoC.paused=false;
      const patients=agents.filter(a=>a.type==='patient'||a.type==='citizen');
      patients.forEach(a=>{a.moved=true;a.insideBuilding='test-isolation';a.conditions=[];a.hp=100;});
      const patient=patients[0];
      Object.assign(patient,{moved:false,insideBuilding:null,behaviorState:'recovering',state:'active',
        hp:84,waitWeeks:12,healingTicksLeft:11,isNightOwl:true,lifeStage:'adult',
        workplace:null,workplacePos:null,homePos:null,pathComplete:true,path:[],
        conditions:[{code:'I25',name:'Chronic Ischemic Heart Disease',severity:'severe'}]});
      const queueLeavingPatient=patients[1];
      Object.assign(queueLeavingPatient,{moved:false,insideBuilding:null,behaviorState:'recovering',state:'active',
        hp:84,waitWeeks:12,healingTicksLeft:11,queueLeaveTimer:1,isNightOwl:true,lifeStage:'adult',
        workplace:null,workplacePos:null,homePos:null,pathComplete:true,path:[],lastGPCycle:2,
        conditions:[{code:'I25',name:'Chronic Ischemic Heart Disease',severity:'severe'}]});
      modelTick=1;cycle=MoC.STARTUP_CYCLE+modelTick;
      const oldRandom=Math.random;
      try {
        Math.random=()=>0.5;
        tick();
        const afterRecovery={hp:patient.hp,behavior:patient.behaviorState,healingTicksLeft:patient.healingTicksLeft};
        const hpBeforeRoaming=patient.hp;
        const afterQueueLeave={hp:queueLeavingPatient.hp,behavior:queueLeavingPatient.behaviorState,
          healingTicksLeft:queueLeavingPatient.healingTicksLeft};
        tick();
        return {...afterRecovery,hpAfterRoaming:patient.hp,hpBeforeRoaming,
          afterQueueLeave,hpAfterQueueLeave:queueLeavingPatient.hp};
      } finally {
        Math.random=oldRandom;
      }
    });
    assert.equal(outcome.behavior,'roaming','reaching the HP threshold should end recovery: '+JSON.stringify(outcome));
    assert.equal(outcome.healingTicksLeft,0,'roaming should not retain recovery protection');
    assert.ok(outcome.hpAfterRoaming<outcome.hpBeforeRoaming,'passive deterioration should resume on the next roaming tick');
    assert.equal(outcome.afterQueueLeave.behavior,'roaming','a queue-leave transition should exit recovery');
    assert.equal(outcome.afterQueueLeave.healingTicksLeft,0,'queue-leave roaming should clear recovery protection');
    assert.ok(outcome.hpAfterQueueLeave<outcome.afterQueueLeave.hp,'passive deterioration should resume on the queue-leave tick');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Shared conditions and no-action reference agree at the same dates', { timeout: 300000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  try {
    async function run(baseline, seed=2468, scenario='cabinetcrisis') {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.addInitScript(() => { window.requestAnimationFrame=()=>0; localStorage.setItem('moc_muted_v2','true'); });
      await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=${scenario}&seed=${seed}${baseline?'&baseline=1':''}`,{waitUntil:'domcontentloaded'});
      const result = await page.evaluate(() => {
        MoC.referencePolicy = true;
        MoC.paused=false;
        const target=MoC.TOTAL_QUARTERS*MoC.QUARTER_TICKS;
        let traceHash=0, tick75;
        for(let step=0;step<target && modelTick<target && !MoC.S.over;step++) {
          tick();
          const stateHash=hashCode(JSON.stringify({params:M.IST,agents:agents.map(a=>({id:a.id,hp:a.hp,x:a.x,y:a.y,behavior:a.behaviorState,chat:a.chatTimer,grief:a.grievingTimer,anxiety:a.systemAnxiety}))}));
          traceHash=hashCode(traceHash+':'+modelTick+':'+stateHash);
          if(modelTick===75)tick75=stateHash;
        }
        const checkpoints=Object.fromEntries(Object.entries(MoC.runSnapshots).filter(([tick])=>Number(tick)%52===0||Number(tick)===75||Number(tick)===target));
        return {schedule:MoC.environment?.schedule, log:MoC.environment?.log, snapshots:checkpoints,
          traceHash,tick75,policies:MoC.S.interventions, cycle:modelTick, inputError:MoC.lastInputError,
          error:document.querySelector('#moc-council')?.innerText};
      });
      await context.close(); return result;
    }
    const reference=await run(true), player=await run(false);
    assert.equal(reference.inputError,undefined,'supported scenario inputs and scheduled effects must remain valid');
    assert.equal(player.inputError,undefined);
    assert.ok(reference.schedule?.length, 'both paths must have a declared external schedule');
    assert.deepEqual(player.schedule,reference.schedule);
    assert.deepEqual(player.log,reference.log);
    assert.equal(player.traceHash,reference.traceHash,'full clinical traces must match');
    assert.deepEqual(Object.keys(player.snapshots),Object.keys(reference.snapshots));
    for(const tick of Object.keys(reference.snapshots)) assert.deepEqual(player.snapshots[tick],reference.snapshots[tick],'no-action snapshot at tick '+tick);
    assert.equal(reference.cycle,416);
    assert.equal(reference.policies.length,0);
    assert.ok(reference.tick75!==undefined,'early endings need exact-tick state, not interpolation');
    assert.notDeepEqual((await run(true,1357)).schedule, reference.schedule,'different seeds can produce different external conditions');
    const fullReference=await run(true,1357,'campaign');
    const fullPlayer=await run(false,1357,'campaign');
    assert.equal(fullReference.cycle,2080);
    assert.equal(fullReference.inputError,undefined);
    assert.equal(fullPlayer.inputError,undefined);
    assert.equal(fullPlayer.traceHash,fullReference.traceHash,'ten-year clinical traces must match');
    assert.deepEqual(Object.keys(fullPlayer.snapshots),Object.keys(fullReference.snapshots));
    for(const tick of Object.keys(fullReference.snapshots)) assert.deepEqual(fullPlayer.snapshots[tick],fullReference.snapshots[tick],'ten-year snapshot at tick '+tick);
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
});

test('Minister music continues through gameplay pauses and stops cleanly when muted', { timeout: 30000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const url = `http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript(() => {
      const OriginalAudio = window.Audio;
      window.testTracks = [];
      window.Audio = function(src) {
        const track = new OriginalAudio(src);
        window.testTracks.push(track);
        return track;
      };
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /TAKE OFFICE/ }).click();
    await page.waitForFunction(() => window.testTracks.some(t => t.src.includes('minister-theme') && t.currentTime > 0));
    assert.equal(await page.evaluate(() => MoC.audio.state().theme), 'file');
    const muted = await page.evaluate(() => {
      MoC.audio.sting();
      MoC.audio.setMuted(true);
      return { state:MoC.audio.state(), stopped:window.testTracks.every(t => t.paused) };
    });
    assert.equal(muted.stopped, true);
    assert.equal(muted.state.voices, 0);
    assert.equal(muted.state.theme, 'stopped');

    // Exercise missing-file fallback without requesting a nonexistent MP3.
    await page.route('**/assets/sfx/manifest.json', route => route.fulfill({ json:{ effects:[], title:false } }));
    await page.goto(url.replace('.html#', '.html?audio=fallback#'), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => MoC.audio.state().manifestLoaded);
    await page.evaluate(() => MoC.audio.setMuted(false));
    await page.getByRole('button', { name: /TAKE OFFICE/ }).click();
    await page.waitForFunction(() => MoC.audio.state().musicVoices > 0);
    for (let step = 0; step < 3; step++) await page.locator('#wc-next').click();
    await page.evaluate(() => { MoC.audio.setMuted(true); MoC.audio.setMuted(false); });
    await page.waitForFunction(() => MoC.audio.state().theme === 'fallback' && MoC.audio.state().musicVoices > 0);
    const launched = await page.evaluate(() => MoC.audio.state());
    assert.ok(launched.musicVoices > 0, 'unmuting gameplay should restart the soundtrack');
    assert.equal(launched.theme, 'fallback', 'gameplay pauses should keep the soundtrack active');
    const councilTheme = await page.evaluate(() => { window._mocForceCouncil(2); return MoC.audio.state().theme; });
    assert.equal(councilTheme, 'fallback', 'council-ready pause must not stop the soundtrack');

    // Stop while the manifest is unresolved; its eventual response must stay silent.
    await page.unroute('**/assets/sfx/manifest.json');
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/assets/sfx/manifest.json', async route => { await gate; await route.fulfill({ json:{ effects:[], title:true } }); });
    await page.goto(url.replace('.html#', '.html?audio=late#'), { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /TAKE OFFICE/ }).click();
    await page.evaluate(() => MoC.audio.setMuted(true));
    release();
    await page.waitForFunction(() => MoC.audio.state().titleFileAvailable);
    assert.equal(await page.evaluate(() => MoC.audio.state().theme), 'stopped');
    assert.equal(await page.evaluate(() => window.testTracks.every(track => track.paused)), true, 'late manifest cannot restart music after mute');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('Care reports preserve adverse outcomes and previews match purchases', { timeout: 30000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html?debug=1#scn=campaign&seed=2468`, { waitUntil:'domcontentloaded' });
    const result = await page.evaluate(() => {
      MoC.audio.setMuted(true);
      const person = agents.find(a=>a.type==='patient' && a.hp>0);
      person.waitWeeks=5;
      const hp = person.hp;
      MoC.onQuarter(6);
      const noForcedDeath = person.hp === hp && GRAVE_MARKERS.length === 0;
      const snapshot = MoC.care.snapshot();
      const difference = MoC.care.compare({...snapshot,systemDeaths:5},{...snapshot,systemDeaths:3});
      const wrongDate = MoC.care.compare(snapshot,{...snapshot,tick:snapshot.tick+1});
      const wrongModel = MoC.care.compare(snapshot,{...snapshot,modelVersion:'old'});
      person.behaviorState='going_to_hospital'; person.waitWeeks=15;
      MoC.care.sync();
      const episode = MoC.care.episodes.find(e=>e.agentId===person.id && e.status==='waiting');
      person.hp=0;
      MoC.care.sync();
      return { noForcedDeath, difference, wrongDate, wrongModel, exit:episode.status, validated:MoC.comparisonValidated };
    });
    assert.equal(result.noForcedDeath,true);
    assert.equal(result.difference.livesDifference,-2);
    assert.equal(result.wrongDate,null);
    assert.equal(result.wrongModel,null);
    assert.equal(result.exit,'died_waiting');
    assert.equal(result.validated,true,'paired protocol is available; actual benefits still require matching reference data');
    await page.evaluate(() => { document.getElementById('play-overlay')?.remove(); window._mocForceCouncil(2); });
    await openCouncilActions(page);
    const card = page.locator('[data-buy="scribes1"]');
    assert.match(await card.evaluate(el=>el.closest('.moc-item').innerText), /30% → 18%/);
    const burnoutBefore=await page.evaluate(()=>agents.filter(a=>a.type==='gp').map(a=>a.burnoutLevel||0));
    await card.click();
    assert.ok(Math.abs(await page.evaluate(()=>M.IST.admin)-0.184)<1e-9,
      'model9 retains adoption-scaled effect precision; percent copy rounds for display only');
    assert.match(await page.locator('#moc-policy-receipt').innerText(),/30% → 18%/);
    const rollout=await page.evaluate(()=>({burnout:agents.filter(a=>a.type==='gp').map(a=>a.burnoutLevel||0),strain:MoC.S.rolloutStrain,adoption:MoC.S.adoptionRate}));
    assert.ok(rollout.burnout.every((value,index)=>value>burnoutBefore[index]));
    assert.ok(rollout.strain>0);
    assert.equal(rollout.adoption,0.7);
    const trainedPreview=await page.evaluate(()=>{MoC.S.adoptionRate=1;return MoC.previewPolicy('scribes2');});
    assert.equal(trainedPreview._rolloutAdmin,undefined,'full adoption should remove rollout paperwork overhead');
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});

test('Early results match the reference date and replay preserves the prior attempt', { timeout: 45000 }, async () => {
  const server=await startSiteServer(), browser=await launchBrowser();
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('moc_muted_v2','true'));
  await page.route('**/api/leaderboard**',route=>route.fulfill({status:200,json:
    route.request().method()==='POST' ? {entry:{username:'Fixture Minister'},rank:1} : {entries:[]}}));
  try {
    const url=`http://127.0.0.1:${server.address().port}/minister.html?debug=1#scn=cabinetcrisis&seed=2468`;
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      document.getElementById('play-overlay')?.remove();
      MoC.referencePolicy=true;MoC.paused=false;
      for(let step=0;modelTick<75&&step<75;step++){
        const before=modelTick;tick();
        if(modelTick!==before+1)throw new Error(`Clock stopped at elapsed tick ${modelTick}; expected ${before+1}`);
      }
      if(modelTick!==75)throw new Error(`Clock did not reach elapsed tick 75; stopped at ${modelTick}`);
      MoC.referencePolicy=false;
      window._mocDebug.endTerm('noconfidence');
    });
    await page.locator('#moc-care-comparison').waitFor();
    await page.evaluate(()=>MoC.S._publishCompletedRun(true));
    const publishedScore=await page.locator('#moc-scoreval').innerText();
    await page.waitForFunction(()=>!!MoC.referenceAt(75),null,{timeout:25000});
    const pair=await page.evaluate(()=>({tick:MoC.S._finalSnapshot.tick,reference:MoC.referenceAt(75).tick,
      signed:MoC.care.compare(MoC.S._finalSnapshot,MoC.referenceAt(75)).livesDifference}));
    assert.deepEqual(pair,{tick:75,reference:75,signed:0});
    assert.match(await page.locator('#moc-care-comparison').innerText(),/Same date: tick 75/);
    assert.match(await page.locator('#moc-care-verdict').innerText(),/same number/i);
    assert.equal(await page.locator('#moc-scoreval').innerText(),publishedScore,'late comparison must not change the published score');
    assert.match(await page.locator('#moc-sharetext').textContent(),/Model system deaths below same-date reference \(signed\): 0/,
      'late matching care data must still refresh sharing detail under the unchanged protocol');
    const endCopy=await page.locator('#moc-endscreen').innerText();
    assert.doesNotMatch(endCopy,/not heroic|played it safe|your successor inherits|the system won|hard route|rare trifecta/i);
    assert.match(endCopy,/FINAL SCORE/);
    assert.match(endCopy,/Parliament ended the term/);
    assert.match(endCopy,/Observed simulation output, not clinical evidence/);
    assert.match(endCopy,/not proven preventability/);
    const forged=await page.evaluate(()=>{
      const before=MoC.baseline;
      window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{...MoC.baseline,systemDeaths:999}}));
      return before===MoC.baseline;
    });
    assert.equal(forged,true);
    await page.locator('#moc-again').click();
    await page.waitForURL(/&v=minister-care-10-access-time-replay/);
    await page.locator('#moc-takeoffice').waitFor();
    assert.match(await page.locator('#moc-previous-attempt').innerText(),/tick 75/);
    assert.equal(await page.evaluate(()=>MoC.previousRun.final.tick),75);
    assert.equal(await page.evaluate(()=>MoC.previousRun.modelVersion), 'minister-care-10-access-time-replay');
    assert.deepEqual(await page.evaluate(()=>MoC.previousRun.externalSchedule),await page.evaluate(()=>MoC.environment.schedule));
    assert.equal(await page.evaluate(()=>MoC.audio.isMuted()),true);
    // Controlled outcome fixture: political survival must not conceal worse care.
    await page.evaluate(()=>{
      document.getElementById('play-overlay')?.remove();
      MoC.referencePolicy=true;MoC.paused=false;
      for(let step=0;modelTick<75&&step<75;step++){
        const before=modelTick;tick();
        if(modelTick!==before+1)throw new Error(`Clock stopped at elapsed tick ${modelTick}; expected ${before+1}`);
      }
      if(modelTick!==75)throw new Error(`Clock did not reach elapsed tick 75; stopped at ${modelTick}`);
      MoC.referencePolicy=false;
      const reference=MoC.care.snapshot();
      GRAVE_MARKERS.push({name:'Fixture',age:70,cause:'system_failure',cycle:modelTick,waitWeeks:14});
      window._fixtureGraveTick=GRAVE_MARKERS.at(-1).cycle;
      MoC.baseline={protocol:MoC.REFERENCE_PROTOCOL,scheduleId:MoC.environment.scheduleId,modelVersion:MoC.MODEL_VERSION,
        seed:MoC.seed,scenario:MoC.S.scenario,snapshots:{75:reference}};
      MoC.S._cabinetResult='narrow';
      window._mocDebug.endTerm('served');
    });
    assert.match(await page.locator('#moc-care-verdict').innerText(),/more model-classified system deaths/);
    assert.equal(await page.locator('#moc-livesval').innerText(),'-1');
    assert.match(await page.locator('#moc-care-comparison').innerText(),/Previous attempt/);
    assert.equal(await page.evaluate(()=>window._fixtureGraveTick),75,'fixture grave timestamps must use elapsed model ticks');
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Completed runs publish automatically with a public or generated name', { timeout: 60000 }, async () => {
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(()=>localStorage.setItem('moc_muted_v2','true'));
  let submitted;
  let requestedSeed;
  await page.route('**/api/leaderboard**',async route=>{
    const request=route.request();
    if(request.method()==='POST') {
      submitted=request.postDataJSON();
      return route.fulfill({status:201,json:{entry:{...submitted,username:submitted.username||'Minister Silver Heron 468'},rank:2,duplicate:false}});
    }
    requestedSeed=new URL(request.url()).searchParams.get('seed');
    return route.fulfill({status:200,json:{entries:[
      {username:'Vera van den Broek',score:511,summary:{systemDeaths:1}},{username:'<img src=x onerror=alert(1)>',score:431,summary:{systemDeaths:2}}
    ]}});
  });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html?debug=1#scn=cabinetcrisis&seed=2468`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelectorAll('#moc-opening-board li').length===2);
    assert.deepEqual(await page.locator('#moc-opening-board strong').allTextContents(),['Vera van den Broek','<img src=x onerror=alert(1)>']);
    assert.equal(await page.locator('#moc-opening-board img').count(),0,'opening leaderboard names render as text');
    assert.match(await page.locator('.moc-name-entry').innerText(),/published automatically/);
    await page.evaluate(()=>{
      document.getElementById('play-overlay')?.remove();MoC.referencePolicy=true;MoC.paused=false;
      for(let step=0;modelTick<75&&step<75;step++){
        const before=modelTick;tick();
        if(modelTick!==before+1)throw new Error(`Clock stopped at elapsed tick ${modelTick}; expected ${before+1}`);
      }
      if(modelTick!==75)throw new Error(`Clock did not reach elapsed tick 75; stopped at ${modelTick}`);
      MoC.referencePolicy=false;
      agents.filter(agent=>agent.hp>0&&!agent.moved&&(agent.behaviorState==='going_to_hospital'||agent.behaviorState==='emergency'||(agent.behaviorState==='queuing'&&agent.queueType==='hospital')))
        .forEach(agent=>{agent.moved=true;agent.state='moved';});MoC.care.sync();
      const reference=MoC.care.snapshot();
      MoC.baseline={protocol:MoC.REFERENCE_PROTOCOL,scheduleId:MoC.environment.scheduleId,modelVersion:MoC.MODEL_VERSION,
        seed:MoC.seed,scenario:MoC.S.scenario,snapshots:{75:reference}};
      window._mocDebug.endTerm('served');
    });
    await page.locator('#moc-community').waitFor();
    await page.waitForFunction(()=>document.querySelector('#moc-community-status').textContent.includes('rank 2'));
    assert.equal(await page.locator('#moc-card').count(),0,'PNG score sharing is replaced by the leaderboard');
    assert.deepEqual(await page.locator('.moc-community-entry strong').allTextContents(),['Vera van den Broek','<img src=x onerror=alert(1)>']);
    assert.equal(requestedSeed,'2468');
    assert.equal(await page.locator('.moc-community-entry img').count(),0,'leaderboard names render as text');
    assert.equal(await page.locator('#moc-community-name,#moc-submit-score').count(),0,'publication is automatic, not an optional form');
    assert.equal(submitted.username,'');
    assert.equal(submitted.seed,2468);
    assert.equal(submitted.modelVersion,'minister-care-10-access-time-replay');
    assert.equal(submitted.endTick,75);
    assert.equal(typeof submitted.summary.meanWait,'number');
    assert.match(await page.locator('#moc-community-status').innerText(),/Published as Minister Silver Heron 468 · rank 2/);
    assert.match(await page.locator('#moc-care-comparison').innerText(),/No one currently waiting/);
    assert.doesNotMatch(await page.locator('#moc-care-comparison').innerText(),/0\.0w/);
    assert.match(await page.locator('#moc-care-comparison').innerText(),/Deaths before treatment/);
    const topChildren=await page.locator('#moc-endscreen .moc-box').evaluate(element=>[...element.children].slice(0,5).map(child=>child.className||child.id||child.tagName));
    assert.ok(topChildren.some(value=>String(value).includes('moc-score-hero')),'score should be at the top of the result');
    assert.ok(await page.evaluate(()=>document.body.scrollWidth<=390));
    await page.waitForFunction(()=>document.querySelector('#moc-endscreen .moc-box').getAnimations().every(animation=>animation.playState==='finished'));
    for (const viewport of [{width:375,height:667},{width:390,height:844},{width:412,height:915},{width:1440,height:900}]) {
      await page.setViewportSize(viewport);
      await page.evaluate(()=>window.scrollTo(0,0));
      assert.ok(await page.evaluate(width=>document.body.scrollWidth<=width,viewport.width),'result screen must not overflow at '+viewport.width+'px');
      for(const control of await page.locator('#moc-endscreen button:visible,#moc-endscreen input:visible,#moc-endscreen summary:visible').all()){
        const box=await control.boundingBox();
        const label=await control.evaluate(element=>(element.textContent||element.placeholder||element.id).trim());
        const modal=await page.locator('#moc-endscreen .moc-box').evaluate(element=>({scrollLeft:element.scrollLeft,clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,
          offenders:[...element.querySelectorAll('*')].filter(child=>child.scrollWidth>child.clientWidth+1).slice(0,5).map(child=>({tag:child.tagName,id:child.id,class:child.className,client:child.clientWidth,scroll:child.scrollWidth,text:child.textContent?.trim().slice(0,40)}))}));
        assert.ok(box&&box.height>=43.9&&box.x>=0&&box.x+box.width<=viewport.width+1,
          `result control "${label}" must be reachable at ${viewport.width}px (${JSON.stringify({box,modal})})`);
      }
    }
    await page.setViewportSize({width:375,height:667});
    await page.keyboard.press('Control++');await page.keyboard.press('Control++');
    assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth),'result screen must not overflow at 200% Chromium zoom');
    await page.keyboard.press('Control+0');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Town requests pause without a countdown', { timeout: 30000 }, async () => {
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(()=>localStorage.setItem('moc_muted_v2','true'));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      document.getElementById('play-overlay')?.remove();window._mocGameStarted=true;
      modelTick=182;cycle=MoC.STARTUP_CYCLE+modelTick;MoC.S.quarter=4;MoC.paused=false;MoC.onTick(modelTick);
    });
    await page.locator('.moc-flash').waitFor();
    assert.equal(await page.locator('.moc-flash .fbar').count(),0);
    assert.match(await page.locator('.moc-flash').innerText(),/Time is paused/);
    const before=await page.evaluate(()=>cycle);
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('.moc-flash').isVisible(),true,'request must remain until the player answers');
    assert.equal(await page.evaluate(()=>cycle),before);
    await page.locator('.moc-flash button').first().click();
    assert.equal(await page.locator('.moc-flash').count(),1,'request should show the applied effect before closing');
    assert.match(await page.locator('.moc-flash').innerText(),/Decision applied/);
    await page.getByRole('button',{name:/Continue to town/}).click();
    assert.equal(await page.locator('.moc-flash').count(),0);
    await page.evaluate(()=>{MoC.S.budget=0;window._mocForceFlash(0);});
    assert.equal(await page.getByRole('button',{name:/Assign case manager/}).isDisabled(),true);
    assert.match(await page.locator('.moc-flash').innerText(),/Unavailable: needs €5K, budget €0K/);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Minister full term respects council and year-end pauses', { timeout: 60000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => localStorage.setItem('moc_muted_v2','true'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=campaign&seed=2468`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /TAKE OFFICE/ }).click();
    for (let step = 0; step < 3; step++) await page.locator('#wc-next').click();
    assert.equal(await page.evaluate(() => MoC.paused), true, 'manifesto must pause the game');
    for (let index = 0; index < 3; index++) await page.locator('[data-promise]').nth(index).click();
    await page.locator('#moc-manifesto-done').click();
    await page.waitForFunction(() => cycle > 40);
    assert.deepEqual(await page.locator('.moc-kpi[data-promise]').evaluateAll(cards => cards.map(card => card.dataset.promise)), ['waits', 'nodeaths', 'admin'], 'only signed promises should appear as KPIs');
    const targets = await page.evaluate(() => {
      const waiting = agents.filter(a => a.hp>0 && !a.moved && (a.behaviorState==='going_to_hospital' || a.behaviorState==='emergency' || a.queueType==='hospital'));
      const episodes = MoC.care.episodes.filter(e=>e.status==='waiting');
      const original = { waits:waiting.map(a=>a.waitWeeks), starts:episodes.map(e=>e.startTick), admin:M.IST.admin };
      waiting.forEach(a=>a.waitWeeks=8); episodes.forEach(e=>e.startTick=modelTick-32); M.IST.admin = 0.15;
      MoC.refreshMinistry();
      const atBoundary = [...document.querySelectorAll('.moc-kpi[data-promise]')].map(card => ({ id: card.dataset.promise, met: card.dataset.met }));
      waiting.forEach(a=>a.waitWeeks=8.01); episodes.forEach(e=>e.startTick=modelTick-32.04); M.IST.admin = 0.149;
      MoC.refreshMinistry();
      const outside = [...document.querySelectorAll('.moc-kpi[data-promise]')].map(card => ({ id: card.dataset.promise, met: card.dataset.met }));
      waiting.forEach((a,i)=>a.waitWeeks=original.waits[i]); episodes.forEach((e,i)=>e.startTick=original.starts[i]); M.IST.admin = original.admin;
      MoC.refreshMinistry();
      return { atBoundary, outside };
    });
    assert.equal(targets.atBoundary.find(t => t.id === 'waits').met, 'true', 'wait target includes exactly 8 weeks');
    assert.equal(targets.atBoundary.find(t => t.id === 'admin').met, 'false', 'admin target excludes exactly 15%');
    assert.equal(targets.outside.find(t => t.id === 'waits').met, 'false');
    assert.equal(targets.outside.find(t => t.id === 'admin').met, 'true');

    // Exercise each real boundary and council, without waiting for wall-clock quarters.
    for (let quarter = 2; quarter <= 5; quarter++) {
      const target = (quarter - 1) * 52;
      for (let interruption = 0; interruption < 4; interruption++) {
        await page.evaluate(targetTick => {
          clearInterval(autoTimer); autoTimer = null;
          for (let ticks = 0; modelTick < targetTick && !MoC.paused && ticks < 52; ticks++) tick();
        }, target);
        const request = page.locator('.moc-flash button:not(:disabled)');
        if (await request.count()) { await request.first().click(); continue; }
        break;
      }
      if (quarter === 5) {
        await page.locator('#moc-yearend').waitFor();
        const frozen = await page.evaluate(() => {
          const before = cycle;
          launchSimulation();
          document.getElementById('moc-spd4').click();
          tick();
          return { cycleUnchanged: cycle === before, paused: MoC.paused, timer: !!autoTimer };
        });
        assert.deepEqual(frozen, { cycleUnchanged: true, paused: true, timer: false });
        await page.locator('#moc-yearend-btn').click();
      }
      await page.locator('#moc-town-council').waitFor();
      assert.equal(await page.locator('#moc-council').count(), 0);
      assert.equal(await page.evaluate(() => MoC.S._councilDue), quarter);
      await page.locator('#moc-town-council').click();
      await openCouncilActions(page);
      await page.locator('#moc-wiz-next').click();
      assert.equal(await page.evaluate(() => MoC.paused), false);
      assert.equal(await page.evaluate(() => MoC.S._speed), 1);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('Minister cabinet crisis starts after phone walkthrough and reaches council', { timeout: 60000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 404, height: 510 } });
  const pageErrors = [];
  const failedRequests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(request.url()));

  try {
    await page.addInitScript(() => {
      localStorage.setItem('moc_muted_v2','true');
      const original = window.setTimeout;
      window.setTimeout = function(callback, delay, ...args) {
        if (delay === 45000) window.fireStartupWatchdog = callback;
        return original(callback, delay, ...args);
      };
    });
    const address = server.address();
    await page.goto(`http://127.0.0.1:${address.port}/minister.html?test=1#scn=cabinetcrisis&seed=2468`, {
      waitUntil: 'networkidle',
    });
    await page.getByRole('button', { name: /TAKE OFFICE/ }).click();

    for (let step = 0; step < 3; step += 1) {
      const nextButton = page.locator('#wc-next');
      const box = await nextButton.boundingBox();
      assert.ok(box, `walkthrough step ${step + 1} button should be visible`);
      assert.ok(box.y >= 0 && box.y + box.height <= 510, `walkthrough step ${step + 1} button should fit the viewport`);
      await nextButton.click();
    }

    const startedAt = await page.evaluate(() => cycle);
    await page.waitForFunction((initialCycle) => cycle > initialCycle, startedAt);
    assert.equal(await page.evaluate(() => MoC.S._speed), 1, 'short mode should start at normal speed');
    assert.equal(await page.locator('.moc-kpi').count(), 5, 'short mode should show its five survival targets, not unsigned promises');
    assert.equal(await page.locator('.moc-kpi[data-promise]').count(), 0);
    assert.match(await page.locator('.moc-kpi[data-kpi="trustC"]').innerText(), /35/);
    assert.match(await page.locator('.moc-kpi[data-kpi="deaths"]').innerText(), /5 deaths/);
    const cabinetThresholds = await page.evaluate(() => {
      const original = {c:MoC.S.trustC,d:MoC.S.trustD,p:MoC.S.trustP};
      MoC.S.trustC=35;MoC.S.trustD=35;MoC.S.trustP=35;
      const atFloor=window._mocEvaluateElection({deathCap:100});
      MoC.S.trustP=34;
      const belowFloor=window._mocEvaluateElection({deathCap:100});
      Object.assign(MoC.S,{trustC:original.c,trustD:original.d,trustP:original.p});
      return {trustFloor:atFloor.trustFloor,deathCap:window._mocEvaluateElection().deathCap,atFloor:atFloor.passes,belowFloor:belowFloor.passes};
    });
    assert.deepEqual(cabinetThresholds,{trustFloor:35,deathCap:5,atFloor:true,belowFloor:false});
    assert.match(await page.locator('[data-town-person]').first().evaluate(el => getComputedStyle(el).fontFamily), /VT323/, 'citizen names should use the game font');
    const boundary = await page.evaluate(() => {
      clearInterval(autoTimer); autoTimer = null;
      const oldReferencePolicy=MoC.referencePolicy,oldPaused=MoC.paused;
      const advanceTo=target=>{
        const limit=Math.max(0,target-modelTick);
        for(let step=0;modelTick<target&&step<limit;step++){
          const before=modelTick;tick();
          if(modelTick!==before+1)throw new Error(`Clock stopped at elapsed tick ${modelTick}; expected ${before+1}`);
        }
        if(modelTick!==target)throw new Error(`Clock did not reach elapsed tick ${target}; stopped at ${modelTick}`);
      };
      MoC.referencePolicy=true;MoC.paused=false;
      try {
        advanceTo(51);
        MoC.referencePolicy=oldReferencePolicy;
        MoC.paused=false;
        const person = agents.find(a => a.type === 'patient' && a.state !== 'dead');
        person.hp = 0;
        const original = MoC.onQuarter;
        let stateAtCouncil;
        MoC.onQuarter = function(q) {
          original(q);
          stateAtCouncil = { dead: person.state === 'dead', graves: GRAVE_MARKERS.length };
        };
        try {
          advanceTo(52);
          const after = GRAVE_MARKERS.length;
          return { stateAtCouncil, after, processed: person.hpHistory.length, paused:MoC.paused };
        } finally {
          MoC.onQuarter = original;
        }
      } finally {
        MoC.referencePolicy=oldReferencePolicy;
        MoC.paused=oldPaused;
      }
    });
    assert.equal(boundary.stateAtCouncil.dead, true, 'clinical tick must finish before council boundary');
    assert.equal(boundary.stateAtCouncil.graves, boundary.after, 'no deaths may occur after council pause');
    assert.equal(boundary.paused, true, 'normal council handling must pause after the setup fast-forward');
    await page.locator('#moc-town-council').waitFor();
    assert.equal(await page.locator('#moc-council').count(), 0, 'council must wait for the player');
    assert.equal(await page.locator('#moc-town-toggle').isVisible(), false, 'resume control must be hidden while council is due');
    const readyBox = await page.locator('#moc-town-council').boundingBox();
    assert.ok(readyBox && readyBox.height >= 44 && readyBox.x >= 0 && readyBox.x + readyBox.width <= 405, 'council-ready control must fit the phone');
    await page.evaluate(()=>{
      const care=MoC.care.snapshot();
      MoC.S._councilKpis=[{q:1,trustC:MoC.S.trustC-2,trustD:MoC.S.trustD-1,trustP:MoC.S.trustP-3,
        deaths:Math.max(0,care.systemDeaths-1),waiting:care.waiting+2,meanWait:care.meanWait+1,treatments:Math.max(0,care.treatments-1),
        admin:M.IST.admin*100,sick:M.IST.sick*100,dependence:MoC.S.dependence,fragmentation:MoC.S.fragmentation||0,burnout:0}];
      MoC.S.pendingBanners.push({head:'Flu wave',body:'Staff absence +3 points. Active this quarter.',soft:true,open:true});
    });
    await page.locator('#moc-town-council').click();
    assert.match(await page.locator('.moc-quarter-trends').innerText(),/vs Q1/);
    assert.match(await page.locator('.moc-gazette').innerText(),/The specialist list|first quarterly reading/i);
    const fluReport=page.locator('details.moc-dilemma').filter({has:page.locator('summary',{hasText:'Flu wave'})}).first();
    assert.equal(await fluReport.getAttribute('open'),'');
    const frozen = await page.evaluate(() => {
      const snapshot = () => JSON.stringify({ cycle, hp: agents.map(a => a.hp), graves: GRAVE_MARKERS, events: EVENT_LOG.length });
      const before = snapshot();
      window.fireStartupWatchdog();
      launchSimulation();
      document.getElementById('moc-spd4').click();
      for (let i = 0; i < 10; i++) tick();
      return { same: before === snapshot(), paused: MoC.paused, timer: !!autoTimer };
    });
    assert.deepEqual(frozen, { same: true, paused: true, timer: false }, 'watchdog, launch and speed controls must respect council pause');

    const state = await page.evaluate(() => ({
      elapsed:MoC.elapsedTick(),
      paused: MoC.paused,
      timerRunning: Boolean(autoTimer),
    }));
    assert.ok(state.elapsed >= 52, 'simulation should advance to the first quarterly council');
    assert.equal(state.paused, true, 'the council should pause the simulation');
    assert.equal(state.timerRunning, false, 'the council should stop the tick timer');

    assert.match(await page.locator('#moc-wiz-tabs').innerText(), /1\. Briefing\n(?:2\. Decision\n3\. Law\n4\. Fund|2\. Law\n3\. Fund)/);
    await page.locator('#moc-inspect-town').click();
    assert.equal(await page.locator('#moc-council').isVisible(), false);
    assert.equal(await page.locator('[data-town-person]').count(), 3);
    await page.locator('[data-town-person]').first().click();
    assert.ok(await page.locator('#moc-town-person').innerText());
    assert.equal(await page.locator('.moc-follow-thought').isVisible(), true, 'followed resident should show a thought prominently');
    assert.ok(await page.locator('.moc-follow-tag').count(), 'followed resident should show health context');
    await page.locator('#moc-town-council').click();
    for(let step=0;step<3&&!(await page.locator('#moc-laws').count());step++){
      const choices=page.locator('#moc-council .moc-opt:not(:disabled)');if(await choices.count())await choices.first().click();
      await page.locator('#moc-wiz-next').click();
    }
    assert.ok(await page.locator('#moc-laws [data-law]').count(), 'law stage should visibly offer legislation');
    assert.match(await page.locator('#moc-wiz-body').innerText(),/PASS A LAW/);
    assert.equal(await page.locator('#moc-shop').count(),0,'funding must be on a separate screen');
    await page.locator('#moc-wiz-next').click();
    assert.ok(await page.locator('#moc-shop [data-buy]').count(), 'fund stage should offer interventions');
    assert.match(await page.locator('.moc-priority-strip').innerText(),/PRIORITIES BEFORE YOU SPEND/);
    const canvasBeforeHire = await page.locator('#cv').evaluate((canvas) => canvas.toDataURL());
    await page.getByRole('button', { name: /Buy €80K/ }).click();
    const hireEffect = await page.evaluate(() => window._mocWorldEffects?.hire);
    const canvasAfterHire = await page.locator('#cv').evaluate((canvas) => canvas.toDataURL());
    assert.equal(hireEffect?.level, 1, 'recruiting a specialist should create a hospital world effect');
    assert.notEqual(canvasAfterHire, canvasBeforeHire, 'the hospital should redraw immediately after recruitment');
    assert.match(await page.locator('#moc-policy-receipt').innerText(), /Recruit|Specialist/i);

    const councilCycle = await page.evaluate(() => cycle);
    await page.locator('#moc-wiz-next').click();
    await page.waitForFunction((initialCycle) => cycle > initialCycle, councilCycle);
    assert.equal(await page.locator('#moc-council').count(), 0, 'council should close after the action stage');
    assert.equal(await page.evaluate(() => window._mocWorldEffects?.hire?.level), 1, 'hospital staffing marker should persist after council');
    assert.match(await page.locator('#moc-town-change').innerText(), /wait|Admin/i, 'town should show measured changes after the purchase');
    assert.equal(await page.locator('#moc-town-council').isVisible(), false, 'council-ready control must be hidden during the quarter');
    assert.equal(await page.locator('#moc-town-toggle').isVisible(), true, 'player must be able to pause and inspect the running town');
    assert.ok(await page.evaluate(()=>document.getElementById('panel').scrollTop<=6),'council exit should focus the KPI summary');
    await page.locator('#moc-town-toggle').click();
    assert.equal(await page.evaluate(() => MoC.paused), true);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 412, height: 915 }, { width: 375, height: 667 }]) {
      await page.setViewportSize(viewport);
      for (const button of await page.locator('#moc-town-watch button:visible').all()) {
        const box = await button.boundingBox();
        assert.ok(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= viewport.width + 1, 'town controls should be touch-sized and within the viewport');
      }
      for (const card of await page.locator('.moc-kpi:visible').all()) {
        const box = await card.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= viewport.width + 1, 'target cards must fit without horizontal scrolling');
        if (viewport.width <= 768) assert.ok(box.height <= 60, 'mobile target cards must stay compact');
      }
      if (viewport.width <= 768) {
        const mandateBox = await page.locator('.moc-mandate').boundingBox();
        assert.ok(mandateBox && mandateBox.height <= 270, 'mobile target dashboard must leave room for gameplay controls');
      }
    }
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(failedRequests, []);
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Town routes never enter blocked map geometry', { timeout: 30000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`, { waitUntil:'domcontentloaded' });
    const routeAudit = await page.evaluate(() => {
      const blockedNodes = ROAD_WAYPOINTS.filter(point => isInWater(point.x, point.y)).length;
      let blockedEdges = 0;
      WAYPOINT_ADJ.forEach((edges, from) => edges.forEach(to => {
        const a = ROAD_WAYPOINTS[from], b = ROAD_WAYPOINTS[to];
        for (let sample = 0; sample <= 20; sample++) {
          const progress = sample / 20;
          if (isInWater(a.x + (b.x - a.x) * progress, a.y + (b.y - a.y) * progress)) {
            blockedEdges++; break;
          }
        }
      }));
      let blockedPositions = 0, maxJump = 0;
      for (let step = 0; step < 250; step++) {
        cycle++;
        const before = new Map(agents.map(agent => [agent.id, { x:agent.x, y:agent.y }]));
        advanceTownMovement();
        agents.filter(agent => !agent.insideBuilding && agent.hp > 0 && agent.type !== 'gp' && agent.type !== 'specialist').forEach(agent => {
          const previous = before.get(agent.id);
          maxJump = Math.max(maxJump, Math.hypot(agent.x - previous.x, agent.y - previous.y));
          if (isInWater(agent.x, agent.y)) blockedPositions++;
        });
      }
      return { blockedNodes, blockedEdges, blockedPositions, maxJump };
    });
    assert.equal(routeAudit.blockedNodes, 0);
    assert.equal(routeAudit.blockedEdges, 0);
    assert.equal(routeAudit.blockedPositions, 0);
    assert.ok(routeAudit.maxJump < 0.015, `movement jump ${routeAudit.maxJump} should stay within one walking step`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});

test('Desktop play uses one uncluttered Ministry panel and explains immediate request effects', { timeout: 30000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
  await page.addInitScript(() => localStorage.setItem('moc_muted_v2','true'));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html?desktop-regression=1#scn=cabinetcrisis&seed=2468`, { waitUntil:'domcontentloaded' });
    const name = page.locator('#moc-player-name');
    assert.equal(await name.count(), 1, 'the first game screen should ask for a public player name');
    const generatedNames = [await name.inputValue()];
    for (let index = 0; index < 5; index++) {
      await page.locator('#moc-generate-name').click();
      generatedNames.push(await name.inputValue());
    }
    generatedNames.forEach(generated => {
      assert.match(generated, /^[\p{L}\p{N} ._'-]{2,24}$/u);
      assert.ok(generated.length <= 24);
    });
    assert.equal(new Set(generatedNames).size, generatedNames.length, 'successive random names should be distinct');
    assert.ok(generatedNames.some(generated => generated.startsWith('The ')));
    assert.ok(generatedNames.some(generated => generated.endsWith(' of Cammelot')));
    assert.ok(generatedNames.some(generated => generated.startsWith('Minister ')));
    await page.locator('#moc-takeoffice').click();
    for (let step = 0; step < 3; step++) await page.locator('#wc-next').click();
    await page.waitForFunction(() => window._mocGameStarted && document.getElementById('moc-town-watch'));

    const layout = await page.evaluate(() => ({
      detail:document.getElementById('panel').dataset.mocDetail,
      panel:document.getElementById('panel').getBoundingClientRect().width,
      tabs:document.getElementById('moc-panel-tabs'),
      detailVisible:getComputedStyle(document.getElementById('agent-detail')).display !== 'none',
      headerVisible:getComputedStyle(document.querySelector('.panel-header')).display !== 'none',
      ministryVisible:getComputedStyle(document.getElementById('moc-ministry')).display !== 'none',
      legacyOverviewVisible:getComputedStyle(document.getElementById('sim-overview')).display !== 'none',
    }));
    assert.equal(layout.detail, 'false');
    assert.equal(layout.tabs, null, 'the redundant Town Feed/Ministry tabs should be removed');
    assert.equal(layout.detailVisible, false, 'the legacy event stream should not occupy the default panel');
    assert.equal(layout.headerVisible, false);
    assert.equal(layout.ministryVisible, true);
    assert.equal(layout.legacyOverviewVisible, false, 'duplicate legacy overview should not crowd the Ministry');
    assert.ok(layout.panel >= 340, 'desktop Ministry panel should remain readable');

    await page.locator('#moc-town-watch summary').click();
    const runningBeforeFollow=await page.evaluate(()=>({paused:MoC.paused,cycle}));
    await page.locator('[data-town-person]').first().click();
    assert.equal(await page.locator('#panel').getAttribute('data-moc-detail'), 'false');
    assert.equal(await page.locator('#moc-ministry').isVisible(), true);
    assert.equal(await page.evaluate(()=>MoC.paused),runningBeforeFollow.paused,'following a person must preserve simulation state');
    assert.equal(await page.locator('.moc-follow-thought').isVisible(), true);
    assert.match(await page.locator('.moc-follow-now').innerText(), /Now:/);
    await page.locator('[data-town-person]').nth(1).click();
    assert.match(await page.locator('.moc-follow-role').innerText(), /Practitioner|Doctor|GP/i);
    assert.match(await page.locator('.moc-follow-card').innerText(), /Burnout|waiting here|On duty|Off sick/);

    await page.evaluate(() => window._mocForceFlash(1));
    await page.getByRole('button', { name:'Continue digitally' }).click();
    assert.equal(await page.locator('.moc-flash').count(), 1, 'the request should remain open after the decision');
    assert.match(await page.locator('.moc-flash').innerText(), /Decision applied|No immediate modeled change/);
    await page.getByRole('button', { name:/Continue to town/ }).click();

    await page.evaluate(() => window._mocForceCouncilReady(2));
    const banner = page.locator('#moc-council-ready-banner');
    await banner.waitFor();
    assert.match(await banner.innerText(), /COUNCIL READY/);
    assert.equal(await page.evaluate(() => MoC.paused), true);
    await banner.getByRole('button', { name:'OPEN COUNCIL' }).click();
    const newspaper = page.locator('.moc-gazette').first();
    assert.equal(await newspaper.evaluate(element => getComputedStyle(element, '::before').content), '"CAMMELOT QUARTERLY"');
    const newspaperText = await newspaper.innerText();
    assert.match(newspaperText, /Average specialist wait:/);
    assert.match(newspaperText, /Treatment starts:/);
    assert.doesNotMatch(newspaperText, /STUDYING THE DOSSIER|WHAT IS THE MINISTER WAITING FOR|YOU HAVE BEEN WARNED|WHITE COATS WALK OUT/);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});

test('Android unmute starts media inside the user gesture', { timeout: 30000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport:{ width:412, height:915 }, isMobile:true, hasTouch:true });
  await page.addInitScript(() => {
    localStorage.setItem('moc_muted_v2', 'true');
    window.testPlayCalls = [];
    window.testGestureActive = false;
    const markGesture = () => {
      window.testGestureActive = true;
      setTimeout(() => { window.testGestureActive = false; }, 0);
    };
    document.addEventListener('pointerdown', markGesture, true);
    document.addEventListener('click', markGesture, true);
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() {
      window.testPlayCalls.push({ src:this.src, insideGesture:window.testGestureActive });
      return originalPlay.call(this);
    };
  });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html?android-audio=1#scn=cabinetcrisis&seed=2468`, { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => MoC.audio.state().manifestLoaded);
    await page.locator('#moc-takeoffice').tap();
    for (let step = 0; step < 3; step++) await page.locator('#wc-next').tap();
    await page.locator('#moc-mute').tap();
    await page.waitForFunction(() => window.testPlayCalls.some(call => call.src.includes('minister-theme')));
    const call = await page.evaluate(() => window.testPlayCalls.find(call => call.src.includes('minister-theme')));
    assert.equal(call.insideGesture, true, 'Android media playback must be called synchronously from the unmute tap');
    assert.equal(await page.evaluate(() => MoC.audio.isMuted()), false);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
// ── Issue #12: keyboard, focus and screen-reader behaviour of Minister overlays ──
async function withAccessibleGame(run, query = '', scenario = 'cabinetcrisis') {
  const server = await startSiteServer(), browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('moc_muted_v2', 'true'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const request = route.request();
    if (request.method() !== 'GET') return route.abort();
    if (!request.url().startsWith(`http://127.0.0.1:${server.address().port}/`))
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return route.continue();
  });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html${query || '?a11y=1'}#scn=${scenario}&seed=2468`, { waitUntil: 'domcontentloaded' });
    await page.locator('#moc-takeoffice').click();
    for (let step = 0; step < 3; step++) await page.locator('#wc-next').click();
    await page.waitForFunction(() => window._mocGameStarted && document.getElementById('moc-town-watch'));
    await page.evaluate(() => { document.getElementById('moc-town-watch').open = true; });
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
const activeId = page => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
const inertCount = page => page.evaluate(() => document.querySelectorAll('[inert]').length);
const focusInside = (page, selector) => page.evaluate(selector => !!document.querySelector(selector)?.contains(document.activeElement), selector);
async function assertFocusTrapped(page, selector) {
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let index = 0; index < 40; index++) {
      await page.keyboard.press(key);
      assert.equal(await focusInside(page, selector), true, `${key} press ${index + 1} must stay inside ${selector}`);
    }
  }
}
const waitForAnnouncement = (page, pattern, region = 'moc-a11y-status') =>
  page.waitForFunction(([id, source]) => new RegExp(source, 'i').test(document.getElementById(id)?.textContent || ''), [region, pattern.source], { timeout: 5000 });
async function assertBackgroundInert(page, dialogSelector) {
  const leaks = await page.evaluate(dialogSelector => {
    const dialog = document.querySelector(dialogSelector);
    const live = [...document.querySelectorAll('[data-moc-a11y-live]')];
    const reachable = [...document.querySelectorAll('button,a[href],input,select,summary,[tabindex]')]
      .filter(el => !dialog.contains(el) && !live.some(l => l.contains(el)) && !el.closest('[inert]') && !el.disabled && el.getClientRects().length);
    return reachable.map(el => el.id || el.className || el.tagName).slice(0, 5);
  }, dialogSelector);
  assert.deepEqual(leaks, [], 'no control outside the modal may stay keyboard- or pointer-reachable');
}

test('Issue 12: town request is a labelled modal, traps focus, ignores Escape and restores focus', { timeout: 60000 }, async () => {
  await withAccessibleGame(async page => {
    await page.locator('#moc-town-toggle').focus();
    await page.evaluate(() => window._mocForceFlash(1));
    const flash = page.locator('.moc-flash');
    await flash.waitFor();
    const meta = await flash.evaluate(el => ({
      role: el.getAttribute('role'), modal: el.getAttribute('aria-modal'),
      name: document.getElementById(el.getAttribute('aria-labelledby'))?.textContent,
      description: document.getElementById(el.getAttribute('aria-describedby'))?.textContent,
      focused: document.activeElement === el,
    }));
    assert.equal(meta.role, 'dialog');
    assert.equal(meta.modal, 'true');
    assert.ok(meta.name && meta.name.length > 3, 'request needs an accessible name');
    assert.match(meta.description, /Time is paused/);
    assert.equal(meta.focused, true, 'opening focus moves into the request dialog');
    await assertBackgroundInert(page, '.moc-flash');
    await assertFocusTrapped(page, '.moc-flash');

    await page.keyboard.press('Escape');
    assert.equal(await flash.count(), 1, 'Escape must not dismiss a mandatory request');
    assert.equal(await page.locator('#moc-fa').isEnabled() && await page.locator('#moc-fb').isEnabled(), true, 'both choices stay available');
    await waitForAnnouncement(page, /Escape does not close/);

    await page.locator('#moc-fa').focus();
    const outline = await page.locator('#moc-fa').evaluate(el => getComputedStyle(el).outlineWidth + ' ' + getComputedStyle(el).outlineStyle);
    assert.match(outline, /^3px (solid|auto)$/, 'keyboard focus must have a visible ring');
    await page.keyboard.press('Enter');
    await page.locator('#moc-flash-continue').waitFor();
    assert.equal(await activeId(page), 'moc-flash-continue');
    await waitForAnnouncement(page, /Decision applied/);
    await page.keyboard.press('Escape');
    assert.equal(await flash.count(), 1, 'Escape must not skip the applied result');
    await page.keyboard.press('Enter');
    assert.equal(await flash.count(), 0);
    assert.equal(await inertCount(page), 0, 'background is released after the request closes');
    assert.equal(await activeId(page), 'moc-town-toggle', 'focus returns to the control that was focused before the request');
  });
});

test('Issue 12: council is keyboard operable, Inspect town keeps choices, and exit restores focus', { timeout: 90000 }, async () => {
  await withAccessibleGame(async page => {
    const before = await page.evaluate(() => ({ tick: modelTick, cycle, paused: MoC.paused }));
    await page.evaluate(() => window._mocForceCouncilReady(2));
    await page.locator('#moc-council-ready').focus();
    await page.keyboard.press('Enter');
    const council = page.locator('#moc-council');
    await council.waitFor();
    const dialog = '#moc-council .moc-box';
    const meta = await page.locator(dialog).evaluate(el => ({
      role: el.getAttribute('role'), modal: el.getAttribute('aria-modal'),
      name: document.getElementById(el.getAttribute('aria-labelledby'))?.textContent, focused: document.activeElement === el }));
    assert.equal(meta.role, 'dialog'); assert.equal(meta.modal, 'true');
    assert.match(meta.name, /Quarterly Council/);
    assert.equal(meta.focused, true);
    assert.equal(await page.locator('#moc-wiz-tabs [aria-current="step"]').count(), 1);
    await assertBackgroundInert(page, '#moc-council');
    await assertFocusTrapped(page, '#moc-council');
    await page.keyboard.press('Escape');
    assert.equal(await council.count(), 1, 'Escape never closes the council');

    // Inspect town hides the council without discarding it, and hands the keyboard to the town.
    await page.locator('#moc-inspect-town').focus();
    await page.keyboard.press('Enter');
    assert.equal(await council.isVisible(), false);
    assert.equal(await inertCount(page), 0, 'town is usable while the council is hidden');
    assert.equal(await activeId(page), 'moc-town-council');
    await waitForAnnouncement(page, /Council hidden.*choices are kept/);
    await page.keyboard.press('Enter');
    assert.equal(await council.isVisible(), true);
    assert.equal(await focusInside(page, dialog), true);
    await assertBackgroundInert(page, '#moc-council');

    // Walk every council step with the keyboard only; a decision survives Escape.
    for (let step = 0; step < 4 && !(await page.locator('#moc-shop').count()); step++) {
      const choice = page.locator('#moc-council .moc-opt:not(:disabled)').first();
      if (await choice.count()) {
        assert.equal(await page.locator('#moc-wiz-next').isDisabled(), true, 'decision is mandatory before Next');
        await choice.focus();
        await page.keyboard.press('Escape');
        assert.equal(await council.count(), 1);
        assert.equal(await page.locator('#moc-wiz-next').isDisabled(), true, 'Escape must not auto-resolve the decision');
        await page.keyboard.press('Enter');
        assert.equal(await activeId(page), 'moc-wiz-next', 'focus moves to Next after the chosen option is disabled');
        await waitForAnnouncement(page, /Decision recorded/);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#moc-wiz-next').isEnabled(), true, 'recorded decision survives Escape');
      }
      await page.locator('#moc-wiz-next').focus();
      await page.keyboard.press('Enter');
      assert.equal(await activeId(page), 'moc-wiz-body', 'new step receives focus');
      await waitForAnnouncement(page, /Step \d of \d/);
    }
    assert.ok(await page.locator('#moc-shop').count(), 'council reaches funding by keyboard');
    await page.locator('#moc-wiz-next').focus();
    await page.keyboard.press('Enter');
    assert.equal(await council.count(), 0);
    assert.equal(await inertCount(page), 0);
    assert.equal(await activeId(page), 'moc-town-toggle', 'focus returns to the town controls after the council');
    assert.equal(await page.evaluate(() => MoC.paused), false);
    assert.ok(await page.evaluate(() => modelTick) >= before.tick, 'accessibility changes must not rewind or edit the model clock');
  });
});

test('Issue 12: confidence vote and year-end results are mandatory modal states', { timeout: 60000 }, async () => {
  await withAccessibleGame(async page => {
    await page.locator('#moc-town-toggle').focus();
    await page.evaluate(() => { Object.assign(MoC.S, { trustP: 18, trustC: 60, trustD: 60 }); MoC.onQuarter(2); });
    const vote = page.locator('#moc-vote');
    await vote.waitFor();
    const dialog = '#moc-vote .moc-box';
    assert.equal(await page.locator(dialog).getAttribute('role'), 'dialog');
    assert.match(await page.locator(dialog).evaluate(el => document.getElementById(el.getAttribute('aria-labelledby')).textContent), /NO CONFIDENCE/);
    assert.equal(await focusInside(page, dialog), true);
    await assertBackgroundInert(page, '#moc-vote');
    await assertFocusTrapped(page, '#moc-vote');
    await page.keyboard.press('Escape');
    assert.equal(await vote.count(), 1, 'Escape cannot dodge the vote');
    assert.equal(await page.locator('[data-vote]:enabled').count(), 3, 'all vote choices remain');
    const budget = await page.evaluate(() => MoC.S.budget);
    await page.locator('[data-vote="sacrifice"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await vote.count(), 0);
    assert.equal(await page.evaluate(() => MoC.S.budget), budget - 100000, 'vote outcome is unchanged by accessibility handling');
    await waitForAnnouncement(page, /Confidence vote/);
    assert.equal(await inertCount(page), 0);
    assert.notEqual(await activeId(page), 'BODY', 'focus is not lost after the vote closes');
  });

  await withAccessibleGame(async page => {
    await page.evaluate(() => { Object.assign(MoC.S, { trustP: 60, trustC: 60, trustD: 60 }); MoC.onQuarter(5); });
    const yearEnd = page.locator('#moc-yearend');
    await yearEnd.waitFor();
    assert.match(await page.locator('#moc-yearend .moc-box').evaluate(el => document.getElementById(el.getAttribute('aria-labelledby')).textContent), /Year \d+ Results/);
    await assertBackgroundInert(page, '#moc-yearend');
    await assertFocusTrapped(page, '#moc-yearend');
    await page.keyboard.press('Escape');
    assert.equal(await yearEnd.count(), 1, 'Escape cannot skip year-end results');
    await page.locator('#moc-yearend-btn').focus();
    await page.keyboard.press('Enter');
    assert.equal(await yearEnd.count(), 0);
    assert.equal(await activeId(page), 'moc-council-ready', 'focus moves on to the next required action');
    assert.equal(await inertCount(page), 0);
  });
});

test('Issue 12: end of term is a mandatory modal with an assertive announcement', { timeout: 60000 }, async () => {
  await withAccessibleGame(async page => {
    await page.evaluate(() => _mocDebug.endTerm('served'));
    const end = page.locator('#moc-endscreen');
    await end.waitFor();
    assert.equal(await page.locator('#moc-endscreen .moc-box').getAttribute('aria-modal'), 'true');
    assert.equal(await focusInside(page, '#moc-endscreen .moc-box'), true);
    await waitForAnnouncement(page, /End of term\. Final score/, 'moc-a11y-alert');
    await assertBackgroundInert(page, '#moc-endscreen');
    await assertFocusTrapped(page, '#moc-endscreen');
    await page.keyboard.press('Escape');
    assert.equal(await end.count(), 1, 'Escape must not leave the ended term');
    assert.equal(await page.locator('#moc-again').isEnabled(), true);
  }, '?debug=1');
});

test('Issue 12: Stats and Methodology are dismissible dialogs that return focus', { timeout: 60000 }, async () => {
  await withAccessibleGame(async page => {
    const clock = await page.evaluate(() => ({ version: MoC.MODEL_VERSION, seed: MoC.seed }));
    for (const spec of [
      { button: '#btn-stats', open: null, overlay: '.stats-overlay', name: /SIMULATION SUMMARY/, closeLabel: 'Close statistics', announce: /SIMULATION SUMMARY.*closed/ },
      { button: '#btn-stats', open: () => showMethodology(), overlay: '.methodology-overlay', name: /Methodology/, closeLabel: 'Close methodology', announce: /Methodology.*closed/ },
    ]) {
      await page.locator(spec.button).focus();
      // The Sources button is hidden in the Minister shell, so Methodology is opened through its real entry point.
      if (spec.open) await page.evaluate(spec.open); else await page.keyboard.press('Enter');
      const overlay = page.locator(spec.overlay);
      await overlay.waitFor();
      const dialog = overlay.locator('.stats-panel');
      assert.equal(await dialog.getAttribute('role'), 'dialog');
      assert.equal(await dialog.getAttribute('aria-modal'), 'true');
      assert.match(await dialog.evaluate(el => document.getElementById(el.getAttribute('aria-labelledby')).textContent), spec.name);
      assert.match(await overlay.locator('button[aria-label]').first().getAttribute('aria-label'), new RegExp(spec.closeLabel));
      assert.equal(await dialog.evaluate(el => document.activeElement === el), true, 'opening focus is in the dialog');
      await assertBackgroundInert(page, spec.overlay);
      await assertFocusTrapped(page, `${spec.overlay} .stats-panel`);
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => { const style = getComputedStyle(document.activeElement); return style.outlineWidth + ' ' + style.outlineStyle; });
      assert.match(ring, /^3px (solid|auto)$/, 'dialog controls show a visible keyboard focus ring');
      await page.keyboard.press('Escape');
      assert.equal(await overlay.count(), 0, 'Escape dismisses a dismissible panel');
      assert.equal(await activeId(page), spec.button.slice(1), 'focus returns to the opener');
      assert.equal(await inertCount(page), 0);
      await waitForAnnouncement(page, spec.announce);
    }
    // The visible close button and a second open/close cycle still work after Escape.
    await page.locator('#btn-stats').focus();
    await page.keyboard.press('Enter');
    await page.locator('#stats-close-btn').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.stats-overlay').count(), 0);
    assert.equal(await activeId(page), 'btn-stats');
    assert.deepEqual(await page.evaluate(() => ({ version: MoC.MODEL_VERSION, seed: MoC.seed })), clock, 'overlays do not alter model identity');
  });
});
