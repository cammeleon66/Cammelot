// B02 browser evidence: loopback reads only; no request can write to a leaderboard.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync, mkdirSync, existsSync } = require('node:fs');
const { createServer } = require('node:http');
const { resolve, extname, sep } = require('node:path');
const { chromium } = require('playwright-chromium');

const BASE = '729a2c815c410fec0164721216d438e0980ab307';
const scenarios = ['cabinetcrisis', 'campaign'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = resolve('site');
const original = execFileSync('git', ['show', `${BASE}:site/minister.html`], { encoding: 'utf8', maxBuffer: 2e6 });
const getCurrent = () => readFileSync(resolve(root, 'minister.html'), 'utf8');

// Expose private entry points only in the locally served test copy. No alternate
// applicator, effects, gates or event selection are substituted in the page.
function instrument(source) {
  return source.replace('  function pickEvent(q){', `  function pickEvent(q){
    if(window.__b02FixtureEvent !== undefined)return window.__b02FixtureEvent===null?null:EVENTS.find(e=>e.id===window.__b02FixtureEvent);`)
    .replace('    // G9c: Manifesto —', '    window.__b02Vote = confidenceVote;\n    // G9c: Manifesto —')
    .replace('  // F08: a local command record,', `  window.__b02 = {
    SHOP, LAW_TRACKS, DILEMMAS, EVENTS, FLASH_POOL, openCouncil, processQuarterEffects,
    resetDialogs:()=>{councilOpen=false;flashActive=false;},
    choicePlans, projectCarePlan, shopPlan, canBuy, optionAttrs,
    read:()=>({p:{...M.IST},budget:GS.budget,trustC:GS.trustC,trustD:GS.trustD,trustP:GS.trustP,
      dependence:GS.dependence,mantelzorg:GS.mantelzorg,fragmentation:GS.fragmentation,
      platformMaturity:GS.platformMaturity,adoptionRate:GS.adoptionRate,liveScore:GS.liveScore,
      burnout:agents.filter(a=>a.type==='gp').map(a=>a.burnoutLevel||0),
      hp:agents.filter(a=>a.type==='patient'||a.type==='citizen').map(a=>a.hp),
      timed:GS.timedFx,delayed:GS.delayed,logical:GS.logicalEffects,
      capacity:GS.specialistCapacity,access:MoC.care.accessEvents,holds:MoC.care.snapshot().accessDelayWeeks}),
    preview:(option,context)=>typeof previewOption==='function'?previewOption(option,context):null
  };
  // F08: a local command record,`);
}

async function fixture() {
  const guard = { blockedWrites: 0, externalReads: 0, serverWrites: 0 };
  const server = createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { guard.serverWrites++; res.writeHead(405).end(); return; }
    const url = new URL(req.url, 'http://localhost');
    let path;
    try { path = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
    const baseline = path.startsWith('/baseline/');
    const relative = path.replace(/^\/(?:baseline\/)?/, '');
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep) || !existsSync(file)) { res.writeHead(404).end(); return; }
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    if (req.method === 'HEAD') res.end();
    else if (relative === 'minister.html') res.end(instrument(baseline ? original : getCurrent()));
    else res.end(readFileSync(file));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  async function page(scenario, baseline = false, reference = false, width = 1024) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route('**/*', route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) { guard.blockedWrites++; return route.abort(); }
      if (!request.url().startsWith(base + '/')) {
        guard.externalReads++;
        return route.fulfill({ status: 200, body: '' });
      }
      return route.continue();
    });
    await context.addInitScript(() => {
      localStorage.setItem('moc_muted_v2', 'true');
      window.requestAnimationFrame = () => 0;
      window.setInterval = () => 0; // tests advance logical time explicitly
    });
    const p = await context.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(`${base}/${baseline ? 'baseline/' : ''}minister.html?debug=1#scn=${scenario}&seed=2468${reference ? '&baseline=1' : ''}`,
      { waitUntil: 'load' });
    await p.evaluate(isReference => {
      document.getElementById('play-overlay')?.remove();
      document.getElementById('welcome-card')?.remove();
      MoC.paused = !isReference;
    }, reference);
    p.b02Errors = errors;
    return p;
  }
  return { page, guard, close: async () => { await browser.close(); await new Promise(done => server.close(done)); } };
}

