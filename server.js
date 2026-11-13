#!/usr/bin/env node
// The Den: a table you and your AI share. Plain Node, nothing to install.
//   node server.js            start it (or: node tools/den.js start, which starts it hidden)
// Settings live in config.json (made from config.example.json on first start). Everything it keeps is in this folder:
// the cards in table/, its own state and log in data/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router, dress, readBody } from './lib/router.js';
import { denRoutes } from './lib/routes.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = path.join(HERE, 'config.json');
if (!fs.existsSync(CONFIG)) fs.copyFileSync(path.join(HERE, 'config.example.json'), CONFIG);
let raw;
try { raw = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); }
catch (e) { console.error(`config.json is broken (${e.message}). Fix it (write paths with forward slashes) and start again.`); process.exit(1); }

const DATA = path.join(HERE, 'data'); fs.mkdirSync(DATA, { recursive: true });
const LOG = path.join(DATA, 'den.log');
const log = (...a) => { const l = `${new Date().toISOString()} ${a.join(' ')}\n`; try { fs.appendFileSync(LOG, l); } catch {} };

function findChrome() {
  if (raw.chrome && fs.existsSync(raw.chrome)) return raw.chrome;
  const pf = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const tries = pf.flatMap(p => [path.join(p, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(p, 'Microsoft', 'Edge', 'Application', 'msedge.exe')]);
  return tries.find(p => fs.existsSync(p)) || null;
}

export const cfg = {
  port: Number(process.env.DEN_PORT || raw.port || 7950),
  ai: raw.ai || 'Claude',
  person: raw.person || 'You',
  homebase: raw.homebase || '',
  den: {
    dir: path.resolve(HERE, raw.table || '.'),
    dataDir: DATA,
    toolsDir: path.join(HERE, 'tools'),
    chrome: findChrome(),
  },
  distDir: path.join(HERE, 'app-dist'),
};
fs.mkdirSync(path.join(cfg.den.dir, 'table'), { recursive: true });

// Live updates for the page.
const clients = new Set(); let seq = 0;
const hub = {
  send(event, data) { const m = `id: ${++seq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`; for (const r of clients) r.write(m); },
};

const PAGE = path.join(HERE, 'app', 'index.html');
const den = denRoutes({ ...cfg, pageFile: PAGE }, hub);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function page() {
  let h = fs.readFileSync(PAGE, 'utf8');
  h = h.replace(/\{\{AI\}\}/g, esc(cfg.ai)).replace(/\{\{PERSON\}\}/g, esc(cfg.person));
  h = h.replace('{{HOME}}', cfg.homebase ? `<a class="home" href="${esc(cfg.homebase)}">← Homebase</a>` : '');
  return h;
}
const STATIC = { '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// Only this PC, and never a web page in a browser tab acting on its own (DNS rebinding, other sites posting here).
function allowed(req) {
  const host = String(req.headers.host || '').replace(/:\d+$/, '');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) return false;
  const o = req.headers.origin;
  if (o && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(o)) return false;
  return true;
}

const server = http.createServer(async (req, res) => {
  dress(req, res);
  if (!allowed(req)) return res.status(403).json({ error: 'the Den only answers this PC' });
  const u = new URL(req.url, 'http://127.0.0.1');
  req.query = Object.fromEntries(u.searchParams);
  const p = u.pathname;
  try {
    if (p === '/api/health') return res.json({ ok: true, den: true, folder: HERE, ai: cfg.ai, person: cfg.person, port: cfg.port, chrome: cfg.den.chrome, pid: process.pid });
    if (p === '/api/quit' && req.method === 'POST') { res.json({ ok: true }); log('quit'); return setTimeout(() => process.exit(0), 100); }
    if (p === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
      res.write('retry: 3000\n: connected\n\n'); clients.add(res);
      const beat = setInterval(() => res.write(': ping\n\n'), 15000); beat.unref();
      const done = () => { clearInterval(beat); clients.delete(res); };
      req.on('close', done); res.on('error', done); return;
    }
    if (p.startsWith('/api/den')) {
      req.body = await readBody(req);
      const sub = p.slice('/api/den'.length) || '/';
      // Older glasses drop marks as { kind: image|text, title, body | data, parent }: take them as cards.
      if (sub === '/items' && req.method === 'POST') {
        const b = req.body || {};
        const card = b.kind === 'image'
          ? { kind: 'picture', title: b.title, name: b.name, mime: b.mime || 'image/png', data: b.data, by: 'person' }
          : { kind: 'text', title: b.title, body: b.body || '', by: 'person' };
        const c = await den.table.create(card);
        if (b.parent) await den.table.say(b.parent, { text: `With it: card #${c.id}`, by: 'person' }).catch(() => {});
        hub.send('den', { what: 'drop', card: c.id });
        return res.status(201).json({ id: c.id, ...c });
      }
      if (await den.handle(req, res, sub)) return;
      return res.status(404).json({ error: 'no such Den call' });
    }
    if (p === '/' || p === '/den' || p === '/den/' || p === '/index.html') return res.set('Cache-Control', 'no-store').type('html').send(page());
    const file = path.join(HERE, 'app', path.basename(p));
    if (STATIC[path.extname(file)] && fs.existsSync(file)) return res.type(STATIC[path.extname(file)]).sendFile(file);
    res.status(404).json({ error: 'not found' });
  } catch (e) {
    log('error', req.method, p, e.stack || e);
    if (!res.headersSent) res.status(e.status || 500).json({ error: e.message || String(e) });
  }
});
server.on('error', e => { log('server error', e.code || e.message); console.error(e.code === 'EADDRINUSE' ? `Port ${cfg.port} is taken. Another Den (or something else) is on it: node tools/den.js doctor` : e.message); process.exit(1); });
server.requestTimeout = 0; // den.js wait holds a request open for minutes
server.listen(cfg.port, '127.0.0.1', () => { log('started on', cfg.port, 'from', HERE); console.log(`The Den is at http://127.0.0.1:${cfg.port}/`); });
