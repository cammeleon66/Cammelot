// Quick CDP probe/driver for minister.html testing (bypasses MCP snapshot).
// Usage: node tools/cdp-probe.js <port> <expression-file-or-inline>
const port = process.argv[2] || '49324';
const exprArg = process.argv.slice(3).join(' ');

(async () => {
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
  const page = tabs.find(t => t.type === 'page' && t.url.includes('minister'));
  if (!page) { console.error('no minister tab'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = {};
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
  };
  const send = (method, params, timeoutMs) => new Promise((res, rej) => {
    const myId = ++id;
    pending[myId] = res;
    ws.send(JSON.stringify({ id: myId, method, params }));
    setTimeout(() => { if (pending[myId]) { delete pending[myId]; rej(new Error('cdp timeout ' + method)); } }, timeoutMs || 120000);
  });
  const fs = require('fs');
  const expression = fs.existsSync(exprArg) ? fs.readFileSync(exprArg, 'utf8') : exprArg;
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (r.error) console.error('CDP error:', JSON.stringify(r.error));
  else if (r.result && r.result.exceptionDetails) console.error('JS exception:', JSON.stringify(r.result.exceptionDetails.exception));
  else console.log(typeof r.result.result.value === 'string' ? r.result.result.value : JSON.stringify(r.result.result.value));
  ws.close();
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
