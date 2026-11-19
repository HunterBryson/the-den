// The Den's API (Nov 8): the table of cards, the hand (what's showing), my presence line, marks from the
// glass, and the two small questions the page answers for me (place this mark; where is this card on screen).
//
//   GET    /api/den                          everything the page draws: cards, the hand, my line
//   GET    /api/den/cards/:id                one card whole (marks described in words)
//   POST   /api/den/cards                    a new card { kind, title?, ... } (html for a mock-up, body for words,
//                                            data+mime for a picture/file, url for a page, dump for a voice dump)
//   PATCH  /api/den/cards/:id                title, state (open|settled|retired, why), home, w, with, touched, body (words: a new version)
//   DELETE /api/den/cards/:id                off the table (kept under data/den/removed)
//   POST   /api/den/cards/:id/versions       { html | body, note }   -> the next version, shown
//   PATCH  /api/den/cards/:id/version        { v }                   -> show that version
//   POST   /api/den/cards/:id/edit           { old, new, all?, note? } -> change the working copy in place: the next step, live
//   GET    /api/den/cards/:id/v/:v           a mock-up version as a page, or words as markdown
//   GET    /api/den/cards/:id/shot?v=&h=     a real screenshot of a mock-up version (thumb=1 for small)
//   GET    /api/den/cards/:id/file           the picture or file; /page.png a captured page
//   POST   /api/den/cards/:id/marks          { kind, rect | phrase, note, color, by, v }
//   PATCH  /api/den/cards/:id/marks/:n       { note | reply | fb | rect | done }
//   DELETE /api/den/cards/:id/marks/:n
//   POST   /api/den/cards/:id/say            { text, by }
//   POST   /api/den/cards/:id/ask            { kind: look|exchange|vera|keep|settle, text }   (his tap; wakes me)
//   POST   /api/den/cards/:id/keep           { home? }   write the words/page to its home file
//   POST   /api/den/hold                     { id, by, note }   what's showing (mine), or his pin; { compare: [a,b] }
//   POST   /api/den/presence                 { doing, card }
//   POST   /api/den/glass                    a mark from the glass over the Den (or anywhere): placed on a card, or a drop
//   POST   /api/den/place                    the page: that pending mark goes on card N here
//   GET    /api/den/where/:id                where card N is on screen (the page answers within 1.5 s)
//   POST   /api/den/where                    the page's answer
//   GET    /api/den/news  · GET /api/den/wait?ms=   what he did since I looked · wait for his next ask
import { Router } from './router.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, ah } from './util.js';
import { createTable, describe } from './table.js';

