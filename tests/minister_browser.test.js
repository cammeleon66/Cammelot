import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-chromium';

const SITE_ROOT = join(process.cwd(), 'site');
const launchBrowser = () => chromium.launch({ headless: true, args: ['--mute-audio'] });
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
      modelVersion:'minister-care-7-elapsed-time'});
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
          insideBuilding:oldWorkplace,atWork:true,workTimer:12,schoolPos:null,schoolTimer:0});
        tick();
        const senior={age:resident.age,lifeStage:resident.lifeStage,workplace:resident.workplace,
          workplacePos:resident.workplacePos,insideBuilding:resident.insideBuilding,atWork:resident.atWork,workTimer:resident.workTimer};
        resident.age=70+1/208;
        resident.causeOfDeath='natural';
        finalizeAgentDeath(resident);
        const naturalEvent=EVENT_LOG.filter(e=>e.type==='natural_death'&&e.agentId===resident.id).at(-1);
        const deathHistory=resident.actionHistory.filter(e=>e.type==='died').at(-1);
        const grave=GRAVE_MARKERS.at(-1);
        showMemorial(grave);
        return {bands,child,adult,senior,preciseAge:resident.age,eventDetail:naturalEvent.detail,
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
    const starts = await page.evaluate(() => {
      function simulate(capacity) {
        MoC.S.specialistCapacity = capacity; MoC.S.serviceCredit = 0;
        let waiting = 4, treated = 0;
        for (let t=0;t<8;t++) { const slots=MoC.care.availableStarts(waiting,0); waiting-=slots; treated+=slots; }
        return treated;
      }
      return [simulate(1), simulate(2)];
    });
    assert.deepEqual(starts, [2,4]);
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
      MoC.care.sync=function(){careSyncs++;return originalSync();};
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
          traceHash,tick75,policies:MoC.S.interventions, cycle:modelTick, error:document.querySelector('#moc-council')?.innerText};
      });
      await context.close(); return result;
    }
    const reference=await run(true), player=await run(false);
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
    assert.equal(await page.evaluate(()=>M.IST.admin),0.18);
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
    await page.waitForFunction(()=>!!MoC.referenceAt(75),null,{timeout:25000});
    const pair=await page.evaluate(()=>({tick:MoC.S._finalSnapshot.tick,reference:MoC.referenceAt(75).tick,
      signed:MoC.care.compare(MoC.S._finalSnapshot,MoC.referenceAt(75)).livesDifference}));
    assert.deepEqual(pair,{tick:75,reference:75,signed:0});
    assert.match(await page.locator('#moc-care-comparison').innerText(),/Same date: tick 75/);
    assert.match(await page.locator('#moc-care-verdict').innerText(),/same number/i);
    const endCopy=await page.locator('#moc-endscreen').innerText();
    assert.doesNotMatch(endCopy,/not heroic|played it safe|your successor inherits|the system won|hard route|rare trifecta/i);
    assert.match(endCopy,/FINAL SCORE/);
    assert.match(endCopy,/Parliament ended the term/);
    const forged=await page.evaluate(()=>{
      const before=MoC.baseline;
      window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{...MoC.baseline,systemDeaths:999}}));
      return before===MoC.baseline;
    });
    assert.equal(forged,true);
    await page.locator('#moc-again').click();
    await page.waitForURL(/&v=minister-care-7-elapsed-time/);
    await page.locator('#moc-takeoffice').waitFor();
    assert.match(await page.locator('#moc-previous-attempt').innerText(),/tick 75/);
    assert.equal(await page.evaluate(()=>MoC.previousRun.final.tick),75);
    assert.equal(await page.evaluate(()=>MoC.previousRun.modelVersion), 'minister-care-7-elapsed-time');
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
    assert.equal(submitted.modelVersion,'minister-care-7-elapsed-time');
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