// Generates the social-preview (Open Graph) images the site HTML references but
// that don't exist yet: site/og-image.png and site/assets/og-preview.png.
// Renders the live world.html town at exact OG dimensions (1200x630).
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..', 'site');
const OUT1 = path.join(ROOT, 'og-image.png');
const OUT2 = path.join(ROOT, 'assets', 'og-preview.png');
const PORT = 8097;

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
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
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
    // deviceScaleFactor 1 => output PNG is exactly 1200x630 (Open Graph spec).
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.goto(`http://localhost:${PORT}/world.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => {
      try { if (typeof startNewGame === 'function') startNewGame(); } catch (e) {}
      try { if (typeof launchSimulation === 'function') launchSimulation(); } catch (e) {}
      document.querySelectorAll('button, .btn, [onclick]').forEach((b) => {
        const t = (b.textContent || '').toLowerCase();
        if (/start|skip|begin|play|continue|new game/.test(t)) { try { b.click(); } catch (e) {} }
      });
    });
    await new Promise((r) => setTimeout(r, 8000));
    const buf = await page.screenshot();          // viewport shot => 1200x630
    fs.writeFileSync(OUT1, buf);
    if (!fs.existsSync(path.dirname(OUT2))) fs.mkdirSync(path.dirname(OUT2), { recursive: true });
    fs.writeFileSync(OUT2, buf);
    console.log('Wrote', OUT1, '(' + buf.length + ' bytes)');
    console.log('Wrote', OUT2);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
