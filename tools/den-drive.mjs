// My hands as the person, in a hidden Chrome: open the Den, click, drag, read what's on the page, take pictures. Never touches their screen.
// It talks to the real Den (same table, same work area), so I put back anything I move.
//   node tools/den-drive.mjs <script.mjs>     the script's default export gets { page, shot, click, drag, text, wait, eval }
//   node tools/den-drive.mjs shot out.png     one picture of the Den as it really is, dividers and all
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CONF = (() => { try { return JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8')); } catch { return {}; } })();
const BASE = process.env.DEN_URL || 'http://127.0.0.1:' + (CONF.port || 7950);
const CHROME = (await fetch(BASE + '/api/health').then(r => r.json()).catch(() => ({}))).chrome; if (!CHROME) { console.log('No Chrome or Edge found, or the Den is not running: node tools/den.js doctor'); process.exit(1); }
const PORT = 9300 + Math.floor(Math.random() * 400);
const prof = path.join(process.env.TEMP || '.', 'den-drive-profile-' + PORT);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const waits = new Map();
async function connect() {
  for (let i = 0; i < 60; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); break; } } catch {} await sleep(150); }
  if (!ws) throw new Error('Chrome did not start');
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { const { r, j } = waits.get(m.id); waits.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } };
}
const send = (method, params = {}) => new Promise((r, j) => { const n = ++id; waits.set(n, { r, j }); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
const api = {
  eval: ev, wait: sleep,
  async page(url = '/den/') { await send('Page.navigate', { url: BASE + url }); await sleep(1800); },
  async shot(out) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(out, Buffer.from(r.data, 'base64')); return out; },
  // where a thing is: a CSS selector, or text:"words" for the first element whose own text has them
  async at(sel) { const r = await ev(`(() => { const s = ${JSON.stringify(sel)}; let e; if (s.startsWith('text:')) { const w = s.slice(5); e = [...document.querySelectorAll('button, a, .card, .tile, b, span, div')].filter(x => x.offsetParent && x.textContent.trim().startsWith(w)).sort((a, b) => a.textContent.length - b.textContent.length)[0]; } else e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`); if (!r) throw new Error('not on the page: ' + sel); return r; },
  async click(sel) { const p = await api.at(sel); await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y); await mouse('mouseReleased', p.x, p.y); await sleep(500); },
  async hover(sel) { const p = await api.at(sel); await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await sleep(300); },
  async drag(sel, dx, dy) { const p = await api.at(sel); await mouse('mouseMoved', p.x, p.y, { buttons: 0 }); await mouse('mousePressed', p.x, p.y); for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', p.x + dx * i / 8, p.y + dy * i / 8); await sleep(30); } await mouse('mouseReleased', p.x + dx, p.y + dy); await sleep(900); },
  async key(k) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: k === 'Escape' ? 27 : 13 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k }); await sleep(400); },
  text: sel => ev(`(document.querySelector(${JSON.stringify(sel)})?.innerText || '').trim()`),
  errors: () => ev('window.__errs || []'),
};
try {
  await connect(); await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__errs = []; window.addEventListener("error", e => window.__errs.push(e.message)); window.addEventListener("unhandledrejection", e => window.__errs.push(String(e.reason)));' });
  const [a, b] = process.argv.slice(2);
  if (a === 'shot') { await api.page(); console.log(await api.shot(b || 'den.png')); }
  else if (a) { await (await import(pathToFileURL(path.resolve(a)).href)).default(api); }
  else console.log('usage: den-drive.mjs <script.mjs> | shot out.png');
} catch (e) { console.error('den-drive: ' + e.message); process.exitCode = 1; }
finally { try { ws?.close(); } catch {} chrome.kill(); await sleep(400); try { fs.rmSync(prof, { recursive: true, force: true }); } catch {} }
