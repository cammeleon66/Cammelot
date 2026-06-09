const puppeteer=require('puppeteer');
(async()=>{
  const b=await puppeteer.launch({headless:'new'});
  const p=await b.newPage();
  await p.setViewport({width:1100,height:900});
  const errs=[];
  p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  p.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
  await p.goto('http://127.0.0.1:8787/replay.html',{waitUntil:'networkidle0',timeout:15000});
  // advance to mid-run via scrubber so sprites are dispersed
  await p.$eval('#scrub', e=>{ e.value=45; e.dispatchEvent(new Event('input')); });
  await new Promise(r=>setTimeout(r,1500)); // let animation ease
  // check the canvas actually drew (non-uniform pixels)
  const drawn=await p.$eval('#town', cv=>{
    const ctx=cv.getContext('2d'); const d=ctx.getImageData(0,0,cv.width,cv.height).data;
    const cols=new Set(); for(let i=0;i<d.length;i+=4000){ cols.add(d[i]+','+d[i+1]+','+d[i+2]); }
    return cols.size;
  });
  await p.screenshot({path:'scripts/output/replay_town_ist.png'});
  await p.click('#mode-SOLL');
  await p.$eval('#scrub', e=>{ e.value=45; e.dispatchEvent(new Event('input')); });
  await new Promise(r=>setTimeout(r,1200));
  await p.screenshot({path:'scripts/output/replay_town_soll.png'});
  const clock=await p.$eval('#clock',e=>e.textContent);
  console.log('distinct canvas colors (IST mid):',drawn,'| SOLL clock:',clock);
  console.log('errors:',errs.length?errs.join(' || '):'NONE');
  await b.close();
})();