export function denRoutes(cfg, hub) {
  const r = Router();
  const table = createTable(cfg, { onChange: ev => hub.send('den', ev) });
  r.table = table;
  // When I change the Den's own page, every open Den picks it up by itself.
  const pageFile = cfg.pageFile;
  fs.watchFile(pageFile, { interval: 700, persistent: false }, (a, b) => { if (a.mtimeMs !== b.mtimeMs) hub.send('den', { what: 'page' }); });
  // focus.json (what we are on) changes the left list without a reload.
  fs.watchFile(path.join(path.dirname(pageFile), 'focus.json'), { interval: 700, persistent: false }, (a, b) => { if (a.mtimeMs !== b.mtimeMs) hub.send('den', { what: 'focus' }); });

  r.get('/', ah(async (_req, res) => res.json(await table.everything())));
  r.get('/cards', ah(async (_req, res) => res.json(await table.list())));
  r.post('/cards', ah(async (req, res) => res.status(201).json(await table.create(req.body))));
  r.get('/cards/:id', ah(async (req, res) => {
    const c = await table.read(req.params.id);
    res.json({ ...c, ocr: undefined, marks: c.marks.map(m => ({ ...m, said: describe(m, c) })) });
  }));
  r.patch('/cards/:id', ah(async (req, res) => res.json(await table.update(req.params.id, req.body))));
  r.delete('/cards/:id', ah(async (req, res) => res.json(await table.remove(req.params.id, req.query.by))));

  r.post('/cards/:id/versions', ah(async (req, res) => res.status(201).json(await table.addVersion(req.params.id, req.body))));
  r.patch('/cards/:id/version', ah(async (req, res) => res.json(await table.showVersion(req.params.id, req.body?.v, req.body?.by))));
  r.get('/cards/:id/v/:v', ah(async (req, res) => {
    const f = await table.versionFile(req.params.id, req.params.v);
    res.set('Cache-Control', 'no-store').type(f.card.kind === 'mock' ? 'html' : 'text/markdown').sendFile(f.p);
  }));
  // The crafting table (Nov 9): work on a card in place. Options are separate cards, each its own window (Nov 17).
  r.post('/cards/:id/edit', ah(async (req, res) => res.json(await table.edit(req.params.id, req.body))));
  r.get('/cards/:id/shot', ah(async (req, res) => {
    const s = await table.shot(req.params.id, { v: req.query.v, h: req.query.thumb ? 720 : req.query.h, base: `http://127.0.0.1:${req.socket.localPort}` });
    res.set('Cache-Control', 'no-store').type('png').sendFile(s.p);
  }));
  r.get('/cards/:id/file', ah(async (req, res) => {
    const f = await table.filePath(req.params.id, 'file');
    res.set('Cache-Control', 'no-store').type(f.mime);
    if (req.query.download && f.name) res.attachment(f.name);
    res.sendFile(f.p);
  }));
  r.get('/cards/:id/page.png', ah(async (req, res) => { const f = await table.filePath(req.params.id, 'page'); res.set('Cache-Control', 'no-store').type('png').sendFile(f.p); }));
  r.get('/cards/:id/mark/:n.png', ah(async (req, res) => {
    const c = await table.read(req.params.id); const m = c.marks.find(x => String(x.n) === req.params.n);
    if (!m?.snip) throw new HttpError(404, 'no picture for that mark');
    res.set('Cache-Control', 'no-store').type('png').sendFile(`${table.dirOf(c.id)}/${m.snip}`);
  }));
  r.post('/cards/:id/capture', ah(async (req, res) => res.json(await table.capture(req.params.id))));

  r.post('/cards/:id/marks', ah(async (req, res) => res.status(201).json(await table.addMark(req.params.id, req.body))));
  r.patch('/cards/:id/marks/:n', ah(async (req, res) => res.json(await table.editMark(req.params.id, req.params.n, req.body))));
  r.delete('/cards/:id/marks/:n', ah(async (req, res) => res.json(await table.removeMark(req.params.id, req.params.n, req.query.by))));
  r.post('/cards/:id/say', ah(async (req, res) => res.status(201).json(await table.say(req.params.id, req.body))));
  r.patch('/cards/:id/says/:n', ah(async (req, res) => res.json(await table.editSay(req.params.id, req.params.n, req.body))));
  r.delete('/cards/:id/says/:n', ah(async (req, res) => res.json(await table.removeSay(req.params.id, req.params.n, req.query.by))));
  r.post('/cards/:id/ask', ah(async (req, res) => res.status(201).json(await table.ask(req.params.id, req.body))));
  // My words landing live while I write them: not saved, just shown, until a version lands.
  r.post('/cards/:id/draft', ah(async (req, res) => { await table.read(req.params.id); hub.send('den', { what: 'draft', id: Number(req.params.id), text: String(req.body?.text ?? '').slice(0, 400000), done: !!req.body?.done }); res.json({ ok: true }); }));
  r.post('/cards/:id/keep', ah(async (req, res) => res.json(await table.keep(req.params.id, req.body))));
  r.get('/cards/:id/find', ah(async (req, res) => res.json({ hit: await table.findPhrase(await table.read(req.params.id), String(req.query.q || '')) })));

  r.post('/hold', ah(async (req, res) => {
    if (Array.isArray(req.body?.compare) || req.body?.compare === null) return res.json(await table.compare(req.body.compare, req.body.by));
    res.json(await table.hold(req.body?.id ?? null, req.body?.by, req.body?.note));
  }));
  // The new Den (Nov 12): the work area and my jobs.
  r.post('/bench', ah(async (req, res) => res.json(await table.setBench(req.body?.items, req.body?.by))));
  r.post('/bench/layout', ah(async (req, res) => res.json(await table.setLayout(req.body?.layout ?? null, req.body?.by))));
  r.post('/jobs', ah(async (req, res) => res.status(201).json(table.startJob(req.body))));
  r.delete('/jobs/:id', ah(async (req, res) => res.json(table.endJob(req.params.id))));
  // His one send (Nov 17): the glass card's ➤ calls this; files he added and glass drops since the last one ride along.
  r.post('/send', ah(async (req, res) => res.json(await table.send())));
  // POST /api/den/reveal { card, text }: scroll that card to those words on his screen and light them (Nov 13)
  // den tie (Nov 14): the glass asks the page to tie a mark to the words under a screen point; the page reports where they are.
  r.post('/tie', ah(async (req, res) => { const b = req.body || {}; table.emit({ what: 'tie', key: String(b.key), port: Number(b.port) || 7931, x: Number(b.x), y: Number(b.y) }); res.json({ ok: true }); }));
  r.post('/tiepos', ah(async (req, res) => {
    const port = [7931, 7941].includes(Number(req.body?.port)) ? Number(req.body.port) : 7931;
    try { const j = await fetch(`http://127.0.0.1:${port}/den-pos`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ list: req.body?.list || [] }), signal: AbortSignal.timeout(1500) }).then(x => x.json()); res.json({ ok: true, drop: j.drop || [] }); }
    catch { res.json({ ok: false, drop: [] }); }
  }));
  r.post('/reveal', ah(async (req, res) => {
    const card = Number(req.body?.card) || null, text = String(req.body?.text || '').slice(0, 400);
    if (!card || !text) return res.status(400).json({ error: 'card and text are required' });
    table.emit({ what: 'reveal', id: card, text });
    res.status(201).json({ ok: true, card, text });
  }));
  r.post('/presence', ah(async (req, res) => {
    // The hook sends the file I'm on; a file under table/<n>/ means I'm on that card.
    const m = /[\\/]table[\\/](\d+)[\\/]/.exec(String(req.body?.path || ''));
    res.status(201).json(await table.presence(req.body?.doing, req.body?.card || (m ? Number(m[1]) : null)));
  }));

  r.post('/glass', ah(async (req, res) => res.json(await table.fromGlass(req.body))));
  r.post('/place', ah(async (req, res) => res.json(await table.place(req.body))));
  r.get('/where/:id', ah(async (req, res) => res.json({ id: Number(req.params.id), where: await table.where(req.params.id) })));
  r.get('/at', ah(async (req, res) => { const n = k => Number(req.query[k]); const a = await table.at({ x1: n('x1'), y1: n('y1'), x2: n('x2'), y2: n('y2') }); res.json(a ? { ...a, token: undefined } : { on: null }); }));
  r.post('/where', ah(async (req, res) => res.json(table.whereReply(req.body))));
  // My arms: ask the page that's open on his screen. No answer means no Den is showing (closed, or behind another window).
  r.post('/ask-page', ah(async (req, res) => { const { ask, ...data } = req.body || {}; const a = await table.askPage(String(ask || ''), data); res.json(a ? { ...a, token: undefined } : { ok: false, why: 'no Den page answered' }); }));

  r.get('/news', ah(async (req, res) => res.json(await table.news({ advance: req.query.peek !== '1' }))));
  r.get('/wait', ah(async (req, res) => {
    const ms = Math.min(25 * 60_000, Math.max(1000, Number(req.query.ms) || 10 * 60_000));
    req.setTimeout?.(ms + 10_000);
    res.json({ ask: await table.waitForAsk(ms) });
  }));

  r.close = () => { fs.unwatchFile(pageFile); table.close(); };
  return r;
}
