// The Den's own care: start, stop, restart, open, doctor, link, hello. Called through den.js (node tools/den.js doctor).
// Every command is quiet about being down and never fails loudly, so it can't break a chat.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(ROOT, 'config.json');
const LOG = path.join(ROOT, 'data', 'den.log');
const conf = () => { try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { return null; } };
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

async function health(BASE) {
  try { const r = await fetch(BASE + '/api/health', { signal: AbortSignal.timeout(2500) }); return r.ok ? await r.json() : { other: true }; }
  catch (e) { return /fetch failed|ECONNREFUSED|abort|timeout/i.test(String(e.cause?.code || e.message)) ? null : { other: true }; }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RUN = path.join(ROOT, 'data', 'den.run.json');

/** This folder's running Den, wherever it is: the port it wrote down when it started, or (a Den from before it wrote one down) the port in config.json.
 *  Only a Den that answers from this folder counts, so another copy is never stopped by mistake. */
export async function running(BASE) {
  let rec = null; try { rec = JSON.parse(fs.readFileSync(RUN, 'utf8')); } catch {}
  for (const base of [rec?.port && `http://127.0.0.1:${rec.port}`, BASE].filter(Boolean)) {
    const h = await health(base); if (h?.den && same(h.folder, ROOT)) return { base, port: Number(new URL(base).port), pid: h.pid };
  }
  return null;
}
/** Ask a running Den to quit, and wait until its port is free. */
async function quit(base) {
  await fetch(base + '/api/quit', { method: 'POST', signal: AbortSignal.timeout(2500) }).catch(() => {});
  for (let i = 0; i < 40 && await health(base); i++) await sleep(250);
}
/** The server, started hidden; it keeps running after this process ends. */
function spawnServer(node) {
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  const out = fs.openSync(LOG, 'a');
  const p = spawn(node, [path.join(ROOT, 'server.js')], { cwd: ROOT, detached: true, windowsHide: true, stdio: ['ignore', out, out] });
  p.unref(); fs.closeSync(out); return p;
}
/** A folder updated from the classic Den by git pull alone, whose upgrade hasn't run: the classic outbox is still there,
 *  or their settings run this Den's start-of-chat line but not its message line. */
function classicLeft() {
  try { const o = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'outbox.json'), 'utf8')); if (o.waiting || o.sent) return true; } catch {}
  try {
    const st = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'settings.json'), 'utf8'));
    const mine = path.join(ROOT, 'tools', 'den.js').split(path.sep).join('/').toLowerCase();
    const cmds = Object.values(st.hooks || {}).flat().flatMap(g => g.hooks || []).map(x => String(x.command || '').replace(/\\/g, '/').toLowerCase()).filter(c => c.includes(mine));
    return cmds.some(c => / hello\b/.test(c)) && !cmds.some(c => / pickup\b/.test(c));
  } catch { return false; }
}
const ME = `"${process.execPath.split(path.sep).join('/')}" "${path.join(ROOT, 'tools', 'den.js').split(path.sep).join('/')}"`;
const classicTip = () => classicLeft() ? `This Den was updated from the classic one and hasn't been upgraded yet. Run ${ME} upgrade once: it moves what the classic Den left over and sets up the new hooks.` : '';

/** For the hooks: start the Den in the background when it's down, and don't wait for it. A start already under way (in the last 15 s) is left to finish. */
function startQuietly() {
  const node = realNode(); if (!node || !conf()) return false;
  const lock = path.join(ROOT, 'data', 'starting');
  try { if (Date.now() - fs.statSync(lock).mtimeMs < 15000) return true; } catch {}
  try { fs.mkdirSync(path.dirname(lock), { recursive: true }); fs.writeFileSync(lock, String(Date.now())); spawnServer(node); return true; } catch { return false; }
}

/** The person's glass, if one is linked: its glass.js. */
export function glassTool() {
  const g = conf()?.glass; if (!g) return null;
  const t = path.join(g, 'tools', 'glass.js'); return fs.existsSync(t) ? t : null;
}