async function reference(f, scenario, baseline) {
  const p = await f.page(scenario, baseline, true);
  try {
    await p.waitForFunction(() => modelTick === MoC.TOTAL_QUARTERS * MoC.QUARTER_TICKS && MoC.paused,
      null, { timeout: 120000, polling: 50 });
    const bytes = await p.evaluate(() => JSON.stringify({
      model:MoC.MODEL_VERSION,protocol:MoC.REFERENCE_PROTOCOL,scenario:MoC.S.scenario,seed:MoC.seed,
      tick:modelTick,schedule:MoC.environment.schedule,log:MoC.environment.log,snapshots:MoC.runSnapshots,
      care:MoC.care.snapshot(),clinical:agents.map(a=>({id:a.id,name:a.name,age:a.age,hp:a.hp,
        state:a.state,behavior:a.behaviorState,conditions:a.conditions,x:a.x,y:a.y,
        burnout:a.burnoutLevel,wait:a.waitWeeks}))
    }));
    assert.deepEqual(p.b02Errors, []);
    return bytes;
  } finally { await p.context().close(); }
}

async function inventory(p) {
  return p.evaluate(() => {
    const b = __b02, rows = [];
    const add = (id, kind, option, parent) => rows.push({ id, kind,
      label:option.label || option.l || option.name || option.text,
      oldText:option.note || option.desc || '', path:parent,
      effects:option.fx || null, stochastic:!!option.fxChoices,
      planned:!!option.plan, conditional:!!option.fxFn, callback:!!option.after || !!option.run });
    b.SHOP.forEach(o => add('purchase:'+o.id,'purchase',o,'shopPlan → buy'));
    Object.values(b.LAW_TRACKS).flatMap(t=>t.laws).forEach(o=>add('law:'+o.id,'law',o,'projectCarePlan → law click'));
    b.DILEMMAS.forEach(d=>['a','b','c'].filter(k=>d[k]).forEach(k=>add('dilemma:'+d.id+':'+k,'dilemma',d[k],'choicePlan → applyChoice')));
    b.EVENTS.forEach(e=>(e.choices||[]).forEach((o,i)=>add('event:'+e.id+':'+i,'event',o,'choicePlan → applyChoice')));
    b.FLASH_POOL.forEach((f,i)=>['a','b'].forEach(k=>add('request:'+i+':'+k,'request',f[k],'maybeFlash → request click')));
    ['digigate','archipchallenge'].forEach(id=>['a','b'].forEach(k=>add('beat:'+id+':'+k,'beat',{label:id+' '+k},'openCouncil → applyChoice → after')));
    ['promise','sacrifice','defy'].forEach(id=>add('vote:'+id,'vote',{label:id},'confidenceVote → vote click'));
    (MoC.S.PROMISES||[]).forEach(o=>add('promise:'+o.id,'promise',o,'showManifesto → selection → evaluateElection'));
    return rows;
  });
}

// Exact coverage is deliberately independent of the UI formatter and is pinned:
// adding/removing any action requires an explicit inventory/coverage update.
const EXPECTED = {
  purchase: ['scribes1','scribes2','hire','a2a','twin','mtvp','audit','prevention','resilience','security',
    'campaign','gpfund','pilotgrant','platform','platformai','changeprog','inclofficer','carersupport'],
  law: ['dig1','dig2','dig3','work1','work2','work3','inno1','inno2','inno3'],
  dilemma: ['insurer','assistant','press','flu','locum','overtime','subsidy','bus','merger','cyberins',
    'shortage','seh','algo','grid','verpleeghuis','poach','digibeten','interop','sugarlobby','sabbatical',
    'mivd','longcovid','refugees','nzatariff','gpstrike','mantelzorg','buildorbuy','phddata','aistartup'],
  third: ['longcovid','refugees','nzatariff','gpstrike','mantelzorg','buildorbuy','phddata','aistartup'],
  event: { lockstep:2,codeblack:2,meds:3,gemeenteraad:2,algodubbelop:2,researchgrant:3,fasttrack:2 },
  promise: ['waits','nodeaths','admin','digital','doctors'],
};
function expectedIds() {
  return [
    ...EXPECTED.purchase.map(id=>'purchase:'+id), ...EXPECTED.law.map(id=>'law:'+id),
    ...EXPECTED.dilemma.flatMap(id=>['a','b',...(EXPECTED.third.includes(id)?['c']:[])].map(k=>'dilemma:'+id+':'+k)),
    ...Object.entries(EXPECTED.event).flatMap(([id,n])=>Array.from({length:n},(_,i)=>'event:'+id+':'+i)),
    ...Array.from({length:8},(_,i)=>['a','b'].map(k=>'request:'+i+':'+k)).flat(),
    ...['digigate','archipchallenge'].flatMap(id=>['a','b'].map(k=>'beat:'+id+':'+k)),
    ...['promise','sacrifice','defy'].map(id=>'vote:'+id),
    ...EXPECTED.promise.map(id=>'promise:'+id),
  ].sort();
}

