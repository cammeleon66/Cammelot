// Capture REAL Cammelot world frames from site/world.html (the crafted 16-bit engine).
// Non-embed mode renders the canvas properly; we remove overlays, size #game-wrap to the
// map's exact aspect ratio, drive tick() manually, and screenshot the real town.
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const OUTDIR = path.join(ROOT, 'local_review', 'assets', 'frames');
const PORT = 8799;
const FRAMES = 100;
const CPF = 30;
const TARGET_W = 1100;

function serve() {
  const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
    '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json', '.svg':'image/svg+xml',
    '.webp':'image/webp', '.gif':'image/gif', '.mp3':'audio/mpeg', '.woff2':'font/woff2' };
  return http.createServer((req, res) => {
    let fp = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(fp, (e, data) => {
      if (e) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(fp)] || 'application/octet-stream' });
      res.end(data);
    });
  }).listen(PORT, '127.0.0.1');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function captureMode(page, mode) {
  await page.goto(`http://127.0.0.1:${PORT}/site/world.html`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(
    "typeof agents!=='undefined' && agents && agents.length>0 && typeof mapImgW!=='undefined' && mapImgW>0 && (typeof mapLoaded==='undefined'||mapLoaded)",
    { timeout: 30000 });
  const dims = await page.evaluate((mode, TARGET_W) => {
    ['load','play-overlay','walkthrough-overlay','wizard-overlay','welcome-card','town-feed','intro-overlay']
      .forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
    document.querySelectorAll('.walkthrough-overlay,.wizard-overlay').forEach(e => e.remove());
    try { if (typeof autoTimer !== 'undefined' && autoTimer) { clearInterval(autoTimer); autoTimer = null; } } catch (e) {}
    try { setMode(mode); } catch (e) {}
    const h = Math.round(TARGET_W * mapImgH / mapImgW);
    const gw = document.getElementById('game-wrap');
    gw.style.position = 'fixed'; gw.style.left = '0'; gw.style.top = '0';
    gw.style.width = TARGET_W + 'px'; gw.style.height = h + 'px';
    gw.style.zIndex = '99999'; gw.style.margin = '0';
    try { userZoomed = false; dragStart = null; zoom = 1; } catch (e) {}
    try { render(); } catch (e) {}
    return { w: TARGET_W, h };
  }, mode, TARGET_W);
  await page.setViewport({ width: dims.w, height: dims.h, deviceScaleFactor: 1 });
  await sleep(700);
  await page.evaluate(() => { try { render(); } catch (e) {} });
  const dir = path.join(OUTDIR, mode.toLowerCase());
  fs.mkdirSync(dir, { recursive: true });
  const gw = await page.$('#game-wrap');
  for (let f = 0; f < FRAMES; f++) {
    await gw.screenshot({ path: path.join(dir, `f${String(f).padStart(3,'0')}.jpg`), type: 'jpeg', quality: 74 });
    await page.evaluate((n) => { for (let i = 0; i < n; i++) { try { tick(); } catch (e) {} } }, CPF);
    await sleep(180);
  }
  console.log(`  ${mode}: ${FRAMES} frames @ ${dims.w}x${dims.h} -> ${dir}`);
  return dims;
}

(async () => {
  const server = serve();
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  fs.mkdirSync(OUTDIR, { recursive: true });
  let dims = { w: TARGET_W, h: TARGET_W };
  for (const mode of ['IST', 'SOLL']) {
    console.log('Capturing', mode, '...');
    dims = await captureMode(page, mode);
  }
  fs.writeFileSync(path.join(OUTDIR, 'manifest.json'),
    JSON.stringify({ frames: FRAMES, cpf: CPF, modes: ['IST', 'SOLL'], w: dims.w, h: dims.h }));
  await browser.close();
  server.close();
  console.log('Done.');
})();
