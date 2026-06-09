const puppeteer=require('puppeteer');
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  const p=await b.newPage();
  const errs=[];
  p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  p.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
  for(const path of ['/', '/replay.html']){
    await p.goto('http://127.0.0.1:8787'+path,{waitUntil:'networkidle0',timeout:15000});
  }
  // on replay page: click SOLL, play, advance
  await p.click('#mode-SOLL');
  const cards=await p.$$eval('.card',els=>els.length);
  await p.click('#play');
  await new Promise(r=>setTimeout(r,1500));
  const clock=await p.$eval('#clock',e=>e.textContent);
  const deaths=await p.$eval('#k-deaths',e=>e.textContent);
  const alerts=await p.$eval('#k-alerts',e=>e.textContent);
  console.log('cards:',cards,'| clock:',clock,'| deaths:',deaths,'| alerts:',alerts);
  console.log('errors:',errs.length?errs.join(' || '):'NONE');
  await b.close();
})();