function realNode() {
  const n = process.execPath;
  return /node(\.exe)?$/i.test(path.basename(n)) ? n : null;
}

function findBrowser() {
  const own = conf()?.chrome; if (own && fs.existsSync(own)) return own;   // "chrome" in config.json, the same one the server uses
  const pf = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
  return pf.flatMap(p => [path.join(p, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(p, 'Microsoft', 'Edge', 'Application', 'msedge.exe')]).find(p => fs.existsSync(p)) || null;
}

export async function run(cmd, args, { BASE }) {
  if (!fs.existsSync(CONFIG) && fs.existsSync(path.join(ROOT, 'config.example.json'))) fs.copyFileSync(path.join(ROOT, 'config.example.json'), CONFIG);
  const port = (conf() || {}).port || 7950;

  const fail = msg => { console.log(msg); process.exitCode = 1; };
  if (cmd === 'start' || cmd === 'restart') {
    // Found by its folder, not by asking the port: after "port" changes in config.json, the old one is still found and stopped.
    const r = await running(BASE);
    if (r && r.port === port && cmd === 'start') { console.log(`The Den is already running at ${BASE}/`); if (args.includes('--open')) await run('open', [], { BASE }); return; }
    if (r) { await quit(r.base); if (r.port !== port) console.log(`This Den was running on port ${r.port}, and config.json now says ${port}, so I stopped the one on ${r.port}.`); }
    const h = await health(BASE);
    if (h) return fail(h.den ? `Another Den (from ${h.folder}) is on port ${port}. Stop that one, or give this one another "port" in config.json.` : `Something else is using port ${port}. Give the Den another "port" in config.json.`);
    const node = realNode(); if (!node) return fail(`This isn't plain Node (${process.execPath}). Run den.js with the real node.exe.`);
    const p = spawnServer(node); let died = false; p.on('exit', () => { died = true; });
    for (let i = 0; i < 40 && !died; i++) { await sleep(250); const h2 = await health(BASE); if (h2?.den && same(h2.folder, ROOT)) { console.log(`The Den is running at ${BASE}/`); if (classicTip() && !args.includes('--from-upgrade')) console.log(classicTip()); if (args.includes('--open')) await run('open', [], { BASE }); return; } }
    return fail(`The Den didn't come up. The end of its log:
${tail(6)}`);
  }
  if (cmd === 'stop') {
    const r = await running(BASE);
    if (!r) { const h = await health(BASE); if (h) return fail(`What's on port ${port} isn't this Den, so I left it alone.`); console.log('The Den is not running.'); return; }
    await quit(r.base);
    console.log(`The Den stopped${r.port !== port ? ` (it was on port ${r.port})` : ''}.`); return;
  }
  if (cmd === 'open') {
    const h = await health(BASE); if (!h?.den) return fail('The Den is not running. Start it: node tools/den.js start --open');
    const b = findBrowser(), url = `${BASE}/`;
    if (b) spawn(b, [`--app=${url}`, '--start-maximized', '--disable-extensions', `--user-data-dir=${path.join(ROOT, 'data', 'window')}`], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    else spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    console.log(`Opened the Den${b ? ' in its own window' : ''}: ${url}`); return;
  }
  if (cmd === 'link') {
    const g = args[0] && path.resolve(args[0]);
    if (!g || !fs.existsSync(path.join(g, 'tools', 'glass.js'))) return fail('den.js link <the glass folder>  (the folder that has tools/glass.js)');
    const c = conf() || {}; c.glass = g.split(path.sep).join('/'); fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2) + '\n');
    console.log(`Linked the glass at ${c.glass}. Next: den.js hook (it now also turns on the glass's ⤓ Den button).`); return;
  }
  if (cmd === 'hello') { // for a start-of-chat hook: one quiet line, never an error
    { const tip = classicTip(); if (tip) process.on('exit', () => console.log(tip)); }
    const h = await health(BASE), me = `"${(realNode() || process.execPath).split(path.sep).join('/')}" "${path.join(ROOT, 'tools', 'den.js').split(path.sep).join('/')}"`;
    if (h && !(h.den && same(h.folder, ROOT))) { console.log(`Something else holds the Den's port (${h.den ? 'another Den, from ' + h.folder : 'another program'}). Run ${me} doctor.`); return; }
    // Down: start it in the background and say so in a line. Nothing waits on the start, so a chat opens as fast as ever.
    if (!h) { const r = await running(BASE); if (r) { console.log(`The Den is running on port ${r.port}, but config.json says ${port}. Run ${me} restart to move it.`); return; } console.log(startQuietly() ? "The Den wasn't running, so it's starting in the background. Work you do with your person goes on the table: the-den skill has the moves." : `The Den isn't running. Start it when you need it: ${me} start`); return; }
    try {
      const d = await (await fetch(BASE + '/api/den/', { signal: AbortSignal.timeout(2500) })).json();
      const n = (d.outbox?.did || []).length;
      console.log(n ? `The Den: your person put ${n} thing${n > 1 ? 's' : ''} on the table since you last heard. Pick ${n > 1 ? 'them' : 'it'} up before you answer: ${me} pickup. The moves are in the-den skill.` : 'The Den is running. Nothing is waiting on you there. Work you do with your person goes on the table: the-den skill has the moves.');
    } catch { console.log('The Den is running.'); }
    return;
  }
  // Their message is the send. What they put on the table since you last heard (notes on cards, files, drops from the glass)
  // comes with their next chat message or glass send: a hook runs this on every message, and you can run it yourself.
  // --hook: quiet when nothing waits, fast, and never an error (a hook that fails breaks their chat).
  if (cmd === 'pickup') {
    const quiet = args.includes('--hook'), me = `"${(realNode() || process.execPath).split(path.sep).join('/')}" "${path.join(ROOT, 'tools', 'den.js').split(path.sep).join('/')}"`;
    try {
      const h = await fetch(BASE + '/api/health', { signal: AbortSignal.timeout(quiet ? 1200 : 2500) }).then(r => r.json()).catch(() => null);
      if (!h && quiet) { if (!(await running(BASE))) startQuietly(); return; }   // down: start it for next time, quietly; nothing can have waited while it was down
      if (!h?.den || !same(h.folder, ROOT)) { if (!quiet) console.log(h ? 'What answers on that port is not this Den.' : `The Den isn't running. Start it: ${me} start`); return; }
      const d = await (await fetch(BASE + '/api/den/', { signal: AbortSignal.timeout(quiet ? 1500 : 4000) })).json();
      const did = d.outbox?.did || [];
      if (!did.length) { if (!quiet) console.log('Nothing new on the table from your person since you last heard.'); return; }
      const name = x => `"${x.title || 'card ' + x.card}" (#${x.card})`;
      const L = did.map(x => x.what === 'say' ? `- left a note on ${name(x)}: "${String(x.text || '').replace(/\s+/g, ' ').slice(0, 400)}"` : x.what === 'drop' ? `- dropped ${name(x)} onto the table from the glass` : `- added ${name(x)} to the table`);
      await fetch(BASE + '/api/den/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(4000) });
      console.log(`ON THE DEN, since you last heard, your person:\n${L.join('\n')}\nThis came with their message. Look at each card before you answer (${me} look N). A note is context unless it asks something.`);
    } catch (e) { if (!quiet) { console.log(`The Den didn't answer (${e.message}).`); process.exitCode = 1; } }
    return;
  }
  // Bring the cards from another copy of the Den (an older one, say) into this one. It copies; the other copy is never changed.
  if (cmd === 'bring') {
    const from = args.find(a => !a.startsWith('--')) && path.resolve(args.find(a => !a.startsWith('--')));
    if (!from || !fs.existsSync(from)) return fail('den.js bring <the other Den folder> [--again]   (copies its cards into this Den; the other one is left exactly as it is)');
    if (same(from, ROOT)) return fail('That is this Den.');
    let oc = {}; try { oc = JSON.parse(fs.readFileSync(path.join(from, 'config.json'), 'utf8')); } catch {}
    const src = path.resolve(from, oc.table || '.', 'table'), dst = path.resolve(ROOT, conf()?.table || '.', 'table');
    if (!fs.existsSync(src)) return fail(`No cards found at ${src}.`);
    if (same(src, dst)) return fail(`Both Dens use the same table folder (${src}). Give this one its own: set "table" in config.json to "." and run this again.`);
    const has = fs.existsSync(dst) ? fs.readdirSync(dst).filter(n => /^\d+$/.test(n)) : [];
    if (has.length && !args.includes('--again')) return fail(`This Den already has ${has.length} card${has.length > 1 ? 's' : ''}. To replace them with a fresh copy from ${from}, run it with --again (this Den's cards go to table-before-bring first; nothing is deleted).`);
    const h = await health(BASE); if (h?.den && same(h.folder, ROOT)) { await fetch(BASE + '/api/quit', { method: 'POST' }).catch(() => {}); await sleep(700); }
    if (has.length) { const keep = path.join(path.dirname(dst), 'table-before-bring-' + Date.now()); fs.renameSync(dst, keep); console.log(`This Den's own cards are kept at ${keep}.`); }
    fs.cpSync(src, dst, { recursive: true });
    try { fs.rmSync(path.join(ROOT, 'data', 'focus.json'), { force: true }); } catch {}
    // The table's small state (what's out, what was done, where the last send left off) comes along, so it opens the way they left it.
    const sd = path.join(from, 'data'), dd = path.join(ROOT, 'data'); fs.mkdirSync(dd, { recursive: true });
    for (const f of ['bench.json', 'events.jsonl', 'hand.json', 'removed']) { const a = path.join(sd, f); if (fs.existsSync(a)) fs.cpSync(a, path.join(dd, f), { recursive: true }); }
    const n = fs.readdirSync(dst).filter(x => /^\d+$/.test(x)).length;
    console.log(`Copied ${n} card${n === 1 ? '' : 's'} from ${from} into this Den. The other Den is exactly as it was.${h?.den ? ' Starting this one again.' : ''}`);
    if (h?.den && same(h.folder, ROOT)) return run('start', [], { BASE });
    return;
  }
  if (cmd === 'doctor') return doctor(BASE, port);
  if (cmd === 'unhook') return unhook();
  if (cmd === 'hook') return hook(port);
  if (cmd === 'upgrade') return upgrade(BASE, port);
  if (cmd === 'line') {
    const node = (realNode() || process.execPath);
    console.log(`If you can't change your own settings, give your person this one line. They right-click Start, choose Terminal, paste it, and press Enter:\n\n& "${node}" "${path.join(ROOT, 'tools', 'den.js')}" hook\n\nIt adds a start-of-chat line so every new chat knows about the Den, and brings what they put on the table in with each message${conf()?.glass ? ", and turns on the glass's ⤓ Den button" : ''}. It keeps a copy of their settings first.`);
    return;
  }
}

/** Every chat knows the Den: a start-of-chat hook, and (with a glass linked) GLASS_DEN_URL. Merged into ~/.claude/settings.json, a copy kept. */
function hook(port) {
  const file = path.join(os.homedir(), '.claude', 'settings.json');
  let s = {}, backedUp = false;
  if (fs.existsSync(file)) {
    try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log(`${file} doesn't read as JSON (${e.message}), so I left it alone.`); process.exitCode = 1; return; }
    const back = file + '.before-den';
    if (!fs.existsSync(back) && !JSON.stringify(s).includes('den.js')) { fs.copyFileSync(file, back); backedUp = true; }
    fs.copyFileSync(file, file + '.before-den-hook');   // and every time: their settings from just before this hook
  } else fs.mkdirSync(path.dirname(file), { recursive: true });
  const node = (realNode() || process.execPath).split(path.sep).join('/');
  const tool = path.join(ROOT, 'tools', 'den.js').split(path.sep).join('/');
  s.hooks ??= {}; s.hooks.SessionStart ??= [];
  // Setup heals a move: drop any older Den hook, then add this one.
  s.hooks.SessionStart = s.hooks.SessionStart.map(g => ({ ...g, hooks: (g.hooks || []).filter(x => !/den\.js"? hello/.test(x.command || '')) })).filter(g => g.hooks.length);
  s.hooks.SessionStart.push({ hooks: [{ type: 'command', command: `"${node}" "${tool}" hello`, timeout: 5 }] });
  // Their message is the send: what they put on the table since you last heard rides in with each message they write.
  s.hooks.UserPromptSubmit ??= [];
  s.hooks.UserPromptSubmit = s.hooks.UserPromptSubmit.map(g => ({ ...g, hooks: (g.hooks || []).filter(x => !/den\.js"? pickup/.test(x.command || '')) })).filter(g => g.hooks.length);
  s.hooks.UserPromptSubmit.push({ hooks: [{ type: 'command', command: `"${node}" "${tool}" pickup --hook`, timeout: 5 }] });
  if (conf()?.glass) { s.env ??= {}; s.env.GLASS_DEN_URL = `http://127.0.0.1:${port}`; }
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
  const skilled = installSkill(node, tool);
  const home = homebaseLink(port);
  console.log(`${skilled}Every new chat now gets a line about the Den, what they put on the table comes in with each message they write${conf()?.glass ? `, and the glass knows where the Den is (restart the glass: node tools/glass.js restart in its folder)` : ''}${backedUp ? '. Their settings from before the Den are kept at ' + (file + '.before-den').split(path.sep).join('/') : ''}${fs.existsSync(file + '.before-den-hook') ? '. Their settings from just before this are at ' + (file + '.before-den-hook').split(path.sep).join('/') : ''}.${home ? '\n' + home : ''}`);
}

/** With "homebase" in config.json: the Den's entry on that Homebase's left side points at this Den's port.
 *  A Den set up beside another one, on its own port, used to leave Homebase pointing at the old one. Only the Den's entry changes; a copy of the file is kept. */
function homebaseLink(port) {
  const want = conf()?.homebase; if (!want) return '';
  let hp; try { hp = Number(new URL(want).port || 80); } catch { return `Homebase's address in config.json ("${want}") doesn't read as an address, so its Den link was left alone.`; }
  const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const kids = d => { try { return fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => path.join(d, e.name)); } catch { return []; } };
  const home = [...kids(path.dirname(ROOT)), ...kids(os.homedir())].find(d => fs.existsSync(path.join(d, 'tools', 'plug.js')) && fs.existsSync(path.join(d, 'lib', 'brain.js')) && (readJson(path.join(d, 'homebase.config.json'))?.port || 7940) === hp);
  if (!home) return `No Homebase on port ${hp} was found beside this folder or in the user folder, so its Den link was left alone.`;
  const url = `http://127.0.0.1:${port}/`, file = path.join(home, 'data', 'nav.json'), nav = readJson(file);
  const item = nav?.groups?.flatMap(g => g.items || []).find(i => (i.name || '').toLowerCase() === 'the den');
  if (item?.url === url) return `Homebase's Den link already points here (${url}).`;
  if (!item) {
    const r = spawnSync(process.execPath, [path.join(home, 'tools', 'plug.js'), 'add', 'The Den', url, '--sub', 'The table you and your AI share', '--icon', 'room'], { encoding: 'utf8', windowsHide: true });
    return r.status === 0 ? `The Den is on Homebase's left side now (${url}).` : `Homebase's Den link didn't go in: ${(r.stderr || r.stdout).trim()}`;
  }
  const was = item.url; fs.copyFileSync(file, file + '.before-den'); item.url = url;
  fs.writeFileSync(file + '.tmp', JSON.stringify(nav, null, 2)); fs.renameSync(file + '.tmp', file);
  return `Homebase's Den link pointed at ${was}; it points here now (${url}). Its list from before is kept at data/nav.json.before-den in Homebase's folder.`;
}

/** Updating a Den folder in place, from the classic Den or any older one. Run it after git pull, with the new code:
 *  what the old Den left behind is handed over, then the hook, a restart (the old server is found by its folder) and the doctor. */
async function upgrade(BASE, port) {
  const git = (...a) => spawnSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', windowsHide: true });
  const at = (git('log', '-1', '--format=%h %s').stdout || '').trim(), dirty = (git('status', '--porcelain', '--untracked-files=no').stdout || '').trim();
  console.log(`Upgrading the Den in ${ROOT.split(path.sep).join('/')}${at ? ` (now at ${at})` : ''}.`);
  if (dirty) console.log(`Files of the Den's own that were changed in this folder (keep them, or fold them back in):\n${dirty}`);
  if (!conf()) { console.log('config.json is missing or broken; fix it first (forward slashes in paths), then run upgrade again.'); process.exitCode = 1; return; }
  // 1 · The old outbox: asks they sent that nobody closed, and asks they typed and never sent. The new Den has no asks, so they're handed over here.
  const ob = path.join(ROOT, 'data', 'outbox.json'); let o = null; try { o = JSON.parse(fs.readFileSync(ob, 'utf8')); } catch {}
  if (o && (o.waiting || o.sent)) {
    const open = (o.sent || []).filter(a => !a.done), typed = o.waiting || [];
    const line = a => `  - "${String(a.text || '').replace(/\s+/g, ' ').slice(0, 300)}"${(a.cards || []).length ? ` (cards ${a.cards.map(c => '#' + c).join(' ')})` : ''}`;
    if (open.length) console.log(`They sent these in the old Den and they were never closed:\n${open.map(line).join('\n')}`);
    if (typed.length) console.log(`They typed these in the old Den and never pressed Send:\n${typed.map(line).join('\n')}`);
    const keep = ['outbox-classic.json', 'outbox-classic-' + Date.now() + '.json'].find(n => !fs.existsSync(path.join(ROOT, 'data', n)));
    fs.copyFileSync(ob, path.join(ROOT, 'data', keep));
    fs.writeFileSync(ob, JSON.stringify({ sentSeq: o.sentSeq || 0 }));
    console.log(`The old outbox is kept at data/${keep}, and the new one starts where their last send left off.${open.length || typed.length ? ' Bring those up with your person.' : ''}`);
  }
  // 2 · Ways never picked: options are separate cards now, so these stay as files beside their card.
  const tdir = path.resolve(ROOT, conf().table || '.', 'table');
  for (const n of (fs.existsSync(tdir) ? fs.readdirSync(tdir) : []).filter(x => /^\d+$/.test(x))) {
    let c; try { c = JSON.parse(fs.readFileSync(path.join(tdir, n, 'card.json'), 'utf8')); } catch { continue; }
    const ways = c.ways?.list || [];
    if (ways.length) console.log(`#${n} "${c.title}" has ${ways.length} ways that were never picked; their files are beside the card in ${path.join(tdir, n).split(path.sep).join('/')}. Options are separate cards now (den.js options), if they still matter.`);
  }
  // 3 · A classic den.js wait running in the background for this folder: stopped when its command line names this folder's den.js.
  //     One started with a relative path can't be told apart from another Den's, so it's named, and left: the new Den tells it nothing, and it ends by itself.
  const ps = spawnSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { [string]$_.ProcessId + [char]9 + $_.CommandLine }"], { encoding: 'utf8', windowsHide: true });
  const mine = path.join(ROOT, 'tools', 'den.js').split(path.sep).join('/').toLowerCase();
  for (const l of (ps.stdout || '').split(/\r?\n/)) {
    const [pid, cl = ''] = l.split('\t'), c = cl.replace(/\\/g, '/').toLowerCase();
    if (!/den\.js"?\s+wait\b/.test(c) || Number(pid) === process.pid) continue;
    if (c.includes(mine)) { spawnSync('taskkill', ['/PID', pid, '/F'], { windowsHide: true }); console.log(`Stopped the classic den.js wait that was running in the background (process ${pid}).`); }
    else console.log(`A den.js wait is running (process ${pid}: ${cl.trim().slice(0, 120)}). If it's this Den's, stop it; if not, leave it. Either way it hears nothing from this Den now and ends on its own.`);
  }
  // 4 · The hook (the new skill and the message hook), then a restart and the doctor.
  console.log('\nThe hook:'); hook(port);
  console.log('\nRestarting:'); await run('restart', ['--from-upgrade'], { BASE });
  console.log('\nThe doctor:'); await doctor(BASE, port);
  console.log(`\nIf you keep a memory block for the Den, refresh your copy from memory/the-den.md: a classic copy still speaks of Send, asks and ways.\nGoing back to the classic Den: node tools/den.js unhook, then git checkout classic, node tools/den.js hook and node tools/den.js restart. The cards stay.`);
}

/** Takes this Den's start-of-chat and message lines out of ~/.claude/settings.json (and its GLASS_DEN_URL), leaving every other line. A copy is kept first. */
function unhook() {
  const file = path.join(os.homedir(), '.claude', 'settings.json');
  if (!fs.existsSync(file)) { console.log('There are no Claude settings to change.'); return; }
  let s; try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log(`${file} doesn't read as JSON (${e.message}), so I left it alone.`); process.exitCode = 1; return; }
  const mine = path.join(ROOT, 'tools', 'den.js').split(path.sep).join('/').toLowerCase();
  let n = 0;
  for (const ev of ['SessionStart', 'UserPromptSubmit']) {
    if (!s.hooks?.[ev]) continue;
    s.hooks[ev] = s.hooks[ev].map(g => ({ ...g, hooks: (g.hooks || []).filter(x => { const hit = String(x.command || '').replace(/\\/g, '/').toLowerCase().includes(mine); if (hit) n++; return !hit; }) })).filter(g => g.hooks.length);
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
  if (s.env?.GLASS_DEN_URL === `http://127.0.0.1:${(conf() || {}).port || 7950}`) { delete s.env.GLASS_DEN_URL; n++; }
  if (!n) { console.log('Nothing from this Den is in your settings.'); return; }
  fs.copyFileSync(file, file + '.before-unhook');
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
  console.log(`Took this Den's ${n} line${n > 1 ? 's' : ''} out of ${file.split(path.sep).join('/')} (a copy is at settings.json.before-unhook). Everything else is as it was.`);
}

/** The Den skill, into ~/.claude/skills/the-den, so its moves reach every chat in any folder, not only chats opened here. */
function installSkill(node, tool) {
  try {
    const tmpl = fs.readFileSync(path.join(ROOT, 'skill', 'SKILL.md'), 'utf8');
    const dir = path.join(os.homedir(), '.claude', 'skills', 'the-den');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), tmpl.replaceAll('node "{{DEN}}"', `"${node}" "${tool}"`).replaceAll('{{DEN}}', tool));
    return `The Den skill is in ${dir.split(path.sep).join('/')}, so every chat, in any folder, knows the moves. `;
  } catch (e) { process.exitCode = 1; return `The Den skill didn't install (${e.message}). `; }
}

function tail(n) { try { return fs.readFileSync(LOG, 'utf8').trim().split('\n').slice(-n).join('\n'); } catch { return '(no log yet)'; } }

async function doctor(BASE, port) {
  const ok = [], bad = [];
  const say = (good, what, fix) => (good ? ok : bad).push(good ? `✓ ${what}` : `✗ ${what}\n    fix: ${fix}`);
  const node = realNode(), major = Number(process.versions.node.split('.')[0]);
  say(!!node && major >= 20, `Node ${process.versions.node} at ${process.execPath}`, node ? 'install Node 20 or newer (nodejs.org, the LTS)' : 'run den.js with the real node.exe, not a wrapper');
  if (major > 24) ok.push(`  (Node ${major} is newer than any we've tested; if something odd happens, say which Node it was)`);
  const c = conf();
  let why = ''; if (!c) try { JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch (e) { why = ` (${e.message})`; }
  say(!!c, `config.json reads${why}`, 'it is broken: open it and fix the JSON (paths with forward slashes). Deleting it would reset the names and the port.');
  if (!c) { console.log(ok.concat(bad).join('\n') + '\n\nFix config.json first; the other checks need it.'); process.exitCode = 1; return; }
  const h = await health(BASE);
  const r0 = h ? null : await running(BASE);
  if (!h) say(false, `the Den answers on port ${port}`, r0 ? `this Den is running on port ${r0.port}, from before config.json changed: node tools/den.js restart moves it to ${port}` : 'node tools/den.js start');
  else if (!h.den || !same(h.folder, ROOT)) say(false, `port ${port} is this Den`, h.den ? `another Den (${h.folder}) is on it: stop that one, or set another "port" here` : `something else has port ${port}: set another "port" in config.json, then start`);
  else say(true, `the Den is running at ${BASE}/ (from this folder)`);
  const table = path.resolve(ROOT, c?.table || '.', 'table');
  let canWrite = false; try { fs.mkdirSync(table, { recursive: true }); const t = path.join(table, '.write-test'); fs.writeFileSync(t, 'x'); fs.rmSync(t); canWrite = true; } catch {}
  say(canWrite, `the table folder can be written (${table})`, 'move the Den out of a protected folder (like Program Files), then start again');
  const b = findBrowser();
  say(!!b, `Chrome or Edge for page captures and mock-up pictures${b ? ` (${b})` : ''}`, 'install Chrome, or set "chrome" in config.json to a Chrome/Edge path');
  say(fs.existsSync(path.join(ROOT, 'tools', 'ocr.ps1')), 'Windows OCR helper (reads the words in pictures)', 'the file tools/ocr.ps1 is missing: git checkout tools/ocr.ps1');
  const codex = spawnSync('codex --version', { encoding: 'utf8', shell: true, windowsHide: true });
  const auth = fs.existsSync(path.join(os.homedir(), '.codex', 'auth.json'));
  if (codex.status === 0 && auth) ok.push(`✓ pictures: Codex ${codex.stdout.trim()} is signed in (Make pictures works)`);
  else ok.push(`· pictures are off: ${codex.status === 0 ? 'Codex is installed but not signed in (codex login, with ChatGPT)' : 'Codex CLI is not installed'}. Everything else works. To turn pictures on: the "Pictures" part of CLAUDE.md.`);
  const g = c?.glass;
  if (!g) ok.push('· no glass linked (optional): node tools/den.js link <glass folder>');
  else {
    say(fs.existsSync(path.join(g, 'tools', 'glass.js')), `the glass is linked (${g})`, 'that folder moved: node tools/den.js link <where the glass is now>');
    let saved = null; try { saved = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'settings.json'), 'utf8')).env?.GLASS_DEN_URL || null; } catch {}
    if (process.env.GLASS_DEN_URL) ok.push('✓ the glass knows the Den');
    else if (saved === `http://127.0.0.1:${port}`) ok.push('· the glass knows the Den from your settings; it takes effect in a new chat, after a glass restart');
    else say(false, 'the glass knows the Den (GLASS_DEN_URL in your settings)', 'node tools/den.js hook (or hand your person the line from den.js line), then restart the glass');
  }
  console.log(ok.concat(bad).join('\n'));
  if (bad.length) { console.log(`\nFix the first ✗ first. The end of the Den's log:\n${tail(5)}`); process.exitCode = 1; }
  else console.log('\nAll good.');
}
