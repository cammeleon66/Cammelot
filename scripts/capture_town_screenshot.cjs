// Captures a world.html screenshot for the T5 blog figure.
// Serves site/ statically, loads world.html headless, lets the persona town
// run long enough to populate speech bubbles, then snapshots the canvas area.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..', 'site');
const OUT = path.join(__dirname, 'output', 'world_town_screenshot.png');
const PORT = 8099;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/world.html';
      const filePath = path.join(ROOT, urlPath);
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath)) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

(async () => {
  const server = await serve();
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://localhost:${PORT}/world.html`, { waitUntil: 'networkidle2', timeout: 60000 });

    // Dismiss any intro/walkthrough overlay and start the sim if needed.
    await page.evaluate(() => {
      try { if (typeof startNewGame === 'function') startNewGame(); } catch (e) {}
      try { if (typeof launchSimulation === 'function') launchSimulation(); } catch (e) {}
      // Click any visible "start"/"skip" style buttons.
      document.querySelectorAll('button, .btn, [onclick]').forEach((b) => {
        const t = (b.textContent || '').toLowerCase();
        if (/start|skip|begin|play|continue|new game/.test(t)) { try { b.click(); } catch (e) {} }
      });
    });

    // Let it run so personas populate speech bubbles.
    await new Promise((r) => setTimeout(r, 9000));

    await page.screenshot({ path: OUT });
    console.log('Saved screenshot:', OUT);
    if (errors.length) console.log('page errors (non-fatal):', errors.slice(0, 5).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
