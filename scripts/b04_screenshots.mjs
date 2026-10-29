// Captures B04 end-screen screenshots from a local static server. No network or leaderboard access.
import { createReadStream, existsSync, statSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-chromium';

const SITE = join(process.cwd(), 'site'), OUT = join(process.cwd(), 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const server = createServer((req, res) => {
  const path = normalize(join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'minister.html'));
  if (!path.startsWith(SITE) || !existsSync(path) || !statSync(path).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
  createReadStream(path).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const cases = {
  'election-lost': ['campaign', () => { const G = MoC.S; G.promises = [0, 1, 2]; G._electionHeld = true; G._electionResult = 'failed';
    _mocDebug.applyFx({ trustC: -12, trustP: -22 }, 'Law enacted: Fast-track Act'); _mocDebug.applyFx({ trustD: -8 }, 'Decision: Push the staff harder'); _mocDebug.endTerm('election'); }],
  'no-confidence': ['cabinetcrisis', () => { _mocDebug.applyFx({ trustP: -32 }, 'Law enacted: Hospital Reform Act'); _mocDebug.applyFx({ trustP: -9 }, 'Resident request: Refer to local service'); _mocForceCouncil(2); }],
  'won': ['cabinetcrisis', () => { _mocDebug.applyFx({ trustC: 12, trustD: 14, trustP: 16 }, 'Decision: Open the books'); MoC.onTermEnd(); }],
  'protest': ['cabinetcrisis', () => { _mocDebug.applyFx({ trustC: -40 }, 'Decision: Keep normal queue'); _mocForceCouncil(2); }],
};
const viewports = { desktop: { width: 1024, height: 768 }, tablet: { width: 768, height: 1024 }, phone: { width: 480, height: 854 } };
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
for (const [name, [scenario, drive]] of Object.entries(cases)) {
  for (const [vp, size] of Object.entries(viewports)) {
    const page = await browser.newPage({ viewport: size });
    await page.addInitScript(() => localStorage.setItem('moc_muted_v2', 'true'));
    await page.route('**/*', route => route.request().url().startsWith(`http://127.0.0.1:${port}/`) && route.request().method() === 'GET'
      ? route.continue() : route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://127.0.0.1:${port}/minister.html?debug=1#scn=${scenario}&seed=2468`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { document.getElementById('play-overlay')?.remove(); clearInterval(autoTimer); autoTimer = null; MoC.paused = true; });
    await page.evaluate(drive);
    await page.locator('#moc-why').waitFor();
    await page.waitForTimeout(3200);
    await page.evaluate(() => document.getElementById('moc-why').scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: join(OUT, `b04-${name}-${vp}.png`) });
    await page.close();
  }
}
await browser.close(); server.close();