async function prepare(p, id, edge = {}) {
  return p.evaluate(({id,edge}) => {
    const b=__b02,s=MoC.S;
    b.resetDialogs();
    document.querySelectorAll('.moc-overlay,.moc-flash,#moc-council-ready-banner').forEach(e=>e.remove());
    // Fixture state only. The option definitions and real click applicators are
    // never replaced. Set valid room for both adverse and beneficial care plans.
    Object.assign(s,{budget:1000000,trust:70,trustC:70,trustD:70,trustP:70,dependence:6,
      specialistCapacity:5,mantelzorg:70,fragmentation:2,platformMaturity:1,adoptionRate:0.7,
      liveScore:20,quarter:2,over:false,endReason:null,buysThisCouncil:0,
      owned:{scribes1:1,scribes2:1},laws:{dig1:1,dig2:1},interventions:[],decisionLog:[],
      timedFx:[],delayed:[],logicalEffects:[],activeStates:{},pendingBanners:[],pendingBeat:null,
      eventsFired:[],flashSeen:[],lastEventQ:{},_sinceQuiet:0,_sdLastQ:0,_lowTrustCQ:0,_strikeUnresolvedQ:0,
      _digigateRecurs:false,_digigateLastQ:0,_bruisedMandate:0,_lawsThisAct:0,
      _voteHeld:false,_fasttrackTaken:false,_fasttrackDeclined:false,techFreezeUntil:0,
      _pilotGrantWarnFired:false,_pilotGrant2WarnFired:false,_pilotGrant3Fired:false,_promiseDebt:false});
    Object.assign(M.IST,{admin:0.5,sick:0.2,ai:1.2,drain:1.2,tree:12});
    agents.filter(a=>a.type==='gp').forEach(a=>{a.burnoutLevel=20;});
    agents.filter(a=>a.type==='patient'||a.type==='citizen').forEach(a=>{a.hp=60;});
    Object.assign(s,edge.state || {});
    Object.assign(M.IST,edge.parameters || {});
    if(edge.burnout!==undefined)agents.filter(a=>a.type==='gp').forEach(a=>{a.burnoutLevel=edge.burnout;});
    if(edge.hp!==undefined)agents.filter(a=>a.type==='patient'||a.type==='citizen').forEach(a=>{a.hp=edge.hp;});
    MoC.paused=true;window.__b02FixtureEvent=null;
    const [kind,key,slot]=id.split(':');
    let option,selector,context={},parent;
    if(kind==='vote'){
      s.trustP=20;__b02Vote();
      selector='[data-vote="'+key+'"]';option=MoC.voteOptions?.[key];context={vote:true};
    }else if(kind==='request'){
      option=b.FLASH_POOL[+key][slot];_mocForceFlash(+key);
      selector='#moc-f'+slot;
      context={face:agents.find(a=>(a.type==='patient'||a.type==='citizen')&&a.state!=='dead'&&!a.moved)};
    }else if(kind==='promise'){
      s._manifestoShown=false;_mocShowManifesto();
      const index=s.PROMISES.findIndex(o=>o.id===key);
      selector='[data-promise="'+index+'"]';option=s.PROMISES[index];
    }else{
      if(kind==='dilemma'){
        s.dilemmasSeen=b.DILEMMAS.filter(d=>d.id!==key).map(d=>d.id);
        s._dilemmaOrder=[key];option=b.DILEMMAS.find(d=>d.id===key)[slot];
      }else if(kind==='event'){
        window.__b02FixtureEvent=key;option=b.EVENTS.find(e=>e.id===key).choices[+slot];
      }else if(kind==='beat'){
        s.pendingBeat=key;
        if(key==='digigate')delete s.owned.inclofficer;
      }else if(kind==='law'){
        const track=Object.values(b.LAW_TRACKS).find(t=>t.laws.some(l=>l.id===key));
        s.laws=Object.fromEntries(track.laws.slice(0,track.laws.findIndex(l=>l.id===key)).map(l=>[l.id,1]));
        option=track.laws.find(l=>l.id===key);context={law:true};
      }else if(kind==='purchase'){
        delete s.owned[key];
        if(edge.owned!==undefined)s.owned[key]=edge.owned;
        option=b.SHOP.find(o=>o.id===key);context={purchase:true};
      }
      _mocForceCouncil(2);
      // Navigate real wizard controls, stopping at the desired action stage.
      document.getElementById('moc-wiz-next').click();
      if(['law','purchase'].includes(kind)){
        const decision=document.querySelector('#moc-council .moc-opt:not(:disabled)');
        if(decision)decision.click();
        if(document.querySelector('#moc-council .moc-opt'))document.getElementById('moc-wiz-next').click();
        if(kind==='purchase')document.getElementById('moc-wiz-next').click();
      }
      if(kind==='purchase'){
        if(document.getElementById('moc-shop-more'))document.getElementById('moc-shop-more').click();
        selector='[data-buy="'+key+'"]';
      }else if(kind==='law')selector='[data-law="'+key+'"]';
      else if(kind==='event')selector='[data-evtopt="'+slot+'"]';
      else selector='#moc-opt-'+slot;
    }
    const button=document.querySelector(selector);
    if(kind==='promise'&&s.scenario==='cabinetcrisis')return {absent:true};
    if(!button)throw new Error('Missing real control: '+id+'; '+document.body.innerText.slice(-900));
    if(!['promise','request','vote'].includes(kind))parent=button.closest('.moc-item') || button;
    else parent=button;
    const preview=option && kind!=='promise' ? b.preview(option,context) : null;
    const fields=[...parent.querySelectorAll('[data-preview-field]')].map(e=>({
      key:e.dataset.previewField,delta:Number(e.dataset.previewDelta),branch:Number(e.dataset.previewBranch || 0),text:e.textContent
    }));
    return {selector,preview,fields,disabled:button.disabled,text:parent.innerText,before:b.read()};
  }, {id,edge});
}

