const { createReadStream, existsSync, renameSync, rmSync, statSync, writeFileSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, join, normalize, resolve } = require('node:path');
const { chromium } = require('playwright-chromium');

const root = join(process.cwd(), 'site');
const mime = {'.html':'text/html','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.mp3':'audio/mpeg'};
const purchasePolicies = {
  'no-action': [],
  staffing: ['hire','gpfund','mtvp','changeprog','carersupport','hire'],
  'digital-fast': ['scribes1','scribes2','a2a','twin','pilotgrant','security'],
  resilient: ['resilience','security','hire','mtvp','prevention','gpfund'],
  foundation: ['scribes1','changeprog','platform','platformai','resilience','security'],
};
const seeds = (process.argv[2] || '2468,1357,7777').split(',').map(Number).filter(Number.isInteger);
const responsePolicies = (process.argv[3] || 'first,trust,budget,care').split(',').map(value=>value.trim()).filter(value=>['first','trust','budget','care'].includes(value));
const concurrency = Math.max(1, Math.min(8, Number(process.argv[4]) || 4));
const outputPath = process.argv[5] ? resolve(process.argv[5]) : null;

async function mapConcurrent(items,limit,worker) {
  const results=new Array(items.length);
  let cursor=0,completed=0;
  async function next(){
    while(cursor<items.length){
      const index=cursor++;
      let lastError;
      for(let attempt=1;attempt<=2;attempt++){
        try{results[index]=await worker(items[index],index);lastError=null;break;}
        catch(error){lastError=error;if(attempt<2)console.error(`Retry ${index+1}/${items.length}: ${error.message}`);}
      }
      if(lastError)throw lastError;
      completed++;
      if(completed===items.length||completed%20===0)console.error(`Progress ${completed}/${items.length}`);
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},next));
  return results;
}

function staticServer() {
  return createServer((request,response)=>{
    const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const relative=pathname==='/'?'minister.html':pathname.replace(/^\/+/, '');
    const file=normalize(join(root,relative));
    if(!file.startsWith(root)||!existsSync(file)||!statSync(file).isFile()){response.writeHead(404).end();return;}
    response.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream'});createReadStream(file).pipe(response);
  });
}

function responseScore(text,policy) {
  if(policy==='first')return 0;
  const value=text.replace(/[−–]/g,'-').replace(/€/g,'').toLowerCase();
  const signed=(pattern)=>[...value.matchAll(pattern)].reduce((sum,match)=>sum+Number(match[1]||0),0);
  const trust=signed(/(?:trust|citizens?|doctors?|parliament)\s*([+-]\d+(?:\.\d+)?)/g);
  const money=signed(/([+-]\d+(?:\.\d+)?)k/g);
  const capacity=signed(/(?:capacity|starts\/week)\s*([+-]\d+(?:\.\d+)?)/g);
  const admin=signed(/admin(?: burden)?\s*([+-]\d+(?:\.\d+)?)/g);
  const sick=signed(/(?:sick|absence)\s*([+-]\d+(?:\.\d+)?)/g);
  if(policy==='trust')return trust*10+money*0.01+(value.includes('transparen')?4:0);
  if(policy==='budget')return money*10+trust*0.2+(value.includes('no change')||value.includes('decline')?3:0);
  return capacity*20-admin*4-sick*5+trust*0.5
    +(value.includes('health')?8:0)+(value.includes('prevention')?6:0)+(value.includes('resilience')?4:0)
    -(value.includes('wait')&&value.includes('extra')?10:0);
}

async function chooseResponse(buttons,policy) {
  const count=await buttons.count();
  if(!count)return false;
  if(policy==='first'){await buttons.first().click();return true;}
  const texts=await buttons.allInnerTexts();
  let best=0,bestScore=-Infinity;
  texts.forEach((text,index)=>{const score=responseScore(text,policy);if(score>bestScore){bestScore=score;best=index;}});
  await buttons.nth(best).click();
  return true;
}

