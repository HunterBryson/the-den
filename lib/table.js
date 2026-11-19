// The Den's table (Nov 8). What I'm holding, kept where the person can see it and mark it with the glass.
//
// A card is one thing we work on: a mock-up (a page I made, every version kept), a picture, a page I
// captured from the web, words (a draft, a plan section, an idea), a voice dump, a chart, a file, or a
// drop from the glass (a crop of his screen, his words, the words in it, where it came from).
// Marks are what either of us put on a card: a box, circle, arrow, underline, pen stroke or note, in the
// card's own coordinates (design pixels for a mock-up, fractions of the picture for everything else),
// optionally with the phrase it sits on, so a mark can follow its words when a version changes.
// Everything lives in the Den repo under table/<n>/ as files:
//   card.json   the card, its versions, marks and says
//   v<N>.html   a mock-up's versions; v<N>.md a text's versions
//   orig.<ext>  a picture or file as it came in; page.png a captured page
//   work.html|md  the working copy (Nov 9): the file I edit with my own tools. Every save of it becomes the
//               next step, and the page changes in place while he watches. `edit` does the same by find-and-replace.
// Every change goes out over SSE (`den`) and into an event log, so the page redraws by itself, a hook
// can tell me what he did since his last message, and `den.js wait` wakes a watching chat.
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { HttpError } from './util.js';

export const KINDS = ['mock', 'picture', 'page', 'text', 'voice', 'chart', 'file', 'drop'];
export const MARK_KINDS = ['box', 'circle', 'arrow', 'underline', 'pen', 'note', 'step'];
const WHO = ['hunter', 'odie'];
const now = () => new Date().toISOString();
const by = v => (WHO.includes(v) ? v : 'hunter');
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf', 'text/plain': 'txt', 'text/markdown': 'md', 'text/csv': 'csv' };
const clip = (s, n) => String(s ?? '').slice(0, n);