// B01's independent write-interception ledger, kept outside the production page.
// Includes real intermediate writes (not just the proposed plan's final state).
async function ledger(p) {
  await p.evaluate(() => {
    const s=MoC.S;window.__b02Ledger=[];
    for(const key of ['trustC','trustD','trustP','budget']){
      const descriptor=Object.getOwnPropertyDescriptor(s,key);
      if(descriptor?.get)continue;
      let value=s[key];
      Object.defineProperty(s,key,{configurable:true,enumerable:true,get:()=>value,set:next=>{
        const before=value;value=next;
        if(Number.isFinite(before)&&Number.isFinite(next)&&next!==before)
          __b02Ledger.push({key,before,after:next,amount:next-before,tick:modelTick});
      }});
    }
  });
}

async function action(p, id, branch = 0, edge = {}) {
  const setup=await prepare(p,id,edge);
  if(setup.absent)return setup;
  assert.equal(setup.disabled,false,`${id} should be feasible: ${setup.text}`);
  await ledger(p);
  await p.evaluate(({selector,branch}) => {
    const button=document.querySelector(selector);
    button.addEventListener('click',()=>{Math.random=()=>branch===0?0:0.999999;},{capture:true,once:true});
  },{selector:setup.selector,branch});
  await p.locator(setup.selector).click();
  const after=await p.evaluate(()=>({state:__b02.read(),ledger:__b02Ledger,over:MoC.S.over,promises:MoC.S.promises}));
  assert.deepEqual(p.b02Errors,[],id);
  return {...setup,...after};
}

function assertClose(actual,expected,message) {
  assert.ok(Number.isFinite(actual)&&Number.isFinite(expected)&&Math.abs(actual-expected)<1e-8,
    `${message}: ${actual} != ${expected}`);
}
function assertPreview(result,id,branch) {
  const preview=result.preview;
  if(!preview)return; // manifesto has no numerical application
  assert.equal(preview.unavailable,null,id);
  const projected=preview.branches[branch] || preview.branches[0],state=result.state;
  const after={...state,...state.p,score:state.liveScore,health:state.hp[0]};
  for(const [key,value] of Object.entries(projected.after)){
    if(key==='burnout'){
      value.forEach((v,i)=>assertClose(state.burnout[i],v,id+' GP burnout '+i));continue;
    }
    if(value===undefined)continue;
    assertClose(after[key],value,id+' '+key);
    const delta=value-projected.before[key];
    if(delta!==0){
      const chip=result.fields.find(f=>f.key===key&&f.branch===(preview.branches.length>1?branch:0));
      assert.ok(chip,id+' must render '+key);
      assertClose(chip.delta,delta,id+' rendered delta '+key);
    }
  }
  for(const key of ['trustC','trustD','trustP','budget']){
    const total=result.ledger.filter(e=>e.key===key).reduce((sum,e)=>sum+e.amount,0);
    assertClose(state[key]-result.before[key],total,id+' B01 ledger '+key);
  }
  assert.deepEqual(state.timed.slice(result.before.timed.length),projected.timed,id+' timed schedule');
  assert.deepEqual(state.delayed.slice(result.before.delayed.length),projected.delayed,id+' delayed schedule');
}

