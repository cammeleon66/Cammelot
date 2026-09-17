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
  for (let step = 0; step < 3 && !(await page.locator('#moc-shop').count()); step++) {
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
  await page.addInitScript(() => localStorage.setItem('moc_muted','true'));
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
        MoC.audio.setMuted(true);
        MoC.onQuarter = null; // same no-discretionary-policy path in both runs
        MoC.paused = false;
        for (let step = 0; step < 80; step++) {
          tick();
          for (let f = 0; f < frames; f++) render();
        }
        return { cycle, agents:agents.map(a => ({id:a.id,x:a.x,y:a.y,hp:a.hp,behavior:a.behaviorState,
          wait:a.waitWeeks,conditions:a.conditions,path:a.path,pathIdx:a.pathIdx,inside:a.insideBuilding})),
          graves:GRAVE_MARKERS, queues:QUEUES,
          events:EVENT_LOG.map(({timestamp,...event}) => event) };
      }, frames);
      await context.close();
      return state;
    }
    const foreground = await replay(0, false, 390);
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

test('Shared conditions and no-action reference agree at the same dates', { timeout: 300000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  try {
    async function run(baseline, seed=2468, scenario='cabinetcrisis') {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.addInitScript(() => { window.requestAnimationFrame=()=>0; localStorage.setItem('moc_muted','true'); });
      await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=${scenario}&seed=${seed}${baseline?'&baseline=1':''}`,{waitUntil:'domcontentloaded'});
      const result = await page.evaluate(() => {
        MoC.referencePolicy = true;
        MoC.paused=false;
        const target=MoC.TOTAL_QUARTERS*MoC.QUARTER_TICKS;
        let traceHash=0, tick75;
        for(let step=0;step<target && cycle<target && !MoC.S.over;step++) {
          tick();
          const stateHash=hashCode(JSON.stringify({params:M.IST,agents:agents.map(a=>({id:a.id,hp:a.hp,x:a.x,y:a.y,behavior:a.behaviorState,chat:a.chatTimer,grief:a.grievingTimer,anxiety:a.systemAnxiety}))}));
          traceHash=hashCode(traceHash+':'+cycle+':'+stateHash);
          if(cycle===75)tick75=stateHash;
        }
        const checkpoints=Object.fromEntries(Object.entries(MoC.runSnapshots).filter(([tick])=>Number(tick)%52===0||Number(tick)===75||Number(tick)===target));
        return {schedule:MoC.environment?.schedule, log:MoC.environment?.log, snapshots:checkpoints,
          traceHash,tick75,policies:MoC.S.interventions, cycle, error:document.querySelector('#moc-council')?.innerText};
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
    assert.match(await card.evaluate(el=>el.closest('.moc-item').innerText), /30% → 17%/);
    await card.click();
    assert.equal(await page.evaluate(()=>M.IST.admin),0.17);
    assert.match(await page.locator('#moc-policy-receipt').innerText(),/30% → 17%/);
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});

test('Early results match the reference date and replay preserves the prior attempt', { timeout: 45000 }, async () => {
  const server=await startSiteServer(), browser=await launchBrowser();
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('moc_muted','true'));
  try {
    const url=`http://127.0.0.1:${server.address().port}/minister.html?debug=1#scn=cabinetcrisis&seed=2468`;
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      document.getElementById('play-overlay')?.remove();
      MoC.referencePolicy=true;MoC.paused=false;
      while(cycle<75)tick();
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
    assert.match(endCopy,/At tick 75:/);
    const forged=await page.evaluate(()=>{
      const before=MoC.baseline;
      window.dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{...MoC.baseline,systemDeaths:999}}));
      return before===MoC.baseline;
    });
    assert.equal(forged,true);
    await page.locator('#moc-again').click();
    await page.waitForURL(/&v=minister-care-3-paired/);
    await page.locator('#moc-takeoffice').waitFor();
    assert.match(await page.locator('#moc-previous-attempt').innerText(),/tick 75/);
    assert.equal(await page.evaluate(()=>MoC.previousRun.final.tick),75);
    assert.equal(await page.evaluate(()=>MoC.previousRun.modelVersion), 'minister-care-3-paired');
    assert.deepEqual(await page.evaluate(()=>MoC.previousRun.externalSchedule),await page.evaluate(()=>MoC.environment.schedule));
    assert.equal(await page.evaluate(()=>MoC.audio.isMuted()),true);
    // Controlled outcome fixture: political survival must not conceal worse care.
    await page.evaluate(()=>{
      document.getElementById('play-overlay')?.remove();
      MoC.referencePolicy=true;MoC.paused=false;while(cycle<75)tick();MoC.referencePolicy=false;
      const reference=MoC.care.snapshot();
      GRAVE_MARKERS.push({name:'Fixture',age:70,cause:'system_failure',cycle:75,waitWeeks:14});
      MoC.baseline={protocol:MoC.REFERENCE_PROTOCOL,scheduleId:MoC.environment.scheduleId,modelVersion:MoC.MODEL_VERSION,
        seed:MoC.seed,scenario:MoC.S.scenario,snapshots:{75:reference}};
      MoC.S._cabinetResult='narrow';
      window._mocDebug.endTerm('served');
    });
    assert.match(await page.locator('#moc-care-verdict').innerText(),/more model-classified system deaths/);
    assert.equal(await page.locator('#moc-livesval').innerText(),'-1');
    assert.match(await page.locator('#moc-care-comparison').innerText(),/Previous attempt/);
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Player can publish a score with a public or generated name', { timeout: 60000 }, async () => {
  const server=await startSiteServer(),browser=await launchBrowser(),page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(()=>localStorage.setItem('moc_muted','true'));
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
    await page.evaluate(()=>{document.getElementById('play-overlay')?.remove();MoC.referencePolicy=true;MoC.paused=false;while(cycle<75)tick();MoC.referencePolicy=false;window._mocDebug.endTerm('served');});
    await page.locator('#moc-community').waitFor();
    assert.equal(await page.locator('#moc-card').count(),0,'PNG score sharing is replaced by the leaderboard');
    assert.deepEqual(await page.locator('.moc-community-entry strong').allTextContents(),['Vera van den Broek','<img src=x onerror=alert(1)>']);
    assert.equal(requestedSeed,'2468');
    assert.equal(await page.locator('.moc-community-entry img').count(),0,'leaderboard names render as text');
    await page.locator('#moc-community-name').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'moc-submit-score');
    await page.locator('#moc-submit-score').click();
    await page.waitForFunction(()=>document.querySelector('#moc-community-status').textContent.includes('rank 2'));
    assert.equal(submitted.username,'');
    assert.equal(submitted.seed,2468);
    assert.equal(submitted.modelVersion,'minister-care-3-paired');
    assert.equal(submitted.endTick,75);
    assert.equal(typeof submitted.summary.meanWait,'number');
    assert.equal(await page.locator('#moc-community-name').inputValue(),'Minister Silver Heron 468');
    const inputBox=await page.locator('#moc-community-name').boundingBox();
    const buttonBox=await page.locator('#moc-submit-score').boundingBox();
    assert.ok(inputBox&&buttonBox&&inputBox.height>=44&&buttonBox.height>=44&&await page.evaluate(()=>document.body.scrollWidth<=390));
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
  await page.addInitScript(()=>localStorage.setItem('moc_muted','true'));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      document.getElementById('play-overlay')?.remove();window._mocGameStarted=true;
      cycle=182;MoC.S.quarter=4;MoC.paused=false;MoC.onTick(cycle);
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
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Minister full term respects council and year-end pauses', { timeout: 60000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => localStorage.setItem('moc_muted','true'));
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
      waiting.forEach(a=>a.waitWeeks=8); episodes.forEach(e=>e.startTick=cycle-32); M.IST.admin = 0.15;
      MoC.refreshMinistry();
      const atBoundary = [...document.querySelectorAll('.moc-kpi[data-promise]')].map(card => ({ id: card.dataset.promise, met: card.dataset.met }));
      waiting.forEach(a=>a.waitWeeks=8.01); episodes.forEach(e=>e.startTick=cycle-32.04); M.IST.admin = 0.149;
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
          for (let ticks = 0; cycle < targetTick && !MoC.paused && ticks < 52; ticks++) tick();
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
      localStorage.setItem('moc_muted','true');
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
    assert.match(await page.locator('.moc-kpi[data-kpi="trustC"]').innerText(), /40/);
    assert.match(await page.locator('[data-town-person]').first().evaluate(el => getComputedStyle(el).fontFamily), /VT323/, 'citizen names should use the game font');
    const boundary = await page.evaluate(() => {
      clearInterval(autoTimer); autoTimer = null;
      while (cycle < 51) tick();
      const person = agents.find(a => a.type === 'patient' && a.state !== 'dead');
      person.hp = 0;
      const original = MoC.onQuarter;
      let stateAtCouncil;
      MoC.onQuarter = function(q) {
        original(q);
        stateAtCouncil = { dead: person.state === 'dead', graves: GRAVE_MARKERS.length };
      };
      tick();
      MoC.onQuarter = original;
      const after = GRAVE_MARKERS.length;
      return { stateAtCouncil, after, processed: person.hpHistory.length };
    });
    assert.equal(boundary.stateAtCouncil.dead, true, 'clinical tick must finish before council boundary');
    assert.equal(boundary.stateAtCouncil.graves, boundary.after, 'no deaths may occur after council pause');
    await page.locator('#moc-town-council').waitFor();
    assert.equal(await page.locator('#moc-council').count(), 0, 'council must wait for the player');
    assert.equal(await page.locator('#moc-town-toggle').isVisible(), false, 'resume control must be hidden while council is due');
    const readyBox = await page.locator('#moc-town-council').boundingBox();
    assert.ok(readyBox && readyBox.height >= 44 && readyBox.x >= 0 && readyBox.x + readyBox.width <= 405, 'council-ready control must fit the phone');
    await page.locator('#moc-town-council').click();
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
      cycle,
      paused: MoC.paused,
      timerRunning: Boolean(autoTimer),
    }));
    assert.ok(state.cycle >= 52, 'simulation should advance to the first quarterly council');
    assert.equal(state.paused, true, 'the council should pause the simulation');
    assert.equal(state.timerRunning, false, 'the council should stop the tick timer');

    assert.match(await page.locator('#moc-wiz-tabs').innerText(), /1\. Briefing\n(?:2\. Decision\n3\. Action|2\. Action)/);
    await page.locator('#moc-inspect-town').click();
    assert.equal(await page.locator('#moc-council').isVisible(), false);
    assert.equal(await page.locator('[data-town-person]').count(), 3);
    await page.locator('[data-town-person]').first().click();
    assert.ok(await page.locator('#moc-town-person').innerText());
    assert.equal(await page.locator('.moc-follow-thought').isVisible(), true, 'followed resident should show a thought prominently');
    assert.ok(await page.locator('.moc-follow-tag').count(), 'followed resident should show health context');
    await page.locator('#moc-town-council').click();
    await openCouncilActions(page);
    assert.ok(await page.locator('#moc-laws [data-law]').count(), 'action stage should offer legislation');
    assert.ok(await page.locator('#moc-shop [data-buy]').count(), 'action stage should offer interventions');
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
  await page.addInitScript(() => localStorage.setItem('moc_muted','true'));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html?desktop-regression=1#scn=cabinetcrisis&seed=2468`, { waitUntil:'domcontentloaded' });
    const name = page.locator('#moc-player-name');
    assert.equal(await name.count(), 1, 'the first game screen should ask for a public player name');
    assert.match(await name.inputValue(), /^Minister /);
    const initialName = await name.inputValue();
    await page.locator('#moc-generate-name').click();
    assert.match(await name.inputValue(), /^Minister /);
    assert.notEqual(await name.inputValue(), initialName);
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
    await page.locator('[data-town-person]').first().click();
    assert.equal(await page.locator('#panel').getAttribute('data-moc-detail'), 'false');
    assert.equal(await page.locator('#moc-ministry').isVisible(), true);
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
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});

test('Android unmute starts media inside the user gesture', { timeout: 30000 }, async () => {
  const server = await startSiteServer();
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport:{ width:412, height:915 }, isMobile:true, hasTouch:true });
  await page.addInitScript(() => {
    localStorage.setItem('moc_muted', 'true');
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