#!/usr/bin/env node
// My hands in the Den (Nov 8). Everything I do here lands on the person's screen live, at full size.
//
// LOOKING AFTER IT: start [--open] · stop · restart · open · doctor · link <glass folder> · line · hook · hello
//
// THE WORK AREA (Nov 12): what's out, in order. One fills it, two sit side by side, a third sits under them, four make a grid.
//   node tools/den.js bench                                      what's out right now, and what waits on me
//   node tools/den.js bench A B [C D]                            put exactly these out  ·  bench add N  ·  bench off N  ·  bench clear
//   node tools/den.js move N first|left|right|last                reorder what's out
//   node tools/den.js see [out.png]                              a real 1920x1080 picture of the Den as they see it (then Read it); never touches his screen
//   node tools/den.js at x1 y1 x2 y2                             what in the Den is at that spot on his screen (the glass watch asks this for every mark he makes over the Den)
//   node tools/den.js merge A B "<title>" <file.html|.md|.png> ["what I took from each"]   a new card made from two, shown under them
//   node tools/den.js imagine "<prompt>" [--from N]... [--title t | --onto N] [--ref file]... [--size 16:9]
//                                                                make a picture right here: --from uses those cards as references (a mock-up goes in as its screenshot),
//                                                                --onto N makes it the next version of picture N (he can step back), else a new card. He sees "the AI is working".
//   node tools/den.js change N <file.png> ["what changed"]       a changed picture: the next version of the same card (pictures step back and forward like mock-ups)
//   node tools/den.js working "<what>" [--card N]  ·  working off <id>     show him a job I'm in the middle of
//   node tools/den.js yours N "<what I need from you>"  ·  yours N off     mark a card as waiting on them (counts in "Waiting on you")
//   node tools/den.js asks                                       what he sent me with Send to the AI that I haven't finished
//   node tools/den.js did <n> "<what I did>"                     close one of their asks; he sees it by the Ask the AI to row
//
//   node tools/den.js now "<what I'm doing>" [--card N]           my one line at the top
//   node tools/den.js hold N ["why"]                             show card N (what I'm holding); `hold off` lets go
//   node tools/den.js compare A B                                two cards side by side; `compare off`
//   node tools/den.js look [N]                                   the table, or one card whole (marks in words, their asks, files to Read)
//   node tools/den.js news [--peek]                              what he did since I last looked
//   node tools/den.js put mock "<title>" <file.html> [--w 1280] [--note "<why>"] [--home <path>] [--with N]
//   node tools/den.js put words "<title>" <file.md|-> [--note ..] [--home <path>]
//   node tools/den.js put picture "<title>" <file>  ·  put file <file>  ·  put chart "<title>" <file.json>
//   node tools/den.js put page <url> [--w 1280] ["title"]        capture a web page onto the table (then its words are readable)
//   node tools/den.js put voice <dumpId>                         a voice dump: his audio and its words
//   node tools/den.js version N <file.html|file.md|-> ["what changed"]   the next version, in the same card, shown
//   node tools/den.js work N                                     where card N's working copy is. I edit that file with my own tools (Edit, a script):
//                                                                every save is a step, and the card changes in place on his screen, glowing where I touched it
//   node tools/den.js edit N "old" "new" ["what changed"] [--all]    the same, by find-and-replace (--old-file / --new-file for long text)
//   node tools/den.js undo N                                     back one step (he has ↶ ↷ on the card too)
//   node tools/den.js ways N|new[:"title"] a.html b.html [c.html d.html] [--names "Compact|Roomy"] [--w 1280] [--note ..]
//                                                                two to four live mock-ups side by side, before I build any. Their files are way-<round>-<a..d>.html
//                                                                beside the working copy; saving one redraws it in place. He taps 'use this one', or I pick/merge.
//   node tools/den.js pick N a  ·  ways N off                    that way becomes the card's next version  ·  clear them
//   node tools/den.js type N < words                             my words landing live as I write; `version` makes them real
//   node tools/den.js box|circle|underline N "phrase" ["note"] [--color green|red|yellow]   my mark on the words (found in the card)
//   node tools/den.js box N --at x,y,w,h ["note"]                 my mark by position (design px for a mock/page, 0..1 otherwise)
//   node tools/den.js answer N <mark> "text" | --file <f>        my answer under his mark
//   node tools/den.js done N <mark>                              his mark is handled (after a version answered it)
//   node tools/den.js say N "text" | --file <f>                   a note of mine on the whole card
//   node tools/den.js point N ["note"]                           circle card N on his real screen with the glass
//   node tools/den.js settle N ["why"] · retire N · reopen N · title N "<t>" · home N <path> · keep N [<path>]
//   node tools/den.js remove N                                   off the table (kept under data/den/removed)
//   node tools/den.js wait [--min 20]                            block until he asks/marks/drops, then print it (run in the background)
//
// If the Den is down it says so, and a failure exits 1.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Where the Den is: config.json's port, or DEN_URL.
// A broken config.json stops everything with a plain message: falling back to the default port reached the wrong program (cold test 1).
let PORT = 7950, CONF_BROKEN = null; const CONF_FILE = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([a-z]):/i, '$1:')), '..', 'config.json');
try { if (fs.existsSync(CONF_FILE)) PORT = JSON.parse(fs.readFileSync(CONF_FILE, 'utf8')).port || PORT; } catch (e) { CONF_BROKEN = e.message; }
const BASE = process.env.DEN_URL || 'http://127.0.0.1:' + PORT;
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([a-z]):/i, '$1:'));
const args = process.argv.slice(2);
const cmd = args.shift();
const ADMIN = ['start', 'stop', 'restart', 'doctor', 'link', 'open', 'hello', 'line', 'hook'];
const flag = (name, takes = true) => { const i = args.indexOf(name); if (i < 0) return null; const v = takes ? args[i + 1] : true; args.splice(i, takes ? 2 : 1); return v; };
const readArg = v => (v === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(v, 'utf8'));

