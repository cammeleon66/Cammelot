const { createReadStream, existsSync, statSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, join, normalize } = require('node:path');
const { chromium } = require('playwright-chromium');

const root = join(process.cwd(), 'site');
const mime = {'.html':'text/html','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.mp3':'audio/mpeg'};
const strategies = {
  'no-action': [],
  staffing: ['hire','gpfund','mtvp','changeprog','carersupport','hire'],
  'digital-fast': ['scribes1','scribes2','a2a','twin','pilotgrant','security'],
  resilient: ['resilience','security','hire','mtvp','prevention','gpfund'],
  foundation: ['scribes1','changeprog','platform','platformai','resilience','security'],
};
const seeds = (process.argv[2] || '2468,1357,7777').split(',').map(Number).filter(Number.isInteger);

function staticServer() {
  return createServer((request,response)=>{
    const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const relative=pathname==='/'?'minister.html':pathname.replace(/^\/+/, '');
    const file=normalize(join(root,relative));
    if(!file.startsWith(root)||!existsSync(file)||!statSync(file).isFile()){response.writeHead(404).end();return;}
    response.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});createReadStream(file).pipe(response);
  });
}

async function reachActions(page) {
  for(let step=0;step<3 && !(await page.locator('#moc-shop').count());step++){
    if(await page.evaluate(()=>MoC.S.over)||!(await page.locator('#moc-council').count()))return false;
    const choices=page.locator('#moc-council .moc-opt:not(:disabled)');
    if(await choices.count()) await choices.first().click();
    const next=page.locator('#moc-wiz-next');if(!(await next.count()))return false;
    await next.click();
  }
  return !!(await page.locator('#moc-shop').count());
}

async function play(browser,base,seed,name,wishlist) {
  const context=await browser.newContext();
  const page=await context.newPage();
  page.setDefaultTimeout(3000);
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;localStorage.setItem('moc_muted','true');});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}/minister.html?debug=1#scn=cabinetcrisis&seed=${seed}`,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
    document.getElementById('play-overlay')?.remove();window._mocGameStarted=true;MoC.paused=false;
    if(autoTimer){clearInterval(autoTimer);autoTimer=null;}
  });
  let cursor=0,guard=0;
  while(!(await page.evaluate(()=>MoC.S.over)) && guard++<100){
    await page.evaluate(()=>{
      if(autoTimer){clearInterval(autoTimer);autoTimer=null;}
      if(MoC.paused&&!MoC.S._councilDue)return;
      MoC.paused=false;
      for(let i=0;i<1000&&!MoC.paused&&!MoC.S.over;i++)tick();
    });
    if(await page.evaluate(()=>MoC.S.over))break;
    const flash=page.locator('#moc-flash button:not(:disabled),.moc-flash button:not(:disabled)');
    if(await flash.count()){await flash.first().click();continue;}
    const vote=page.locator('#moc-vote button.moc-opt:not(:disabled)');
    if(await vote.count()){await vote.first().click();continue;}
    const yearEnd=page.locator('#moc-yearend-btn');if(await yearEnd.count())await yearEnd.click();
    const ready=page.locator('#moc-town-council');
    if(!(await ready.count())||!(await ready.isVisible())){
      await page.evaluate(()=>{if(!MoC.S.over&&!MoC.isBlocked()){MoC.paused=false;}});
      continue;
    }
    await ready.click();if(!(await reachActions(page)))continue;
    let bought=0;
    if(await page.locator('#moc-shop-more').count())await page.locator('#moc-shop-more').click();
    while(cursor<wishlist.length&&bought<2){
      const id=wishlist[cursor++],button=page.locator(`[data-buy="${id}"]`);
      if(await button.count()&&await button.isEnabled()){await button.click();bought++;}
    }
    const finish=page.locator('#moc-wiz-next');if(await finish.count())await finish.click();
    await page.evaluate(()=>{if(autoTimer){clearInterval(autoTimer);autoTimer=null;}});
  }
  const result=await page.evaluate(()=>{
    const key='moc_runs_'+MoC.MODEL_VERSION;
    const run=(JSON.parse(localStorage.getItem(key)||'[]')).find(r=>r.seed===MoC.seed&&r.scenario===MoC.S.scenario);
    return {modelVersion:MoC.MODEL_VERSION,seed:MoC.seed,score:run?.score,politicalOutcome:MoC.S.endReason,
      cabinetResult:MoC.S._cabinetResult,care:MoC.S._finalSnapshot||MoC.care.snapshot(),trust:{citizens:MoC.S.trustC,doctors:MoC.S.trustD,parliament:MoC.S.trustP},
      dependence:MoC.S.dependence,fragmentation:MoC.S.fragmentation,budget:MoC.S.budget,
      purchases:MoC.S.interventions.filter(i=>i.cost>0).map(i=>i.label),external:MoC.environment.schedule};
  });
  await context.close();
  if(errors.length)throw new Error(`${name}/${seed}: ${errors.join('; ')}`);
  if(!result.politicalOutcome)throw new Error(`${name}/${seed}: run stopped at tick ${result.care.tick} without an ending`);
  return {strategy:name,...result};
}

(async()=>{
  const server=staticServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,args:['--mute-audio']});
  try{
    const results=[];
    for(const seed of seeds)for(const [name,wishlist] of Object.entries(strategies))results.push(await play(browser,base,seed,name,wishlist));
    console.log(JSON.stringify({generatedAt:new Date().toISOString(),scenario:'cabinetcrisis',seeds,results},null,2));
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
