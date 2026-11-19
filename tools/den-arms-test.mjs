// Every arm I have in the Den, tried for real on scratch cards, then cleaned up. Run after any change to den.js, the Den's server or its page:
//   node tools/den-arms-test.mjs            (the arms that need his Den showing are skipped, and said so, when it's closed or behind a window)
// It makes two scratch cards, uses them, and removes them. The work area, layout and focus go back the way they were.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), den = path.join(here, 'den.js');
const CONF = (() => { try { return JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8')); } catch { return {}; } })();
const BASE = process.env.DEN_URL || 'http://127.0.0.1:' + (CONF.port || 7950);
const B = BASE + '/api/den';
const GLASS = CONF.glass ? path.join(CONF.glass, 'tools', 'glass.js') : '';
const get = async p => (await fetch(B + p)).json();
const post = (p, body) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const run = (...a) => { const r = spawnSync(process.execPath, [den, ...a], { encoding: 'utf8', timeout: 90000 }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0, skips = 0;
const ok = (name, pass, more = '') => { if (!pass) fails++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass && more ? '\n      ' + String(more).trim().split('\n').slice(0, 4).join('\n      ') : '')); };
const skip = (name, why) => { skips++; console.log('SKIP ' + name + '  (' + why + ')'); };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'den-arms-'));
const w1 = path.join(tmp, 'a.md'), w2 = path.join(tmp, 'b.md'), ha = path.join(tmp, 'a.html'), hb = path.join(tmp, 'b.html');
fs.writeFileSync(w1, '# Arms test card\n\nThe first paragraph of the scratch card.\n\nA line about apples and pears.\n');
fs.writeFileSync(w2, '# Arms test card\n\nThe first paragraph of the scratch card.\n\nA line about plums and cherries, changed.\n');
fs.writeFileSync(ha, '<!doctype html><body style="background:#111;color:#eee;font:40px sans-serif;padding:60px"><h1>Way A</h1><p>Scratch way with words to find.</p>');
fs.writeFileSync(hb, '<!doctype html><body style="background:#221;color:#eee;font:40px sans-serif;padding:60px"><h1>Way B</h1><p>The other scratch way.</p>');

const before = await get('/');
const focusFiles = [path.join(here, '..', 'data', 'focus.json')];
const focusBefore = focusFiles.map(f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
let A = null, M = null, M2 = null;
try {
  let r = run('put', 'words', 'Arms test (scratch)', w1); A = Number((/#(\d+)/.exec(r.out) || [])[1]);
  ok('put words makes a card and shows it', r.code === 0 && A > 0 && (await get('/')).bench.includes(A), r.out);
  r = run('look', String(A)); ok('look reads the card back', /apples and pears/.test(r.out), r.out);
  r = run('say', String(A), 'My line on the card'); ok('say puts my line on it', r.code === 0 && (await get('/')).cards.find(c => c.id === A).say?.text === 'My line on the card', r.out);
  r = run('say', String(A), 'A second note'); ok('a second say adds a note, it does not replace the first', (await get('/')).cards.find(c => c.id === A).notes === 2, r.out);
  r = run('about', String(A), 'A scratch card for the arms test'); ok('about says what the card is', (await get('/')).cards.find(c => c.id === A).about === 'A scratch card for the arms test', r.out);
  r = run('look', String(A)); ok('look shows what it is and the notes, numbered', /## What this is\nA scratch card/.test(r.out) && /note 2, mine/.test(r.out), r.out);
  r = run('unsay', String(A), '2'); ok('unsay takes off a note of mine', (await get('/')).cards.find(c => c.id === A).notes === 1, r.out);
  r = run('yours', String(A), 'Tell me if this works'); ok('yours marks it waiting on him', (await get('/')).cards.find(c => c.id === A).waiting === 'Tell me if this works', r.out);
  run('yours', String(A), 'off'); ok('yours off clears it', !(await get('/')).cards.find(c => c.id === A).waiting);
  r = run('title', String(A), 'Arms test (scratch, renamed)'); ok('title renames', (await get('/')).cards.find(c => c.id === A).title === 'Arms test (scratch, renamed)', r.out);
  r = run('version', String(A), w2, 'pears to plums'); ok('version posts the next version', (await get('/cards/' + A)).v === 2 && /plums/.test((await get('/cards/' + A)).body), r.out);
  r = run('edit', String(A), 'plums and cherries', 'plums, cherries and figs'); ok('edit changes it in place', /figs/.test((await get('/cards/' + A)).body), r.out);

  r = run('options', 'Arms test options (scratch)', ha, hb, '--names', 'One|Two', '--w', '1280'); [M, M2] = [...r.out.matchAll(/#(\d+)/g)].map(m => Number(m[1]));
  { const d0 = await get('/'); ok('options puts each one out as its own window', r.code === 0 && M > 0 && M2 > 0 && d0.bench[0] === M && d0.bench[1] === M2 && d0.cards.find(c => c.id === M2)?.kind === 'mock', r.out); }
  r = run('ways', String(A), ha); ok('the old ways command says it is gone', r.code !== 0 && /gone/.test(r.out), r.out);

  const other = before.cards.find(c => c.state !== 'retired' && c.kind === 'text' && c.id !== A);
  r = run('show', String(A), String(other.id), '--layout', 'main', '70', '--focus', 'Arms test', '--only');
  let d = await get('/'); ok('show puts them out, arranged, as the focus', d.bench.join() === [A, other.id].join() && d.layout?.shape === 'main' && d.layout.split === 0.7 && JSON.parse(fs.readFileSync(focusFiles[0], 'utf8')).cards.join() === [A, other.id].join(), r.out);
  r = run('show', String(M2)); d = await get('/'); ok('show adds beside what is out, newest first', d.bench.join() === [M2, A, other.id].join(), r.out);
  await post('/bench', { items: [A, other.id], by: 'odie' });
  r = run('layout', 'row', '30', '70'); d = await get('/'); ok('layout row by share', d.layout.shape === 'row' && d.layout.cols.join() === '30,70', r.out);
  r = run('layout', 'grid', '40'); d = await get('/'); ok('layout grid with a split', d.layout.shape === 'grid' && d.layout.split === 0.4, r.out);
  r = run('layout'); ok('layout says what it is', /grid, left 40%/.test(r.out), r.out);
  r = run('layout', 'reset'); ok('layout reset', (await get('/')).layout === null, r.out);
  r = run('bench', 'add', String(M)); ok('bench add', (await get('/')).bench.includes(M), r.out);
  r = run('move', String(M), 'first'); ok('move reorders', (await get('/')).bench[0] === M, r.out);
  r = run('bench', 'off', String(M)); ok('bench off', !(await get('/')).bench.includes(M), r.out);
  r = run('focus', String(A), 'Only the scratch card'); ok('focus names what we are on', JSON.parse(fs.readFileSync(focusFiles[0], 'utf8')).cards.join() === String(A), r.out);
  r = run('status'); ok('status says it all in one go', /The Den window:/.test(r.out) && /Out in the work area/.test(r.out) && /Focus: "Only the scratch card"/.test(r.out) && /Waiting for their next send/.test(r.out), r.out);
  r = run('bench'); ok('bench says what is out', /Out in the work area/.test(r.out), r.out);
  r = run('asks'); ok('asks says it is gone', r.code !== 0 && /gone/.test(r.out), r.out);
  r = run('news', '--peek'); ok('news answers', r.code === 0, r.out);
  const pic = path.join(tmp, 'see.png'); r = run('see', pic); ok('see takes a real picture', fs.existsSync(pic) && fs.statSync(pic).size > 20000, r.out);

  const live = await post('/ask-page', { ask: 'state' });
  if (!live.ok) for (const n of ['mark boxes words on their screen', 'reveal scrolls to words', 'big puts a card full screen', 'at says what is at a spot', 'point circles a card']) skip(n, 'his Den is closed or behind another window');
  else {
    for (let i = 0; i < 20; i++) { const l = await post('/ask-page', { ask: 'locate', id: A, text: 'plums, cherries and figs', glow: false }); if (l.ok) break; await sleep(500); }
    r = run('reveal', String(A), 'plums, cherries and figs'); ok('reveal scrolls to words', r.code === 0, r.out);
    const loc = await post('/ask-page', { ask: 'locate', id: A, text: 'plums, cherries and figs', glow: false });
    ok('the page finds words and says where they are on their screen', loc.ok && loc.screen.x2 > loc.screen.x1 && loc.screen.y2 > loc.screen.y1, JSON.stringify(loc));
    if (loc.ok) { const s = loc.screen; r = run('at', String(s.x1 + 4), String(s.y1 + 2), String(s.x2 - 4), String(s.y2 - 2)); ok('at agrees: that spot is the scratch card', new RegExp('#' + A + '\\b').test(r.out), r.out); }
    r = run('mark', String(A), 'plums, cherries and figs', 'Arms test: this box is mine'); const mk = /on the glass \(#(\d+)\)/.exec(r.out);
    if (/No glass is linked/.test(r.out)) skip('mark boxes the words with the glass', 'no glass is linked; the words were found and lit'); else if (/away from the PC/.test(r.out)) skip('mark boxes the words with the glass', 'they are away from the PC, so the glass holds my boxes; the words were found: ' + (/is in front of him at[^·]+/.exec(r.out) || [''])[0].trim()); else ok('mark finds the words and boxes them with the glass, one step', r.code === 0 && !!mk, r.out);
    if (mk) spawnSync(process.execPath, [GLASS, 'clear', mk[1]], { encoding: 'utf8' });
    r = run('mark', String(A), 'words that are not there'); ok('mark says so when the words are not on the card', r.code !== 0 && /not marked/.test(r.out), r.out);
    r = run('big', String(A)); ok('big puts it full screen', r.code === 0 && (await post('/ask-page', { ask: 'state' })).big === A, r.out);
    r = run('big', 'off'); ok('big off returns', (await post('/ask-page', { ask: 'state' })).big === null, r.out);
    r = run('point', String(A)); const pk = /on the glass \(#(\d+)\)/.exec(r.out); (/no glass is linked/.test(r.out) ? () => skip('point circles the card with the glass', 'no glass is linked') : ok)('point finds the whole card on their screen', r.code === 0 && /circled/.test(r.out), r.out); if (pk) spawnSync(process.execPath, [GLASS, 'clear', pk[1]], { encoding: 'utf8' });
  }

  r = run('settle', String(A), 'test'); ok('settle', (await get('/')).cards.find(c => c.id === A).state === 'settled', r.out);
  r = run('away', String(A), String(M)); d = await get('/'); ok('away puts several away at once', d.cards.find(c => c.id === A).state === 'retired' && d.cards.find(c => c.id === M).state === 'retired', r.out);
  r = run('reopen', String(A)); ok('reopen brings one back', (await get('/')).cards.find(c => c.id === A).state === 'open', r.out);
  r = run('hold', '3'); ok('an old command says it is gone and what to use', r.code !== 0 && /older Den/.test(r.out), r.out);
} catch (e) { fails++; console.log('FAIL the test itself broke: ' + e.message); }
finally {
  for (const id of [A, M, M2]) if (id) run('remove', String(id));
  const after = await get('/'); const gone = ![A, M, M2].some(id => id && after.cards.find(c => c.id === id));
  await post('/bench', { items: before.bench, by: 'odie' }); await post('/bench/layout', { layout: before.layout || { shape: 'reset' }, by: 'odie' });
  focusFiles.forEach((f, i) => { if (focusBefore[i] == null) fs.rmSync(f, { force: true }); else fs.writeFileSync(f, focusBefore[i]); });
  ok('remove takes the scratch cards off, and the table is back as it was', gone && (await get('/')).bench.join() === before.bench.join());
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(fails ? `\n${fails} FAILED` : `\nall arms work${skips ? ` (${skips} skipped: they need his Den showing)` : ''}`);
process.exitCode = fails ? 1 : 0;