async function api(url, { method = 'GET', body, timeout = 20000 } = {}) {
  const r = await fetch(BASE + '/api/den' + url, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
  const t = await r.text(); let b; try { b = JSON.parse(t); } catch { b = t; }
  if (!r.ok) throw new Error(b?.error || `${r.status} ${t}`);
  return b;
}
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf', '.csv': 'text/csv', '.md': 'text/markdown', '.txt': 'text/plain' };
const presence = (doing, card) => api('/presence', { method: 'POST', body: { doing, card }, timeout: 3000 }).catch(() => {});

function line(e) {
  const t = `#${e.card}${e.title ? ` "${e.title}"` : ''}`;
  switch (e.what) {
    case 'drop': return `DROPPED ${t} from the glass (${e.kind})`;
    case 'bring': return `brought ${t} (${e.kind})`;
    case 'mark': return `marked ${t}: mark ${e.n} (${e.kind})${e.phrase ? ` on "${e.phrase}"` : ''}${e.note ? `: "${e.note}"` : ''}`;
    case 'note': return `wrote on mark ${e.n} of ${t}: "${e.note || ''}"`;
    case 'unmark': return `removed mark ${e.n} from ${t}`;
    case 'look': return `tapped LOOK AT THIS on ${t}${e.open?.length ? ` (their unanswered marks: ${e.open.join(', ')})` : ''}`;
    case 'handoff': return `asked me to ${{ exchange: 'take it to the Exchange', vera: "ask Vera's opinion", keep: 'keep it to its file', settle: 'settle it' }[e.kind] || e.kind}: ${t}${e.text ? ` ("${e.text}")` : ''}`;
    case 'version': return `posted version ${e.v} of ${t}${e.note ? ` ("${e.note}")` : ''}`;
    case 'confused': return `was CONFUSED by my answer on mark ${e.n} of ${t}: answer it again, clearer`;
    case 'feedback': return `marked my answer on mark ${e.n} of ${t} ${e.fb === 'good' ? 'GOOD PUSHBACK' : '(cleared)'}`;
    case 'send': return 'pressed SEND:' + sendLines(e);
    case 'pick': return `PICKED way ${String(e.k).toUpperCase()}${e.name ? ` "${e.name}"` : ''} on ${t}: it is now the card's working copy${e.text ? `. HIS WORDS WITH IT: "${e.text}"` : ''}`;
    case 'ways': return e.n ? `put ${e.n} ways on ${t}` : `cleared the ways on ${t}`;
    case 'step': return `changed ${t} in place (step ${e.v})`;
    case 'pin': return `pinned ${t} (he's looking at it, not following me)`;
    case 'unpin': return `let go of his pin (following me again)`;
    case 'edit': return `edited ${t} (${(e.fields || []).join(', ')})`;
    case 'settled': return `SETTLED ${t}${e.why ? `: ${e.why}` : ''}`;
    case 'retired': return `put away ${t}`;
    case 'open': return `reopened ${t}`;
    case 'say': return `said on ${t}: "${e.text || ''}"`;
    case 'remove': return `removed ${t}`;
    default: return `${e.what} on ${t}`;
  }
}

const ASK = { pictures: 'MAKE PICTURES', mock: 'BUILD A MOCK-UP', ways: 'SHOW ME WAYS', words: 'WRITE IT UP', change: 'CHANGE THIS', merge: 'MERGE THESE TWO', page: 'BRING A PAGE', say: 'SAID' };
function sendLines(e) {
  const out = [];
  for (const a of e.asks || []) out.push(`\n  ask ${a.n} · ${ASK[a.kind] || a.kind}${a.cards?.length ? ' · about ' + a.cards.map(c => '#' + c).join(' and ') : ''}${a.text ? `: "${a.text}"` : ''}`);
  for (const d of e.did || []) out.push(`\n  before that he ${d.what === 'pick' ? `PICKED way ${String(d.k).toUpperCase()}${d.name ? ' "' + d.name + '"' : ''} on #${d.card}${d.text ? ` ("${d.text}")` : ''}` : d.what === 'drop' ? `dropped #${d.card} "${d.title}" from the glass` : `brought #${d.card} "${d.title}"`}`);
  if (e.bench?.length) out.push(`\n  out in the work area: ${e.bench.map(c => '#' + c).join(', ')}`);
  return out.join('') + '\n  Close each ask when done: den.js did <n> "what I did"';
}
const NODE = process.execPath;
const run = (cmdline, args, opt = {}) => new Promise(resolve => { const p = spawn(cmdline, args, { windowsHide: true, ...opt }); let o = ''; p.stdout?.on('data', d => o += d); p.stderr?.on('data', d => o += d); p.on('close', c => resolve({ c, o })); p.on('error', e => resolve({ c: 1, o: String(e) })); });
/** A card as a picture file on disk (for a reference): its picture, its captured page, or a screenshot of its mock-up. */
async function fileOf(id, tmp) {
  const c = await api('/cards/' + id); const dir = path.join((await api('')).dir, 'table', String(c.id));
  if (c.file && /^image\//.test(c.file.mime)) return path.join(dir, c.file.path);
  if (c.kind === 'page' && c.captured) return path.join(dir, 'page.png');
  if (c.kind === 'mock') { const out = path.join(tmp, `den-${c.id}.png`); const b = Buffer.from(await (await fetch(`${BASE}/api/den/cards/${c.id}/shot?h=1080`)).arrayBuffer()); fs.writeFileSync(out, b); return out; }
  throw new Error(`#${id} is a ${c.kind}; it has no picture to go from`);
}
async function benchLine() {
  const d = await api(''); const name = i => { const c = d.cards.find(x => x.id === i); return `#${i} ${c ? c.kind + ' "' + c.title + '"' : ''}`; };
  const L = [d.bench.length ? `Out in the work area (${['', 'one, full size', 'two side by side', 'two on top, one under', 'a grid of four'][d.bench.length]}): ${d.bench.map(name).join(' · ')}` : 'The work area is empty.'];
  const w = d.cards.filter(c => c.waiting && c.state !== 'retired'); if (w.length) L.push('Waiting on them: ' + w.map(c => `#${c.id} (${c.waiting})`).join(' · '));
  if (d.jobs.length) L.push('I\'m shown working on: ' + d.jobs.map(j => `[${j.id}] ${j.what}`).join(' · '));
  if (d.outbox.waiting.length || d.outbox.did.length) L.push(`They have ${d.outbox.waiting.length + d.outbox.did.length} thing(s) waiting that they haven't sent yet (not mine to read until they press Send).`);
  const open = d.outbox.sent.filter(a => !a.done); if (open.length) L.push('Their asks I haven\'t closed: ' + open.map(a => `${a.n} ${ASK[a.kind] || a.kind}`).join(' · ') + ' (den.js asks)');
  return L.join('\n');
}

async function look(id) {
  if (!id) {
    const d = await api('');
    const h = d.hand || {};
    const out = [`The table (${d.cards.length} card${d.cards.length === 1 ? '' : 's'})${h.odie ? ` · I'm holding #${h.odie}` : ''}${h.pinned ? ` · he pinned #${h.pinned}` : ''}${h.compare ? ` · comparing ${h.compare.map(x => '#' + x).join(' and ')}` : ''}`];
    if (d.presence) out.push(`My line: "${d.presence.doing}" (${d.presence.at})`);
    for (const c of d.cards) out.push(`- #${c.id} ${c.kind} "${c.title}"${c.versions > 1 ? ` v${c.v}/${c.versions}` : ''} · ${c.marks} mark${c.marks === 1 ? '' : 's'}${c.open ? ` (${c.open} of their unanswered)` : ''}${!c.touched && c.by === 'hunter' ? ' · NEW, untouched by me' : ''}${c.state !== 'open' ? ` · ${c.state}` : ''} · by ${c.by} · ${c.updated}${c.from ? ` · from ${c.from.app}${c.from.title ? ' "' + c.from.title + '"' : ''}` : ''}${c.excerpt ? `\n    "${c.excerpt.replace(/\s+/g, ' ').slice(0, 160)}"` : ''}`);
    if (!d.cards.length) out.push('- nothing yet');
    return out.join('\n');
  }
  const c = await api('/cards/' + id);
  const dir = path.join((await api('')).dir, 'table', String(c.id));
  const L = [`# #${c.id} ${c.title}`, `${c.kind} · by ${c.by} · ${c.state} · updated ${c.updated}${c.home ? ` · home: ${c.home}` : ''}${c.with ? ` · with #${c.with}` : ''}`, ''];
  if (c.kind === 'mock' || c.kind === 'text') L.push(`working copy: ${path.join(dir, c.kind === 'mock' ? 'work.html' : 'work.md')} (edit it and the card changes in place)`);
  if (c.ways) L.push(`WAYS showing (round ${c.ways.round}): ${c.ways.list.map(w => `${w.k.toUpperCase()}${w.name ? ' "' + w.name + '"' : ''} = ${path.join(dir, `way-${c.ways.round}-${w.k}.html`)}`).join(' · ')}`);
  if (c.kind === 'mock') L.push(`versions: ${c.versions.map(x => `v${x.v}${x.v === c.v ? ' (showing)' : ''} by ${x.by}${x.note ? ` "${x.note}"` : ''}`).join(', ')}`, `width ${c.w}px · page: ${path.join(dir, `v${c.v}.html`)} · a screenshot: GET ${BASE}/api/den/cards/${c.id}/shot`, '');
  if (c.kind === 'text') { L.push(`versions: ${c.versions.map(x => `v${x.v}${x.v === c.v ? ' (showing)' : ''} by ${x.by}${x.note ? ` "${x.note}"` : ''}`).join(', ')}`, '', '## The words', c.body, ''); }
  if (c.kind === 'drop' || c.kind === 'picture') { L.push(`## The picture`, c.file ? `file: ${path.join(dir, c.file.path)} (Read it)` : '(no picture)', c.from ? `from: ${c.from.app}${c.from.title ? ` · "${c.from.title}"` : ''}${c.from.url ? ` · ${c.from.url}` : ''}` : '', ''); if (c.note) L.push('## His words', c.note, ''); if (c.words) L.push('## The words in it', c.words, ''); }
  if (c.kind === 'page') L.push(`## The page`, c.url, c.captured ? `capture: ${path.join(dir, 'page.png')} (Read it) · ${c.w}×${c.h}` : 'not captured yet', c.words ? `\n## The words on it\n${c.words.slice(0, 6000)}` : '', '');
  if (c.kind === 'voice') L.push('## The words he said', c.body || '(none yet)', `audio: ${BASE}/api/dumps/${c.dump}/audio · ${c.seconds || '?'} s`, '');
  if (c.kind === 'chart') L.push('## The chart', `${c.body.labels.length} points, ${c.body.labels[0]} to ${c.body.labels.at(-1)}; last ${c.body.values.at(-1)}`, '');
  if (c.file && c.kind === 'file') L.push(`## The file`, path.join(dir, c.file.path), '');
  L.push('## Marks');
  if (!c.marks.length) L.push('- none');
  for (const m of c.marks) L.push(`- mark ${m.n} (${m.by === 'odie' ? 'mine' : 'HIS'}): ${m.said}${m.note ? ` — "${m.note}"` : ''}${m.snip ? ` · his crop: ${path.join(dir, m.snip)}` : ''}${m.reply ? `\n  I answered: ${m.reply.text.replace(/\n/g, ' ').slice(0, 300)}${m.fb === 'confused' ? '\n  HE WAS CONFUSED: answer again, clearer' : m.fb === 'good' ? '\n  he marked it GOOD PUSHBACK' : ''}` : m.by === 'hunter' && !m.done ? `\n  not answered yet (den.js answer ${c.id} ${m.n} "..." or a new version, then den.js done ${c.id} ${m.n})` : ''}`);
  const talk = [...c.asks.map(a => ({ at: a.at, s: `- he ${a.kind === 'look' ? 'tapped look at this' : 'asked: ' + a.kind}${a.text ? ` "${a.text}"` : ''} (${a.at}${a.answered ? ', answered' : ', OPEN'})` })), ...c.says.map(s => ({ at: s.at, s: `- ${s.by === 'odie' ? 'I' : 'he'} said (${s.at}): ${s.text.slice(0, 400)}` }))].sort((a, b) => a.at.localeCompare(b.at));
  L.push('', '## Asks and says', ...(talk.length ? talk.map(t => t.s) : ['- quiet so far']));
  return L.join('\n');
}

async function put(kind, a, { w, note, home, withId }) {
  const base = { by: 'odie', note, home, with: withId };
  if (kind === 'mock') { const [title, file] = a; return api('/cards', { method: 'POST', body: { ...base, kind: 'mock', title, html: readArg(file), w: w ? Number(w) : undefined } }); }
  if (kind === 'words' || kind === 'text') { const [title, file] = a; return api('/cards', { method: 'POST', body: { ...base, kind: 'text', title, body: readArg(file || '-') } }); }
  if (kind === 'picture' || kind === 'image') { const [title, file] = a; const f = file || title; const data = fs.readFileSync(f).toString('base64'); return api('/cards', { method: 'POST', body: { ...base, kind: 'picture', title: file ? title : '', name: path.basename(f), mime: MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', data } }); }
  if (kind === 'file') { const f = a[0]; return api('/cards', { method: 'POST', body: { ...base, kind: 'file', title: path.basename(f), name: path.basename(f), mime: MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', data: fs.readFileSync(f).toString('base64') } }); }
  if (kind === 'chart') { const [title, file] = a; return api('/cards', { method: 'POST', body: { ...base, kind: 'chart', title, body: JSON.parse(readArg(file)) } }); }
  if (kind === 'page') { const [url, title] = a; return api('/cards', { method: 'POST', body: { ...base, kind: 'page', url, title: title || '', w: w ? Number(w) : undefined } }); }
  if (kind === 'voice') {
    const id = a[0]; const d = await fetch(`${BASE}/api/dumps/${id}`).then(r => r.json());
    return api('/cards', { method: 'POST', body: { ...base, kind: 'voice', title: d.title || `Voice ${id}`, dump: id, body: d.text || '', seconds: d.seconds } });
  }
  throw new Error(`put what? mock, words, picture, file, chart, page or voice (not "${kind}")`);
}

/** Circle card N on his real screen: ask the page where it is, then the glass draws there. */
async function point(id, note) {
  const r = await api('/where/' + id);
  if (!r.where) return console.log(`the Den isn't showing #${id} on screen right now (den.js hold ${id} first, or he has the Den closed)`);
  const s = r.where.screen, glass = (await import('./admin.mjs')).glassTool(); if (!glass) { console.log('no glass is linked (den.js link <glass folder>)'); return; }
  const node = process.env.NODE_EXE || process.execPath;
  const res = await new Promise(resolve => { const p = spawn(node, [glass, 'box', String(s.x1 - 6), String(s.y1 - 6), String(s.x2 + 6), String(s.y2 + 6), ...(note ? [note] : [])], { stdio: ['ignore', 'pipe', 'pipe'] }); let o = ''; p.stdout.on('data', d => o += d); p.stderr.on('data', d => o += d); p.on('close', c => resolve({ c, o: o.trim() })); });
  console.log(`circled #${id} on his screen (${r.where.on}: ${s.x1},${s.y1}–${s.x2},${s.y2})${res.o ? ' · ' + res.o : ''}`);
}

async function main() {
  // hello is a start-of-chat hook: it always exits 0, or its warning never reaches the chat (cold test 2).
  if (CONF_BROKEN && cmd !== 'doctor') { console.log(`${cmd === 'hello' ? 'The Den: ' : ''}config.json is broken (${CONF_BROKEN}). Fix it (write paths with forward slashes), then start the Den again.`); if (cmd !== 'hello') process.exitCode = 1; return; }
  if (ADMIN.includes(cmd)) return (await import('./admin.mjs')).run(cmd, args, { BASE, here });
  // Only ever work on this folder's Den: another copy on the same port is not ours to change (cold test 1).
  if (cmd) { const h = await fetch(BASE + '/api/health', { signal: AbortSignal.timeout(2500) }).then(r => r.json()).catch(() => null);
    if (!h && cmd === 'see') { console.log('The Den is not running. Start it: node tools/den.js start'); process.exitCode = 1; return; }
    if (h?.den && path.resolve(h.folder).toLowerCase() !== path.resolve(here, '..').toLowerCase()) { console.log(`The Den on ${BASE} is another copy (${h.folder}), not this one. Stop that one, or give this one its own "port" in config.json.`); process.exitCode = 1; return; } }
  const a = args;
  switch (cmd) {
    case 'now': { const card = flag('--card'); const p = await api('/presence', { method: 'POST', body: { doing: a[0], card } }); console.log(`my line: ${p.doing}`); break; }
    case 'hold': { if (a[0] === 'off') { await api('/hold', { method: 'POST', body: { id: null, by: 'odie' } }); console.log('let go'); break; } const h = await api('/hold', { method: 'POST', body: { id: Number(a[0]), by: 'odie', note: a[1] } }); console.log(`holding #${h.odie}${h.pinned ? ` (he has #${h.pinned} pinned, so he sees that one)` : ''}`); break; }
    case 'compare': { if (a[0] === 'off') { await api('/hold', { method: 'POST', body: { compare: null, by: 'odie' } }); console.log('one at a time'); break; } await api('/hold', { method: 'POST', body: { compare: a.map(Number), by: 'odie' } }); console.log(`comparing ${a.map(x => '#' + x).join(' and ')}`); break; }
    case 'look': console.log(await look(a[0])); if (!a[0]) console.log('\n' + await benchLine()); break;
    case 'bench': {
      const d = await api(''); let items = d.bench;
      if (a[0] === 'add') items = [...items.filter(i => i !== Number(a[1])), Number(a[1])].slice(-4);
      else if (a[0] === 'off') items = items.filter(i => i !== Number(a[1]));
      else if (a[0] === 'clear') items = [];
      else if (a.length) items = a.map(Number);
      if (a.length) await api('/bench', { method: 'POST', body: { items, by: 'odie' } });
      console.log(await benchLine()); break; }
    case 'move': {
      const d = await api(''); const items = d.bench.slice(), n = Number(a[0]), i = items.indexOf(n);
      if (i < 0) { console.log(`#${n} isn't out (den.js bench add ${n})`); break; }
      items.splice(i, 1); const to = { first: 0, last: items.length, left: Math.max(0, i - 1), right: Math.min(items.length, i + 1) }[a[1]] ?? 0; items.splice(to, 0, n);
      await api('/bench', { method: 'POST', body: { items, by: 'odie' } }); console.log(await benchLine()); break; }
    case 'see': {
      const out = path.resolve(a[0] || path.join(process.env.TEMP || '.', 'den-see.png'));
      fs.rmSync(out, { force: true }); // never report an old picture as this one (the public Den's cold test, Nov 13)
      const chrome = (await fetch(BASE + '/api/health').then(r => r.json()).catch(() => ({}))).chrome || 'chrome', prof = path.join(process.env.TEMP || '.', 'den-see-profile');
      await run(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${prof}`, '--window-size=1920,1080', '--virtual-time-budget=7000', `--screenshot=${out}`, `${BASE}/den/${flag('--page') || ''}?see=1`], { timeout: 45000 });
      console.log(fs.existsSync(out) ? `the Den as they see it (1920x1080): ${out}` : 'the picture failed'); if (!fs.existsSync(out)) process.exitCode = 1; break; }
    case 'at': { const r = await api(`/at?x1=${a[0]}&y1=${a[1]}&x2=${a[2]}&y2=${a[3]}`); console.log(r.say || 'nothing of the Den is there (or the Den is not open)'); break; }
    case 'merge': {
      const [A, B, title, file, note] = a; const ext = path.extname(file).toLowerCase();
      const base = { by: 'odie', title, note, parents: [Number(A), Number(B)] };
      const body = ext === '.html' ? { ...base, kind: 'mock', html: readArg(file), w: flag('--w') ? Number(flag('--w')) : 1920 } : ext === '.md' ? { ...base, kind: 'text', body: readArg(file) } : { ...base, kind: 'picture', name: path.basename(file), mime: MIME[ext] || 'image/png', data: fs.readFileSync(file).toString('base64') };
      const c = await api('/cards', { method: 'POST', body });
      if (note) await api(`/cards/${c.id}/say`, { method: 'POST', body: { text: note, by: 'odie' } }).catch(() => {});
      await api('/bench', { method: 'POST', body: { items: [Number(A), Number(B), c.id], by: 'odie' } });
      console.log(`#${c.id} "${c.title}" is made from #${A} and #${B}, and sits under them`); break; }
    case 'imagine': {
      const from = [], onto = flag('--onto'), title = flag('--title'), size = flag('--size') || '16:9', account = flag('--account'); let x; while ((x = flag('--from'))) from.push(Number(x)); const extraRefs = []; while ((x = flag('--ref'))) extraRefs.push(x);
      const prompt = a[0]; if (!prompt) { console.log('imagine "<prompt>" [--from N]... [--title t | --onto N]'); break; }
      fs.mkdirSync(path.join(here, '..', 'data', 'images'), { recursive: true }); const tmp = fs.mkdtempSync(path.join(here, '..', 'data', 'images', 'den-')), out = path.join(tmp, 'out.png');
      const job = await api('/jobs', { method: 'POST', body: { what: onto ? `changing the picture on #${onto}` : `a picture: ${title || prompt.slice(0, 60)}`, card: onto || from[0] || null } }).catch(() => null);
      try {
        const refs = []; for (const r of extraRefs) refs.push('--ref', path.resolve(r)); for (const id of [...(onto ? [Number(onto)] : []), ...from]) refs.push('--ref', await fileOf(id, tmp));
        const r = await run(NODE, [path.join(here, 'imagine.mjs'), prompt, '--out', out, '--size', size, ...refs]);
        if (!fs.existsSync(out)) { console.log('no picture came back: ' + r.o.trim().split('\n').slice(-2).join(' ')); break; }
        const data = fs.readFileSync(out).toString('base64');
        if (onto) { const c = await api(`/cards/${onto}/versions`, { method: 'POST', body: { data, mime: 'image/png', note: prompt.slice(0, 300), by: 'odie' }, timeout: 60000 }); console.log(`#${onto} is now at change ${c.v} of ${c.versions.length} (Read ${out}; den.js undo ${onto} steps back)`); }
        else { const c = await api('/cards', { method: 'POST', body: { kind: 'picture', title: title || prompt.slice(0, 60), name: 'made.png', mime: 'image/png', data, by: 'odie', parents: from.length > 1 ? from : undefined }, timeout: 60000 }); const d = await api(''); await api('/bench', { method: 'POST', body: { items: from.length ? [...from.slice(0, 3), c.id] : [...d.bench.slice(-3), c.id], by: 'odie' } }); console.log(`#${c.id} picture "${c.title}" is on the table and out (Read ${out})`); }
      } finally { if (job) await api('/jobs/' + job.id, { method: 'DELETE' }).catch(() => {}); }
      break; }
    case 'change': { const id = Number(a[0]), file = a[1]; const c = await api(`/cards/${id}/versions`, { method: 'POST', body: { data: fs.readFileSync(file).toString('base64'), mime: MIME[path.extname(file).toLowerCase()] || 'image/png', note: a[2], by: 'odie' }, timeout: 60000 }); console.log(`#${id} is now at change ${c.v} of ${c.versions.length}`); break; }
    case 'working': { if (a[0] === 'off') { await api('/jobs/' + a[1], { method: 'DELETE' }); console.log('done showing'); break; } const j = await api('/jobs', { method: 'POST', body: { what: a[0], card: flag('--card') } }); console.log(`showing "${j.what}" as job ${j.id} (den.js working off ${j.id} when done)`); break; }
    case 'yours': { await api(`/cards/${a[0]}`, { method: 'PATCH', body: { waiting: a[1] === 'off' ? null : a[1], by: 'odie' } }); console.log(a[1] === 'off' ? `#${a[0]} no longer waits on them` : `#${a[0]} waits on them: ${a[1]}`); break; }
    case 'asks': { const list = (await api('/asks')).filter(x => !x.done); if (!list.length) { console.log('nothing of his is open'); break; } for (const x of list) console.log(`ask ${x.n} · ${ASK[x.kind] || x.kind}${x.cards?.length ? ' · about ' + x.cards.map(c => '#' + c).join(' and ') : ''}${x.text ? `: "${x.text}"` : ''} (sent ${x.sentAt})`); break; }
    case 'did': { await api(`/asks/${a[0]}/did`, { method: 'POST', body: { text: a[1] } }); console.log(`ask ${a[0]} closed`); break; }
    case 'news': { const n = await api('/news' + (flag('--peek', false) ? '?peek=1' : '')); if (!n.events.length) console.log('nothing new from them in the Den'); else { console.log('Since I last looked, the person:'); for (const e of n.events) console.log('- ' + line(e)); } break; }
    case 'put': { const opts = { w: flag('--w'), note: flag('--note'), home: flag('--home'), withId: flag('--with') }; const c = await put(a[0], a.slice(1), opts); await api('/hold', { method: 'POST', body: { id: c.id, by: 'odie' } }).catch(() => {}); console.log(`#${c.id} ${c.kind} "${c.title}" is on the table and showing${c.kind === 'page' ? ' (capturing…)' : ''}`); break; }
    case 'version': { const id = Number(a[0]), f = a[1], note = a[2]; const c = await api('/cards/' + id); const body = c.kind === 'mock' ? { html: readArg(f), note, by: 'odie', w: flag('--w') ? Number(flag('--w')) : undefined } : { body: readArg(f), note, by: 'odie' }; const r = await api(`/cards/${id}/versions`, { method: 'POST', body }); await api(`/cards/${id}/draft`, { method: 'POST', body: { text: '', done: true } }).catch(() => {}); console.log(`v${r.v} of #${id} is showing`); break; }
    case 'work': { const c = await api('/cards/' + a[0]); const dir = path.join((await api('')).dir, 'table', String(c.id)); if (c.kind !== 'mock' && c.kind !== 'text') { console.log(`#${c.id} is a ${c.kind}; only mock-ups and words can be worked on in place yet`); break; } console.log(path.join(dir, c.kind === 'mock' ? 'work.html' : 'work.md')); if (c.ways) for (const w of c.ways.list) console.log(`way ${w.k.toUpperCase()}: ${path.join(dir, `way-${c.ways.round}-${w.k}.html`)}`); break; }
    case 'edit': { const id = Number(a[0]); const all = flag('--all', false), of = flag('--old-file'), nf = flag('--new-file'); const old = of ? readArg(of) : a[1], neu = nf ? readArg(nf) : a[of ? 1 : 2], note = a[(of ? 1 : 2) + (nf ? 0 : 1)]; const c = await api(`/cards/${id}/edit`, { method: 'POST', body: { old, new: neu, all: !!all, note, by: 'odie' } }); console.log(`#${id} changed in place (step ${c.v} of ${c.versions.length})`); break; }
    case 'undo': { const c = await api('/cards/' + a[0]); const i = c.versions.findIndex(x => x.v === c.v); if (i < 1) { console.log(`#${c.id} is at its first version`); break; } await api(`/cards/${c.id}/version`, { method: 'PATCH', body: { v: c.versions[i - 1].v, by: 'odie' } }); console.log(`#${c.id} back to step ${i} of ${c.versions.length}`); break; }
    case 'ways': { const names = (flag('--names') || '').split('|'), w = flag('--w'), note = flag('--note'); if (a[1] === 'off') { await api(`/cards/${a[0]}/ways`, { method: 'DELETE' }); console.log(`#${a[0]}: ways cleared`); break; } const ways = a.slice(1).map((f, i) => ({ name: (names[i] || '').trim() || path.basename(f).replace(/.html?$/, ''), html: readArg(f) })); let c; if (/^new/.test(a[0])) { c = await api('/cards', { method: 'POST', body: { kind: 'mock', title: a[0].slice(4), ways, w: w ? Number(w) : undefined, note, by: 'odie' } }); await api('/hold', { method: 'POST', body: { id: c.id, by: 'odie' } }).catch(() => {}); } else c = await api(`/cards/${a[0]}/ways`, { method: 'POST', body: { ways, note, by: 'odie' } }); console.log(`#${c.id}: ${c.ways.list.length} ways side by side (${c.ways.list.map(x => x.k.toUpperCase() + (x.name ? ' ' + x.name : '')).join(' · ')})`); break; }
    case 'pick': { const c = await api(`/cards/${a[0]}/pick`, { method: 'POST', body: { k: a[1], by: 'odie' } }); console.log(`#${c.id}: way ${String(a[1]).toUpperCase()} is now the working copy (v${c.v})`); break; }
    case 'type': { const id = Number(a[0]); let text = ''; process.stdin.setEncoding('utf8'); for await (const chunk of process.stdin) { text += chunk; await api(`/cards/${id}/draft`, { method: 'POST', body: { text } }).catch(() => {}); } await api(`/cards/${id}/draft`, { method: 'POST', body: { text, done: false } }); console.log(`${text.length} characters showing as my draft on #${id} (den.js version ${id} - to make them real)`); break; }
    case 'box': case 'circle': case 'underline': {
      const id = Number(a[0]); const at = flag('--at'), color = flag('--color'); let phrase = null, note = null, rect = null;
      if (at) { const [x, y, w, h] = at.split(',').map(Number); rect = { x, y, w, h }; note = a[1]; } else { phrase = a[1]; note = a[2]; }
      const m = await api(`/cards/${id}/marks`, { method: 'POST', body: { kind: cmd, rect, phrase, note, color, by: 'odie' } });
      console.log(`mark ${m.n} on #${id}: ${cmd}${phrase ? ` on "${phrase}"` : ''}${m.rect ? ` at ${Math.round(m.rect.x)},${Math.round(m.rect.y)}` : ' (the page finds the words when it draws)'}`); break; }
    case 'answer': { const id = Number(a[0]), n = Number(a[1]); const f = flag('--file'); const text = f ? readArg(f) : a[2]; await api(`/cards/${id}/marks/${n}`, { method: 'PATCH', body: { reply: text, by: 'odie' } }); await presence(`answered your mark ${n}`, id); console.log(`answered mark ${n} on #${id}`); break; }
    case 'done': { await api(`/cards/${a[0]}/marks/${a[1]}`, { method: 'PATCH', body: { done: true, by: 'odie' } }); console.log(`mark ${a[1]} on #${a[0]} is handled`); break; }
    case 'say': { const id = Number(a[0]); const f = flag('--file'); await api(`/cards/${id}/say`, { method: 'POST', body: { text: f ? readArg(f) : a[1], by: 'odie' } }); console.log(`said on #${id}`); break; }
    case 'point': await point(Number(a[0]), a[1]); break;
    case 'settle': await api(`/cards/${a[0]}`, { method: 'PATCH', body: { state: 'settled', why: a[1], by: 'odie' } }); console.log(`#${a[0]} settled`); break;
    case 'retire': await api(`/cards/${a[0]}`, { method: 'PATCH', body: { state: 'retired', by: 'odie' } }); console.log(`#${a[0]} put away`); break;
    case 'reopen': await api(`/cards/${a[0]}`, { method: 'PATCH', body: { state: 'open', by: 'odie' } }); console.log(`#${a[0]} open again`); break;
    case 'title': await api(`/cards/${a[0]}`, { method: 'PATCH', body: { title: a[1], by: 'odie' } }); console.log(`#${a[0]} is now "${a[1]}"`); break;
    case 'home': await api(`/cards/${a[0]}`, { method: 'PATCH', body: { home: a[1], by: 'odie' } }); console.log(`#${a[0]} keeps to ${a[1]}`); break;
    case 'keep': { const r = await api(`/cards/${a[0]}/keep`, { method: 'POST', body: { home: a[1], by: 'odie' } }); console.log(`#${a[0]} v${r.v} written to ${r.home}`); break; }
    case 'touch': await api(`/cards/${a[0]}`, { method: 'PATCH', body: { touched: true, by: 'odie' } }); console.log(`#${a[0]} touched`); break;
    case 'remove': { const r = await api(`/cards/${a[0]}`, { method: 'DELETE' }); console.log(`#${a[0]} off the table (kept at ${r.keptAt})`); break; }
    case 'capture': { const c = await api(`/cards/${a[0]}/capture`, { method: 'POST', timeout: 60000 }); console.log(`captured #${c.id}: ${c.w}×${c.h}, ${c.words ? c.words.split('\n').length + ' lines of words' : 'no words read'}`); break; }
    case 'wait': {
      const min = Number(flag('--min') || 20);
      // Asked in four-minute pieces: Node drops a request that hears nothing for five minutes, which used to end this watch early and call the Den dark.
      let r = { ask: null }; const until = Date.now() + min * 60000;
      while (!r.ask && Date.now() < until) r = await api(`/wait?ms=${Math.min(240000, Math.max(1000, until - Date.now()))}`, { timeout: 260000 });
      if (!r.ask) { console.log(`nothing from them in the Den for ${min} min`); break; }
      console.log(r.ask.what === 'send' ? `IN THE DEN, THEY ${line(r.ask)}` : `THEY ${line(r.ask).toUpperCase()}\nLook before answering: node tools/den.js look ${r.ask.card}\nThen start this watch again: node tools/den.js wait --min ${min}`);
      break;
    }
    default: console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
  }
}
main().catch(e => { process.exitCode = 1; console.log(/fetch failed|ECONNREFUSED|timeout/i.test(String(e.message)) ? 'The Den is not running. Start it: node tools/den.js start' : `Den: ${e.message}`); });