async function runExhaustive(f) {
  const evidence={cases:[],inventory:[],counts:{},coverage:{}};
  for(const scenario of scenarios){
    const p=await f.page(scenario),old=await f.page(scenario,true);
    try {
      const rows=await inventory(p),baselineRows=await inventory(old);
      assert.deepEqual(rows.map(r=>r.id).sort(),expectedIds(),scenario+' inventory coverage gate');
      assert.deepEqual(baselineRows.map(r=>r.id).sort(),expectedIds(),scenario+' baseline inventory gate');
      if(!evidence.inventory.length)evidence.inventory=baselineRows;
      const covered=new Set();
      for(const row of rows){
        const branches=row.stochastic||['request:1:b','request:4:b','vote:defy'].includes(row.id)?2:1;
        for(let branch=0;branch<branches;branch++){
          const result=await action(p,row.id,branch);
          const baseline=await action(old,row.id,branch);
          if(result.absent){
            assert.deepEqual(result,baseline);covered.add(row.id);
            evidence.cases.push({scenario,id:row.id,status:'not offered in this scenario; no immediate effect'});continue;
          }
          assertPreview(result,row.id,branch);
          assert.deepEqual(result.state,baseline.state,scenario+' unchanged real application '+row.id+'/'+branch);
          assert.deepEqual(result.ledger,baseline.ledger,scenario+' unchanged B01 writes '+row.id+'/'+branch);
          covered.add(row.id);
          evidence.cases.push({scenario,id:row.id,branch,preview:result.preview,
            before:result.before,after:result.state,ledger:result.ledger});
        }
      }
      assert.deepEqual([...covered].sort(),expectedIds(),scenario+' every option executed or explicitly absent');
      evidence.coverage[scenario]={ids:covered.size,expected:137,missing:[],extra:[]};
    } finally {await p.context().close();await old.context().close();}
  }
  evidence.counts=Object.fromEntries([...new Set(evidence.inventory.map(r=>r.kind))]
    .map(kind=>[kind,evidence.inventory.filter(r=>r.kind===kind).length]));
  return evidence;
}

async function capture() {
  const f = await fixture();
  try {
    const evidence = { base: BASE, htmlSha256: sha(original), references: {}, inventory: [] };
    for (const scenario of scenarios) {
      const bytes = await reference(f, scenario, true);
      writeFileSync(`/tmp/b02-baseline-${scenario}.json`, bytes);
      evidence.references[scenario] = { bytes: Buffer.byteLength(bytes), sha256: sha(bytes) };
    }
    const p = await f.page('campaign', true);
    evidence.inventory = await inventory(p);
    await p.context().close();
    evidence.counts = Object.fromEntries([...new Set(evidence.inventory.map(r=>r.kind))]
      .map(kind=>[kind,evidence.inventory.filter(r=>r.kind===kind).length]));
    writeFileSync('/tmp/b02-baseline-audit.json', JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify({ ...evidence, inventory: `${evidence.inventory.length} rows captured` }, null, 2));
  } finally { await f.close(); }
}

module.exports = { BASE, scenarios, sha, fixture, reference, inventory, runExhaustive, prepare, action, assertPreview };
if (require.main === module) {
  (process.argv.includes('--capture') ? capture() : (async()=>{
    const f=await fixture();try{
      const evidence=await runExhaustive(f);
      writeFileSync('/tmp/b02-exhaustive.json',JSON.stringify(evidence,null,2)+'\n');
      console.log(JSON.stringify({counts:evidence.counts,coverage:evidence.coverage,cases:evidence.cases.length}));
    }finally{await f.close();}
  })())
    .catch(e => { console.error(e); process.exitCode = 1; });
}