export function createTable(cfg, { onChange = () => {} } = {}) {
  const root = path.join(cfg.den.dir, 'table');
  const dataDir = cfg.den.dataDir;
  const eventsFile = path.join(dataDir, 'events.jsonl');
  const cursorFile = path.join(dataDir, 'odie-cursor.json');
  const handFile = path.join(dataDir, 'hand.json');
  const dirOf = id => path.join(root, String(id));
  let seq = null;
  const waiters = new Set();      // chats waiting for him to ask
  const claims = new Map();       // pending glass marks waiting for the page to place them
  const wheres = new Map();       // my "where is card N on screen" questions waiting for the page

  // ---------- events ----------
  async function lastSeq() {
    if (seq !== null) return seq;
    seq = 0;
    try { const lines = (await fs.readFile(eventsFile, 'utf8')).trim().split('\n'); seq = (lines.at(-1) && JSON.parse(lines.at(-1)).seq) || 0; } catch {}
    return seq;
  }
  async function log(ev) {
    await fs.mkdir(dataDir, { recursive: true });
    const e = { seq: (await lastSeq()) + 1, at: now(), ...ev };
    seq = e.seq;
    await fs.appendFile(eventsFile, JSON.stringify(e) + '\n');
    if (e.who === 'hunter' && WAKES.has(e.what)) for (const w of [...waiters]) w(e);
    return e;
  }
  // Nov 12: nothing reaches me until he sends (the glass rule); since Nov 17 his one send is the glass card's ➤. What he did before it rides along.
  const WAKES = new Set(['send']);
  async function events(after = 0) {
    try { return (await fs.readFile(eventsFile, 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(e => e.seq > after); } catch { return []; }
  }
  async function cursor() { try { return JSON.parse(await fs.readFile(cursorFile, 'utf8')).seq || 0; } catch { return 0; } }
  async function setCursor(n) { await fs.mkdir(dataDir, { recursive: true }); await fs.writeFile(cursorFile, JSON.stringify({ seq: n, at: now() })); }
  /** What the person did since I last looked. */
  async function news({ advance = true } = {}) {
    const from = await cursor();
    const list = await standing((await events(from)).filter(e => e.who === 'hunter'));
    const top = await lastSeq();
    if (advance && top > from) await setCursor(top);
    return { from, to: top, events: list, hand: await hand() };
  }
  function waitForAsk(ms) {
    return new Promise(resolve => {
      const done = e => { clearTimeout(t); waiters.delete(done); resolve(e); };
      const t = setTimeout(() => { waiters.delete(done); resolve(null); }, ms);
      waiters.add(done);
    });
  }

  // ---------- the hand: what's showing ----------
  // I hold one card at a time (`hold`), and the page shows it, unless he pinned one himself.
  async function hand() { try { return JSON.parse(await fs.readFile(handFile, 'utf8')); } catch { return { odie: null, pinned: null, compare: null }; } }
  async function setHand(patch, who) {
    const h = { ...(await hand()), ...patch, at: now() };
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(handFile, JSON.stringify(h));
    onChange({ what: 'hand', hand: h, who });
    return h;
  }
  async function hold(id, who = 'odie', note) {
    if (id) await read(id);
    await setBench(id ? [Number(id)] : [], who);
    const h = await setHand(who === 'odie' ? { odie: id ? Number(id) : null } : { pinned: id ? Number(id) : null }, who);
    if (who === 'hunter') await log({ who, what: id ? 'pin' : 'unpin', card: id ? Number(id) : null });
    else if (id && note) await presence(note, id);
    return h;
  }
  async function compare(ids, who = 'odie') {
    const list = (ids || []).map(Number).filter(Boolean).slice(0, 3);
    for (const i of list) await read(i);
    if (list.length) await setBench(list, who);
    return setHand({ compare: list.length > 1 ? list : null }, who);
  }

  // ---------- the work area (Nov 12): which cards are out, in order. One fills it, two sit side by side,
  // a third sits under them, four make a grid. Either of us arranges it; I always know what he sees.
  const benchFile = path.join(dataDir, 'bench.json');
  async function bench() { try { const b = JSON.parse(await fs.readFile(benchFile, 'utf8')); return Array.isArray(b.items) ? b : { items: [] }; } catch { const h = await hand(); return { items: h.compare || (h.pinned || h.odie ? [h.pinned || h.odie] : []) }; } }
  async function setBench(list, who = 'odie') {
    const items = [...new Set((list || []).map(Number).filter(Boolean))].slice(0, 4);
    const have = new Set(await ids());
    const prev = await bench();
    const b = { items: items.filter(i => have.has(i)), layout: prev.layout || null, by: by(who), at: now() };
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(benchFile, JSON.stringify(b));
    onChange({ what: 'bench', bench: b });
    return b;
  }
  // How the cards that are out share the room (Nov 16): shape 'grid' (two side by side, a third under, four in a grid),
  // 'row' (all across) or 'main' (the first one big on the left, the rest stacked on the right). split is the left
  // column's share (0.2 to 0.8), rsplit the top row's share, cols the shares in a row. Either of us sets it.
  async function setLayout(l, who = 'odie') {
    const b = await bench(); const old = b.layout || {};
    const c = (x, d) => { const n = Number(x); return x != null && Number.isFinite(n) && n > 0 ? Math.min(0.8, Math.max(0.2, n > 1 ? n / 100 : n)) : d; };
    if (!l || l.shape === 'reset') b.layout = null;
    else {
      const shape = ['grid', 'row', 'main'].includes(l.shape) ? l.shape : (old.shape || 'grid');
      let cols = Array.isArray(l.cols) ? l.cols.map(Number).filter(n => n > 0).slice(0, 4) : (shape === old.shape && l.cols !== null ? old.cols || null : null);
      if (cols && cols.length < 2) cols = null;
      b.layout = { shape, split: c(l.split, old.split ?? 0.5), rsplit: c(l.rsplit, old.rsplit ?? 0.5), cols: shape === 'row' ? cols : null };
    }
    b.by = by(who); b.at = now();
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(benchFile, JSON.stringify(b));
    onChange({ what: 'bench', bench: b });
    return b;
  }

  // ---------- jobs: what I'm in the middle of, so he can see it ----------
  let jobs = [], jobSeq = 0;
  function liveJobs() { jobs = jobs.filter(j => Date.now() - new Date(j.at) < 20 * 60_000); return jobs; }
  function startJob(body = {}) { const j = { id: ++jobSeq, what: clip(body.what, 200).trim() || 'working', card: Number(body.card) || null, at: now() }; jobs.push(j); onChange({ what: 'jobs' }); return j; }
  function endJob(id) { jobs = jobs.filter(j => String(j.id) !== String(id)); onChange({ what: 'jobs' }); return { ok: true }; }

  // ---------- what reaches me on his next ➤ (Nov 17) ----------
  // His one send is the glass card's ➤ (his words: "they get sent on the card's send"). The glass calls POST /api/den/send
  // with every ➤, and what he put on the table since the last one rides along: files he dropped or pasted (Add to table)
  // and his ⤓ Den drops from the glass. The old asks list, Merge and the Gallery's way in came out the same day.
  const outFile = path.join(dataDir, 'outbox.json');
  async function outbox() { try { const o = JSON.parse(await fs.readFile(outFile, 'utf8')); return { sentSeq: o.sentSeq || 0 }; } catch { const o = { sentSeq: await lastSeq() }; try { await fs.mkdir(dataDir, { recursive: true }); await fs.writeFile(outFile, JSON.stringify(o)); } catch {} return o; } }
  async function saveOut(o) { await fs.mkdir(dataDir, { recursive: true }); await fs.writeFile(outFile, JSON.stringify({ sentSeq: o.sentSeq })); onChange({ what: 'outbox' }); return o; }
  /** What he put on the table since his last ➤ that I haven't heard: files he brought, glass drops. */
  async function unsent(o) { return standing((await events(o.sentSeq)).filter(e => e.who === 'hunter' && ['bring', 'drop', 'say'].includes(e.what))); }
  async function send() {
    const o = await outbox(); const did = await unsent(o);
    if (!did.length) return { ok: true, sent: 0 };
    const e = await log({ who: 'hunter', what: 'send', did: did.map(d => ({ what: d.what, card: d.card, title: d.title, text: d.text })), bench: (await bench()).items });
    o.sentSeq = e.seq; await saveOut(o);
    return { ok: true, sent: did.length };
  }

  // ---------- presence: my one line ----------
  const presenceFile = path.join(dataDir, 'presence.json');
  async function readPresence() { try { return JSON.parse(await fs.readFile(presenceFile, 'utf8')); } catch { return null; } }
  async function presence(doing, card) {
    const p = { doing: clip(doing, 240).replace(/\s+/g, ' ').trim(), card: Number(card) || null, at: now() };
    if (!p.doing) throw new HttpError(400, 'doing is required');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(presenceFile, JSON.stringify(p));
    onChange({ what: 'presence', presence: p });
    return p;
  }

  // ---------- storage ----------
  async function read(id) {
    try { return JSON.parse(await fs.readFile(path.join(dirOf(id), 'card.json'), 'utf8')); }
    catch { throw new HttpError(404, `no card #${id} on the table`); }
  }
  async function write(card, ev, { quiet } = {}) {
    card.updated = now();
    const f = path.join(dirOf(card.id), 'card.json'), tmp = `${f}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(card, null, 2));
    // Windows refuses a rename while anything is reading the file, so try again for a moment.
    for (let i = 0; ; i++) { try { await fs.rename(tmp, f); break; } catch (e) { if (i >= 8 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e; await new Promise(r => setTimeout(r, 25 * (i + 1))); } }
    if (ev) await log({ card: card.id, title: card.title, ...ev });
    if (!quiet) onChange({ what: 'card', id: card.id, ...(ev ? { did: ev.what, who: ev.who, n: ev.n } : {}) });
    return card;
  }
  async function ids() {
    try { return (await fs.readdir(root)).filter(n => /^\d+$/.test(n)).map(Number).sort((a, b) => a - b); } catch { return []; }
  }
  const summary = c => ({
    id: c.id, kind: c.kind, title: c.title, by: c.by, created: c.created, updated: c.updated, state: c.state,
    v: c.v || null, versions: c.versions?.length || 0, ways: c.ways?.list?.length || 0, w: c.w || null, h: c.h || null, touched: !!c.touched,
    marks: c.marks.length, open: c.marks.filter(m => m.by === 'hunter' && !m.reply).length,
    captured: !!c.captured, captureError: c.captureError || null, from: c.from || null, url: c.url || null, home: c.home || null, dump: c.dump || null, with: c.with || null,
    excerpt: c.kind === 'text' || c.kind === 'drop' ? clip(String(c.note || c.body || c.words || '').replace(/^#[^\n]*\n+/, ''), 200) : null,
    thumb: thumbOf(c),
    say: (() => { const s = c.says.filter(x => x.by === 'odie').at(-1); return s ? { text: clip(s.text, 280), at: s.at } : null; })(),
    about: c.about?.text || null, notes: c.says.length, lastNote: c.says.at(-1)?.edited || c.says.at(-1)?.at || null, lastOdieNote: c.says.filter(x => x.by === 'odie').at(-1)?.at || null,
    asked: c.asks.some(a => !a.answered), parents: c.parents || null,
    waiting: c.waiting?.text || null,
    lastOdie: [...c.says.filter(s => s.by === 'odie').map(s => s.at), ...c.marks.filter(m => m.reply).map(m => m.reply.at), ...(c.versions || []).filter(v => v.by === 'odie').map(v => v.at)].sort().at(-1) || null,
  });
  function thumbOf(c) {
    // A mock-up's thumbnail is its last whole version, so a run of small steps doesn't start a browser for each one.
    if (c.kind === 'mock') { const whole = [...(c.versions || [])].reverse().find(x => x.v <= c.v && !x.step); return `/api/den/cards/${c.id}/shot?v=${whole?.v || c.v}&thumb=1`; }
    if (c.file && /^image\//.test(c.file.mime)) return `/api/den/cards/${c.id}/file?v=${c.v || 1}`;
    if (c.kind === 'page' && c.captured) return `/api/den/cards/${c.id}/page.png`;
    return null;
  }
  async function list() {
    const out = [];
    for (const id of await ids()) { try { out.push(summary(await read(id))); } catch {} }
    return out.sort((a, b) => b.updated.localeCompare(a.updated));
  }
  async function everything() {
    const [cards, h, p, b, o] = await Promise.all([list(), hand(), readPresence(), bench(), outbox()]);
    return { now: now(), dir: cfg.den.dir, cards, hand: h, presence: p, bench: b.items.filter(i => cards.some(c => c.id === i)), layout: b.layout || null, jobs: liveJobs(),
      outbox: { did: (await unsent(o)).map(d => ({ what: d.what, card: d.card, title: d.title })) } };
  }

  // ---------- making cards ----------
  // One at a time, so two things landing together never share a number.
  let making = Promise.resolve();
  function create(body = {}) { const run = making.then(() => make(body)); making = run.catch(() => {}); return run; }
  async function make(body = {}) {
    const kind = body.kind;
    if (!KINDS.includes(kind)) throw new HttpError(400, `kind is one of ${KINDS.join(', ')}`);
    const who = by(body.by);
    const id = ((await ids()).at(-1) || 0) + 1;
    await fs.mkdir(dirOf(id), { recursive: true });
    const card = { id, kind, title: clip(body.title, 200).trim(), by: who, created: now(), updated: now(), state: 'open',
      marks: [], says: [], asks: [], touched: who === 'odie', parents: Array.isArray(body.parents) ? body.parents.map(Number).filter(Boolean).slice(0, 4) : undefined, with: Number(body.with) || null, home: body.home ? clip(body.home, 500) : null };
    if (kind === 'mock') {
      if (typeof body.html !== 'string' && Array.isArray(body.ways) && typeof body.ways[0]?.html === 'string') body.html = body.ways[0].html;
      if (typeof body.html !== 'string') throw new HttpError(400, 'a mock-up needs its html');
      card.w = Math.min(2400, Math.max(320, Number(body.w) || 1280));
      await fs.writeFile(path.join(dirOf(id), 'v1.html'), body.html);
      card.versions = [{ v: 1, by: who, at: now(), note: body.note ? clip(body.note, 2000) : null }]; card.v = 1;
    }
    if (kind === 'text') {
      if (typeof body.body !== 'string') throw new HttpError(400, 'words need a body');
      card.body = clip(body.body, 400000);
      await fs.writeFile(path.join(dirOf(id), 'v1.md'), card.body);
      card.versions = [{ v: 1, by: who, at: now(), note: body.note ? clip(body.note, 2000) : null }]; card.v = 1;
    }
    if (kind === 'chart') {
      const c = typeof body.body === 'string' ? JSON.parse(body.body) : body.body;
      if (!c || !Array.isArray(c.labels) || !Array.isArray(c.values) || c.labels.length !== c.values.length) throw new HttpError(400, 'a chart needs labels and values of the same length');
      card.body = c;
    }
    if (kind === 'picture' || kind === 'file' || kind === 'drop') {
      if (body.data) {
        const mime = String(body.mime || 'application/octet-stream');
        const ext = (body.name && path.extname(body.name).slice(1).toLowerCase().replace(/[^a-z0-9]/g, '')) || EXT[mime] || 'bin';
        await fs.writeFile(path.join(dirOf(id), `orig.${ext}`), Buffer.from(String(body.data), 'base64'));
        card.file = { name: body.name ? clip(body.name, 200) : `orig.${ext}`, mime, path: `orig.${ext}`, size: (await fs.stat(path.join(dirOf(id), `orig.${ext}`))).size };
        card.w = Number(body.w) || null; card.h = Number(body.h) || null;
      } else if (kind !== 'drop') throw new HttpError(400, 'data (base64) is needed');
    }
    if (kind === 'drop') {
      // From the glass: his words, the words in the crop, and where it came from.
      card.note = body.note ? clip(body.note, 4000) : null;
      card.words = body.words ? clip(body.words, 20000) : null;
      card.from = body.from && typeof body.from === 'object' ? { app: clip(body.from.app, 80), title: clip(body.from.title, 300), url: body.from.url ? clip(body.from.url, 2000) : null, screen: body.from.screen || null } : null;
      card.touched = false;
    }
    if (kind === 'page') {
      if (!/^https?:\/\//.test(String(body.url || ''))) throw new HttpError(400, 'a page needs its url');
      card.url = clip(body.url, 2000); card.w = Math.min(1920, Math.max(360, Number(body.w) || 1280)); card.captured = false;
    }
    if (kind === 'voice') {
      if (!body.dump) throw new HttpError(400, 'a voice card needs the dump id');
      card.dump = clip(body.dump, 80); card.body = body.body ? clip(body.body, 400000) : null; card.seconds = Number(body.seconds) || null;
    }
    if (!card.title) card.title = defaultTitle(card);
    await write(card, { what: kind === 'drop' ? 'drop' : who === 'hunter' ? 'bring' : 'put', who, kind });
    if (kind === 'page') capture(card.id).catch(async e => { try { const c = await read(card.id); c.captureError = String(e.message || e).slice(0, 300); await write(c, { what: 'capture failed', who: 'odie' }); } catch {} });
    await syncWork(card).catch(() => {});
    return card;
  }
  function defaultTitle(c) {
    const first = s => String(s || '').split(/[.!?\n]/)[0].trim();
    if (c.kind === 'drop') { const f = first(c.note) || first(c.words); return f ? (f.length > 70 ? f.slice(0, 67) + '…' : f) : `From ${c.from?.app || 'the glass'}`; }
    if (c.kind === 'text') return (String(c.body).match(/^#\s+(.+)$/m)?.[1] || first(c.body) || 'Words').slice(0, 120);
    if (c.kind === 'page') { try { return new URL(c.url).hostname.replace(/^www\./, ''); } catch { return 'A page'; } }
    if (c.kind === 'file') return c.file?.name || 'A file';
    const when = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return { mock: `Mock-up ${when}`, picture: `Picture ${when}`, voice: `Voice ${when}`, chart: `Chart ${when}` }[c.kind] || when;
  }

  // Every headless Chrome run shares one profile (data/shot-profile), and two at once collide: the second
  // fails without a screenshot (a cold test, Nov 15: two pages put back to back, only the first captured).
  // So they run one at a time.
  let chromeQueue = Promise.resolve();
  function chromeRun(chrome, args, timeout, what) {
    const run = chromeQueue.then(() => new Promise((res, rej) => execFile(chrome, args, { timeout }, e => {
      const out = (args.find(a => a.startsWith('--screenshot=')) || '').slice(13);
      return e && !fss.existsSync(out) ? rej(new HttpError(500, `${what} failed: ${e.message}`)) : res();
    })));
    chromeQueue = run.catch(() => {});
    return run;
  }

  /** Capture a page with headless Chrome: a tall screenshot at the card's width, then its words by OCR. */
  async function capture(id) {
    const c = await read(id);
    const out = path.join(dirOf(id), 'page.png');
    const chrome = cfg.den.chrome || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const prof = path.join(dataDir, 'shot-profile');
    const H = Math.min(6000, Number(c.pageH) || 2400);
    await chromeRun(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${prof}`, `--window-size=${c.w},${H}`, '--virtual-time-budget=6000', `--screenshot=${out}`, c.url], 45000, 'the capture');
    c.captured = true; delete c.captureError; c.h = H; c.ocr = await ocr(out).catch(() => null); c.words = c.ocr ? c.ocr.lines.map(l => l.text).join('\n').slice(0, 20000) : null;
    await write(c, { what: 'captured', who: 'odie' });
    return c;
  }
  /** Windows' own OCR on a picture: { lines: [{ text, words: [{ text, x, y, w, h }] }] } in picture pixels. */
  function ocr(file) {
    const ps1 = path.join(cfg.den.toolsDir, 'ocr.ps1');
    return new Promise(resolve => {
      const ps = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, file], { windowsHide: true });
      let o = ''; ps.stdout.on('data', d => o += d);
      const t = setTimeout(() => { ps.kill(); resolve(null); }, 20000);
      ps.on('close', () => { clearTimeout(t); try { resolve(JSON.parse(o.replace(/[\u0000-\u001f]/g, ' '))); } catch { resolve(null); } });
      ps.on('error', () => { clearTimeout(t); resolve(null); });
    });
  }
  /** The words of a picture card, read once and kept. */
  async function wordsOf(c) {
    if (c.ocr) return c.ocr;
    const f = c.kind === 'page' ? path.join(dirOf(c.id), 'page.png') : c.file ? path.join(dirOf(c.id), c.file.path) : null;
    if (!f || !fss.existsSync(f)) return null;
    c.ocr = await ocr(f); if (c.ocr) await write(c, null, { quiet: true });
    return c.ocr;
  }
  /** Find a phrase in a picture card's words: a rect in picture pixels, or null. */
  async function findPhrase(c, phrase) {
    const o = await wordsOf(c); if (!o) return null;
    const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const want = norm(phrase).split(' ').filter(Boolean); if (!want.length) return null;
    const words = o.lines.flatMap(l => l.words.map(w => ({ ...w, t: norm(w.text) })));
    for (let i = 0; i < words.length; i++) {
      let j = i, k = 0;
      while (j < words.length && k < want.length && (words[j].t === want[k] || (words[j].t && want[k].startsWith(words[j].t) && k === want.length - 1) || (words[j].t.startsWith(want[k]) && k === want.length - 1))) { j++; k++; }
      if (k === want.length) { const ws = words.slice(i, j); return { x: Math.min(...ws.map(w => w.x)), y: Math.min(...ws.map(w => w.y)), x2: Math.max(...ws.map(w => w.x + w.w)), y2: Math.max(...ws.map(w => w.y + w.h)), text: ws.map(w => w.text).join(' ') }; }
    }
    return null;
  }

  async function update(id, body = {}) {
    const c = await read(id);
    const who = by(body.by), did = [];
    if (typeof body.title === 'string' && body.title.trim()) { c.title = clip(body.title.trim(), 200); did.push('title'); }
    if (['open', 'settled', 'retired'].includes(body.state) && body.state !== c.state) { c.state = body.state; c.stateBy = who; c.stateAt = now(); if (body.why) c.stateWhy = clip(body.why, 2000); did.push(body.state); }
    if (typeof body.home === 'string') { c.home = clip(body.home, 500) || null; did.push('home'); }
    if (Number.isFinite(+body.w) && (c.kind === 'mock' || c.kind === 'page')) { c.w = Math.min(2400, Math.max(320, Math.round(+body.w))); did.push('w'); }
    if ('with' in body) { c.with = Number(body.with) || null; did.push('with'); }
    if (body.touched === true && !c.touched) { c.touched = true; did.push('touched'); }
    if ('about' in body) { const t = String(body.about || '').trim(); if (t) c.about = { text: clip(t, 600), at: now(), by: who }; else delete c.about; return write(c, null); }
    if ('waiting' in body) { if (body.waiting) c.waiting = { text: clip(body.waiting, 200), at: now() }; else delete c.waiting; return write(c, null); }
    if (typeof body.body === 'string' && c.kind === 'text' && body.body !== c.body) { await addVersion(id, { body: body.body, by: who, note: body.note }, c); did.push('words'); return read(id); }
    if (!did.length) throw new HttpError(400, 'nothing to change');
    if (did.length === 1 && did[0] === 'touched') return write(c, null, { quiet: false });
    return write(c, { what: did.includes('settled') || did.includes('retired') || did.includes('open') ? did.find(d => ['settled', 'retired', 'open'].includes(d)) : 'edit', who, fields: did, why: c.stateWhy });
  }
  async function remove(id, who = 'odie') {
    const c = await read(id);
    const gone = path.join(dataDir, 'removed', `${id}-${Date.now()}`);
    await fs.mkdir(path.dirname(gone), { recursive: true });
    await fs.cp(dirOf(id), gone, { recursive: true });
    await fs.rm(dirOf(id), { recursive: true, force: true });
    await log({ card: Number(id), title: c.title, what: 'remove', who: by(who) });
    { const b = await bench(); if (b.items.includes(Number(id))) await setBench(b.items.filter(i => i !== Number(id)), who); }
    onChange({ what: 'card', id: Number(id), did: 'remove' });
    return { ok: true, keptAt: gone };
  }

  // ---------- versions ----------
  async function addVersion(id, body = {}, c0) {
    const c = c0 || await read(id);
    if (c.file && /^image\//.test(c.file.mime) && body.data) return addPicture(c, body);
    if (c.kind !== 'mock' && c.kind !== 'text') throw new HttpError(400, `#${id} is a ${c.kind}; only mock-ups, words and pictures have versions`);
    const who = by(body.by);
    const v = (c.versions.at(-1)?.v || 0) + 1;
    if (c.kind === 'mock') { if (typeof body.html !== 'string') throw new HttpError(400, 'html is needed'); await fs.writeFile(path.join(dirOf(id), `v${v}.html`), body.html); if (Number(body.w)) c.w = Math.min(2400, Math.max(320, Number(body.w))); }
    else { if (typeof body.body !== 'string') throw new HttpError(400, 'body is needed'); await fs.writeFile(path.join(dirOf(id), `v${v}.md`), body.body); c.body = clip(body.body, 400000); }
    c.versions.push({ v, by: who, at: now(), note: body.note ? clip(body.note, 2000) : null, ...(body.step ? { step: true } : {}) });
    c.v = v;
    if (who === 'odie') for (const a of c.asks) if (!a.answered) a.answered = now();
    await write(c, { what: body.step ? 'step' : 'version', who, v, note: body.note ? clip(body.note, 300) : undefined });
    await syncWork(c).catch(() => {});
    return c;
  }
  async function addPicture(c, body) {
    const who = by(body.by), mime = String(body.mime || 'image/png'), ext = EXT[mime] || 'png';
    if (!c.versions?.length) { c.versions = [{ v: 1, by: c.by, at: c.created, note: null, path: c.file.path, mime: c.file.mime }]; c.v = 1; }
    const v = c.versions.at(-1).v + 1, p = `pic-v${v}.${ext}`;
    await fs.writeFile(path.join(dirOf(c.id), p), Buffer.from(String(body.data), 'base64'));
    c.versions.push({ v, by: who, at: now(), note: body.note ? clip(body.note, 2000) : null, path: p, mime });
    c.v = v; c.file = { ...c.file, path: p, mime, size: (await fs.stat(path.join(dirOf(c.id), p))).size }; c.ocr = undefined;
    if (Number(body.w)) { c.w = Number(body.w); c.h = Number(body.h) || null; }
    return write(c, { what: 'version', who, v, note: body.note ? clip(body.note, 300) : undefined });
  }
  async function showVersion(id, v, who) {
    const c = await read(id);
    const n = Number(v);
    if (!c.versions?.some(x => x.v === n)) throw new HttpError(404, `no version ${v} of #${id}`);
    c.v = n;
    const pv = c.versions.find(x => x.v === n); if (pv.path) { c.file = { ...c.file, path: pv.path, mime: pv.mime }; c.ocr = undefined; }
    if (c.kind === 'text') c.body = await fs.readFile(path.join(dirOf(id), `v${n}.md`), 'utf8'); // the words follow the version that's showing
    await write(c, null); await syncWork(c).catch(() => {}); return c;
  }

  // ---------- the working copy: I work on what's on the table, in place ----------
  const extOf = c => (c.kind === 'mock' ? 'html' : 'md');
  const workOf = c => path.join(dirOf(c.id), `work.${extOf(c)}`);
  const hasWork = c => c.kind === 'mock' || c.kind === 'text';
  /** The working copy always holds the version that's showing. */
  // What I last wrote into each working copy myself. The watcher skips a save that is only that (Nov 17: a late
  // watch event from my own sync read the old words mid-edit and posted them back as a new step, undoing the edit).
  const synced = new Map();
  async function syncWork(c) {
    if (!hasWork(c) || !c.v) return;
    const src = await fs.readFile(path.join(dirOf(c.id), `v${c.v}.${extOf(c)}`), 'utf8');
    synced.set(Number(c.id), src);
    let cur = null; try { cur = await fs.readFile(workOf(c), 'utf8'); } catch {}
    if (cur !== src) await fs.writeFile(workOf(c), src);
  }
  /** One step: the working copy as it now reads becomes the next version, and the page changes in place. */
  let stepping = Promise.resolve();
  function step(id, content, opt = {}) { const run = stepping.then(() => doStep(id, content, opt)); stepping = run.catch(() => {}); return run; }
  async function doStep(id, content, { note, who = 'odie' } = {}) {
    const c = await read(id);
    if (!hasWork(c)) throw new HttpError(400, `#${id} is a ${c.kind}; only mock-ups and words can be worked on in place yet`);
    const cur = await fs.readFile(path.join(dirOf(id), `v${c.v}.${extOf(c)}`), 'utf8');
    if (cur === content) return c;
    return addVersion(id, { [c.kind === 'mock' ? 'html' : 'body']: content, by: who, note, step: true }, c);
  }
  /** Find-and-replace in the working copy: { old, new, all?, note? }. */
  async function edit(id, body = {}) {
    const c = await read(id);
    if (!hasWork(c)) throw new HttpError(400, `#${id} is a ${c.kind}; only mock-ups and words can be worked on in place yet`);
    await syncWork(c);
    const src = await fs.readFile(workOf(c), 'utf8');
    const old = String(body.old ?? ''), neu = String(body.new ?? '');
    if (!old) throw new HttpError(400, 'old is needed: the exact text to change');
    const n = src.split(old).length - 1;
    if (!n) throw new HttpError(404, `I can't find that text in #${id}'s working copy`);
    if (n > 1 && !body.all) throw new HttpError(409, `that text is in #${id} ${n} times; give more of it, or all: true`);
    const next = body.all ? src.split(old).join(neu) : src.replace(old, () => neu);
    return step(id, next, { note: body.note, who: by(body.by || 'odie') });
  }
  /** Watch the table: a save of any working copy is a step; a save of a way redraws that way. */
  let watcher = null;
  function watch() {
    const timers = new Map();
    try {
      fss.mkdirSync(root, { recursive: true });
      // unref: the watcher alone must not keep a process alive (the server keeps itself up; a test can now exit).
      watcher = fss.watch(root, { recursive: true }, (_e, name) => {
        const m = /^(\d+)[\\/](work\.(?:html|md)|way-\d+-([a-z])\.html)$/.exec(String(name || '')); if (!m) return;
        clearTimeout(timers.get(m[0]));
        timers.set(m[0], setTimeout(async () => {
          timers.delete(m[0]);
          try {
            if (m[3]) return onChange({ what: 'way', id: Number(m[1]), k: m[3] });
            const c = await read(m[1]); const content = await fs.readFile(workOf(c), 'utf8');
            if (content && content !== synced.get(Number(c.id))) await step(c.id, content);
          } catch {}
        }, 120));
      }).unref();
    } catch {}
    ids().then(async all => { for (const id of all) { try { await syncWork(await read(id)); } catch {} } }).catch(() => {});
  }

  async function versionFile(id, v) {
    const c = await read(id);
    const n = Number(v) || c.v;
    if (!c.versions?.some(x => x.v === n)) throw new HttpError(404, `no version ${v} of #${id}`);
    return { p: path.join(dirOf(id), `v${n}.${c.kind === 'mock' ? 'html' : 'md'}`), card: c, v: n };
  }
  /** A real screenshot of a mock-up version at its width, by headless Chrome, cached. */
  async function shot(id, { v, h, base }) {
    const c = await read(id);
    if (c.kind !== 'mock') throw new HttpError(400, 'only mock-ups are shot');
    const n = Number(v) || c.v, H = Math.min(8000, Math.max(200, Math.round(Number(h) || 900)));
    if (!c.versions?.some(x => x.v === n)) throw new HttpError(404, `no version ${v} of #${id}`);
    const out = path.join(dirOf(id), `shot-v${n}.png`), meta = out + '.json';
    try { const m = JSON.parse(await fs.readFile(meta, 'utf8')); if (m.w === c.w && m.h === H && fss.existsSync(out)) return { p: out, w: c.w, h: H }; } catch {}
    const chrome = cfg.den.chrome || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const prof = path.join(dataDir, 'shot-profile');
    await chromeRun(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${prof}`, `--window-size=${c.w},${H}`, '--virtual-time-budget=4000', `--screenshot=${out}`, `${base}/api/den/cards/${id}/v/${n}`], 30000, 'the screenshot');
    await fs.writeFile(meta, JSON.stringify({ w: c.w, h: H, at: now() }));
    return { p: out, w: c.w, h: H };
  }
  async function filePath(id, which) {
    const c = await read(id);
    if (which === 'page') { const p = path.join(dirOf(id), 'page.png'); if (!fss.existsSync(p)) throw new HttpError(404, 'not captured yet'); return { p, mime: 'image/png' }; }
    if (!c.file) throw new HttpError(404, 'this card has no picture or file');
    return { p: path.join(dirOf(id), c.file.path), mime: c.file.mime, name: c.file.name };
  }

  // ---------- marks ----------
  // rect: { x, y, w, h } in the card's own units (design px for a mock-up or page, 0..1 of the picture otherwise;
  // for words, 0..1 of the rendered text column). phrase: the words under it, when known. v: the version it was made on.
  async function addMark(id, body = {}) {
    const c = await read(id);
    if (!MARK_KINDS.includes(body.kind)) throw new HttpError(400, `kind is one of ${MARK_KINDS.join(', ')}`);
    const who = by(body.by);
    let rect = rectOf(body.rect);
    if (!rect && body.phrase && (c.kind === 'page' || c.kind === 'picture' || c.kind === 'drop')) {
      const f = await findPhrase(c, body.phrase);
      if (!f) throw new HttpError(404, `I can't find "${body.phrase}" in #${id}`);
      const W = c.w || c.ocr?.w || 1, H = c.h || c.ocr?.h || 1;
      rect = c.kind === 'page' ? { x: f.x, y: f.y, w: f.x2 - f.x, h: f.y2 - f.y } : { x: f.x / W, y: f.y / H, w: (f.x2 - f.x) / W, h: (f.y2 - f.y) / H };
    }
    if (!rect && !body.phrase) throw new HttpError(400, 'a rect or a phrase is needed');
    const n = c.marks.reduce((m, x) => Math.max(m, x.n), 0) + 1;
    const mark = { n, kind: body.kind, by: who, at: now(), rect, phrase: body.phrase ? clip(body.phrase, 500) : null, note: body.note ? clip(body.note, 4000) : null,
      color: ['blue', 'red', 'green', 'yellow'].includes(body.color) ? body.color : null, v: c.v || null, points: Array.isArray(body.points) ? body.points.slice(0, 2000) : null, reply: null, fb: null };
    if (body.snip) { const f = `mark-${n}.png`; await fs.writeFile(path.join(dirOf(id), f), Buffer.from(String(body.snip), 'base64')); mark.snip = f; }
    c.marks.push(mark);
    if (who === 'hunter') c.touched = false;
    await write(c, { what: 'mark', who, n, kind: mark.kind, note: mark.note, phrase: mark.phrase, way: mark.way });
    return mark;
  }
  const rectOf = r => (r && [r.x, r.y, r.w, r.h].every(v => Number.isFinite(+v)) ? { x: +r.x, y: +r.y, w: +r.w, h: +r.h } : null);
  async function editMark(id, n, body = {}) {
    const c = await read(id);
    const m = c.marks.find(x => String(x.n) === String(n));
    if (!m) throw new HttpError(404, `no mark ${n} on #${id}`);
    const who = by(body.by);
    let ev = null;
    if ('note' in body) { m.note = body.note ? clip(body.note, 4000) : null; ev = { what: 'note', who, n: m.n, note: m.note }; }
    if (rectOf(body.rect)) m.rect = rectOf(body.rect);
    if (typeof body.reply === 'string' && body.reply.trim()) { m.reply = { by: who, at: now(), text: clip(body.reply.trim(), 40000) }; m.fb = null; for (const a of c.asks) if (!a.answered) a.answered = now(); ev = { what: 'reply', who, n: m.n }; }
    if (body.fb === 'confused' || body.fb === 'good' || body.fb === null) { m.fb = body.fb; ev = { what: body.fb === 'confused' ? 'confused' : 'feedback', who: 'hunter', n: m.n, fb: body.fb }; if (body.fb === 'confused') c.touched = false; }
    if (body.done === true) { m.done = now(); ev = { what: 'done', who, n: m.n }; }
    await write(c, ev);
    return m;
  }
  async function removeMark(id, n, who) {
    const c = await read(id);
    const m = c.marks.find(x => String(x.n) === String(n));
    if (!m) throw new HttpError(404, `no mark ${n} on #${id}`);
    c.marks = c.marks.filter(x => x !== m);
    await write(c, { what: 'unmark', who: by(who), n: m.n });
    return { ok: true };
  }

  // ---------- says and asks ----------
  // ---------- notes on a card (Nov 17, his pick): a "what this is" line I keep current, and dated notes from either of us.
  // They're for catching up, his and mine: a fresh me reads them and knows what the thing is. Nothing here wakes me;
  // a note of his rides along with his next send, as it reads then (edited is the edit, deleted is nothing).
  const numberNotes = c => { let top = Math.max(0, ...c.says.map(x => x.n || 0)); for (const x of c.says) if (!x.n) x.n = ++top; return c; };
  async function say(id, body = {}) {
    const c = numberNotes(await read(id));
    const text = String(body.text || body.body || '').trim();
    if (!text) throw new HttpError(400, 'text is needed');
    const who = by(body.by);
    c.says.push({ n: Math.max(0, ...c.says.map(x => x.n)) + 1, by: who, at: now(), text: clip(text, 60000) });
    if (who === 'odie') { c.touched = true; for (const a of c.asks) if (!a.answered) a.answered = now(); }
    await write(c, { what: 'say', who, n: c.says.at(-1).n, text: clip(text, 500) });
    return c.says.at(-1);
  }
  /** Change a note's words. Each of us edits our own. */
  async function editSay(id, n, body = {}) {
    const c = numberNotes(await read(id)); const who = by(body.by);
    const x = c.says.find(y => y.n === Number(n)); if (!x) throw new HttpError(404, `no note ${n} on #${id}`);
    if (x.by !== who) throw new HttpError(403, 'that note is not yours to change');
    const text = String(body.text || '').trim(); if (!text) throw new HttpError(400, 'text is needed');
    x.text = clip(text, 60000); x.edited = now();
    await write(c, { what: 'say', who, n: x.n, text: clip(text, 500), edited: true });
    return x;
  }
  async function removeSay(id, n, who) {
    const c = numberNotes(await read(id)); who = by(who);
    const x = c.says.find(y => y.n === Number(n)); if (!x) throw new HttpError(404, `no note ${n} on #${id}`);
    if (x.by !== who) throw new HttpError(403, 'that note is not yours to take off');
    c.says = c.says.filter(y => y !== x);
    await write(c, null);
    return { ok: true };
  }
  /** Notes of his that still stand, as they read now: one line per note, however many times he edited it. */
  async function standing(list) {
    const out = [], seen = new Set();
    for (const e of list.slice().reverse()) {
      if (e.what !== 'say') { out.unshift(e); continue; }
      const k = e.card + ':' + e.n; if (seen.has(k)) continue; seen.add(k);
      let x = null; try { x = (await read(e.card)).says.find(y => y.n === e.n && y.by === 'hunter'); } catch {}
      if (x) out.unshift({ ...e, text: clip(x.text, 500) });
    }
    return out;
  }
  /** His one tap on a card: look, or a handoff (to the Exchange, to Vera, keep it, settle it). It wakes me. */
  async function ask(id, body = {}) {
    const c = await read(id);
    const kind = ['look', 'exchange', 'vera', 'keep', 'settle'].includes(body.kind) ? body.kind : 'look';
    const text = clip(body.text, 2000).trim();
    c.asks.push({ kind, text: text || null, at: now(), answered: null });
    c.touched = false;
    await write(c, { what: kind === 'look' ? 'look' : 'handoff', who: 'hunter', kind, text: text || undefined, open: c.marks.filter(m => m.by === 'hunter' && !m.reply).map(m => m.n) });
    return c.asks.at(-1);
  }
  /** Keep: write the card's words or page to its home file. */
  async function keep(id, body = {}) {
    const c = await read(id);
    const home = body.home ? clip(body.home, 500) : c.home;
    if (!home) throw new HttpError(400, `#${id} has no home file yet`);
    if (!(c.kind === 'text' || c.kind === 'mock')) throw new HttpError(400, 'only words and mock-ups can be kept to a file');
    const src = c.kind === 'mock' ? await fs.readFile(path.join(dirOf(id), `v${c.v}.html`), 'utf8') : c.body;
    await fs.mkdir(path.dirname(home), { recursive: true });
    await fs.writeFile(home, src);
    c.home = home; c.kept = { v: c.v, at: now(), by: by(body.by) };
    await write(c, { what: 'keep', who: by(body.by), home, v: c.v });
    return { ok: true, home, v: c.v };
  }

  // ---------- the glass ----------
  // A mark made on the glass over the Den: the page is the one that knows which card sits under those screen pixels,
  // so I hand it to the page and wait a moment for it to place the mark. If no page claims it, it lands as a drop.
  async function fromGlass(body = {}) {
    const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const pending = { token, screen: body.screenRect, words: body.words || null, note: body.note || null, color: body.color || null, kind: MARK_KINDS.includes(body.kind) ? body.kind : 'box', snip: body.snip || null, points: body.points || null, from: body.from || null, at: now() };
    const placed = new Promise(resolve => { const t = setTimeout(() => { claims.delete(token); resolve(null); }, Number(body.waitMs) || 3000); claims.set(token, r => { clearTimeout(t); claims.delete(token); resolve(r); }); });
    onChange({ what: 'place', pending: { ...pending, snip: undefined } });
    const r = await placed;
    if (r) return { placed: true, ...r };
    const card = await create({ kind: 'drop', note: pending.note, words: pending.words, from: pending.from, data: pending.snip, mime: 'image/png', name: 'snip.png', by: 'hunter' });
    return { placed: false, card: card.id };
  }
  /** The page says: that pending mark sits on card N, here, on version v. */
  async function place(body = {}) {
    const claim = claims.get(body.token);
    if (!claim) throw new HttpError(410, 'that mark was already placed or landed as a drop');
    const pend = { snip: null };
    const mark = await addMark(body.card, { kind: body.kind || 'box', rect: body.rect, phrase: body.phrase || body.words || null, note: body.note || null, color: body.color || null, by: 'hunter', snip: body.snip || undefined, points: body.points || null, way: body.way });
    claim({ card: Number(body.card), n: mark.n });
    return { ok: true, card: Number(body.card), n: mark.n };
  }
  /** Where is card N on his screen right now? The page answers. */
  function where(id, ms = 1500) {
    const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    return new Promise(resolve => {
      const t = setTimeout(() => { wheres.delete(token); resolve(null); }, ms);
      wheres.set(token, r => { clearTimeout(t); wheres.delete(token); resolve(r); });
      onChange({ what: 'where', id: Number(id), token });
    });
  }
  /** What in the Den sits at this spot on his screen (a glass mark)? The open page answers. */
  function at(screen, ms = 1500) {
    const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    return new Promise(resolve => {
      const t = setTimeout(() => { wheres.delete(token); resolve(null); }, ms);
      wheres.set(token, r => { clearTimeout(t); wheres.delete(token); resolve(r); });
      onChange({ what: 'at', token, screen });
    });
  }
  /** Ask the open Den page something and wait for its answer (Nov 16): where words are on his screen, go full screen, what's showing. */
  function askPage(ask, data = {}, ms = 6000) {   // a page busy drawing big mock-ups can take a few seconds to answer
    const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    return new Promise(resolve => {
      const t = setTimeout(() => { wheres.delete(token); resolve(null); }, ms);
      wheres.set(token, r => { clearTimeout(t); wheres.delete(token); resolve(r); });
      onChange({ what: 'ask', ask, token, ...data });
    });
  }
  function whereReply(body = {}) { const w = wheres.get(body.token); if (!w) return { ok: false }; w(body); return { ok: true }; }

  watch();
  function emit(ev) { onChange(ev); }
  // Let go of the table folder when the server closes: on Windows a watched folder can't be deleted (the Den test hung on its cleanup).
  function close() { try { watcher?.close(); } catch {} watcher = null; }
  return { close, emit, askPage, bench, setBench, setLayout, startJob, endJob, send, outbox, edit, step, workOf, root, dirOf, list, everything, read, create, update, remove, addVersion, showVersion, versionFile, shot, filePath, capture, findPhrase, addMark, editMark, removeMark, say, editSay, removeSay, ask, keep, hold, compare, hand, presence, readPresence, news, events, waitForAsk, fromGlass, place, where, at, whereReply, summary };
}

/** A mark in words, for `den.js look`. */
export function describe(m, c) {
  const r = m.rect;
  const at = r ? (c.kind === 'mock' || c.kind === 'page' ? `at ${Math.round(r.x)},${Math.round(r.y)} (${Math.round(r.w)}×${Math.round(r.h)} px)` : `at ${Math.round(r.x * 100)}% across, ${Math.round(r.y * 100)}% down (${Math.round(r.w * 100)}% × ${Math.round(r.h * 100)}%)`) : 'nowhere yet';
  const on = m.phrase ? ` on "${m.phrase}"` : '';
  return `${m.kind}${m.way ? ` on way ${m.way.toUpperCase()}` : ''}${on} ${at}${m.v ? `, v${m.v}` : ''}${m.color ? `, ${m.color}` : ''}`;
}