async function reachActions(page,responsePolicy) {
  for(let step=0;step<4 && !(await page.locator('#moc-shop').count());step++){
    if(await page.evaluate(()=>MoC.S.over)||!(await page.locator('#moc-council').count()))return false;
    const choices=page.locator('#moc-council .moc-opt:not(:disabled)');
    if(await choices.count()) await chooseResponse(choices,responsePolicy);
    const next=page.locator('#moc-wiz-next');if(!(await next.count()))return false;
    await next.click();
  }
  return !!(await page.locator('#moc-shop').count());
}

async function play(browser,base,seed,purchasePolicy,wishlist,responsePolicy) {
  const context=await browser.newContext();
  try {
    const page=await context.newPage();
    page.setDefaultTimeout(5000);
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;localStorage.setItem('moc_muted_v2','true');});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${base}/minister.html?debug=1#scn=cabinetcrisis&seed=${seed}`,{waitUntil:'domcontentloaded',timeout:15000});
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
    const yearEnd=page.locator('#moc-yearend-btn');
    if(await yearEnd.count()){await yearEnd.click();continue;}
    const vote=page.locator('#moc-vote button.moc-opt:not(:disabled)');
    if(await vote.count()){await chooseResponse(vote,responsePolicy);continue;}
    const flashChoices=page.locator('.moc-flash #moc-fa:not(:disabled),.moc-flash #moc-fb:not(:disabled)');
    if(await flashChoices.count()){await chooseResponse(flashChoices,responsePolicy);continue;}
    const flashContinue=page.locator('#moc-flash-continue');
    if(await flashContinue.count()){await flashContinue.click();continue;}
    const bannerReady=page.locator('#moc-council-ready-banner button');
    const fallbackReady=page.locator('#moc-town-council');
    const ready=await bannerReady.count()&&await bannerReady.isVisible()?bannerReady:fallbackReady;
    if(!(await ready.count())||!(await ready.isVisible())){
      await page.evaluate(()=>{if(!MoC.S.over&&!MoC.isBlocked()){MoC.paused=false;}});
      continue;
    }
    await ready.click();if(!(await reachActions(page,responsePolicy)))continue;
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
      cabinetReasons:MoC.S._cabinetReasons||[],cascades:Object.fromEntries(Object.entries(MoC.S.cascades||{}).map(([id,state])=>[id,state.stage||0])),
      decisions:(MoC.S.decisionLog||[]).map(d=>({quarter:d.quarter,id:d.id,text:d.text})),
      purchases:MoC.S.interventions.filter(i=>i.cost>0).map(i=>i.label),external:MoC.environment.schedule};
  });
    if(errors.length)throw new Error(`${purchasePolicy}/${responsePolicy}/${seed}: ${errors.join('; ')}`);
    if(!result.politicalOutcome)throw new Error(`${purchasePolicy}/${responsePolicy}/${seed}: run stopped at tick ${result.care.tick} without an ending`);
    return {purchasePolicy,responsePolicy,...result};
  } finally {
    await context.close().catch(()=>{});
  }
}

(async()=>{
  const server=staticServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,args:['--mute-audio']});
  try{
    const jobs=[];
    for(const seed of seeds)for(const [purchasePolicy,wishlist] of Object.entries(purchasePolicies))for(const responsePolicy of responsePolicies)
      jobs.push({seed,purchasePolicy,wishlist,responsePolicy});
    const results=await mapConcurrent(jobs,concurrency,job=>play(browser,base,job.seed,job.purchasePolicy,job.wishlist,job.responsePolicy));
    const output=JSON.stringify({generatedAt:new Date().toISOString(),scenario:'cabinetcrisis',seeds,responsePolicies,purchasePolicies:Object.keys(purchasePolicies),concurrency,results},null,2)+'\n';
    if(outputPath){
      const temporary=outputPath+'.tmp-'+process.pid;
      try { writeFileSync(temporary,output,'utf8'); renameSync(temporary,outputPath); }
      finally { rmSync(temporary,{force:true}); }
      console.error(`Wrote ${results.length} completed runs to ${outputPath}`);
    } else console.log(output);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
