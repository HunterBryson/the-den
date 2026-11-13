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
  const pf = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
  return pf.flatMap(p => [path.join(p, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(p, 'Microsoft', 'Edge', 'Application', 'msedge.exe')]).find(p => fs.existsSync(p)) || null;
}

export async function run(cmd, args, { BASE }) {
  if (!fs.existsSync(CONFIG) && fs.existsSync(path.join(ROOT, 'config.example.json'))) fs.copyFileSync(path.join(ROOT, 'config.example.json'), CONFIG);
  const port = (conf() || {}).port || 7950;

  if (cmd === 'start' || cmd === 'restart') {
    const h = await health(BASE);
    if (h?.den && same(h.folder, ROOT)) {
      if (cmd === 'start') { console.log(`The Den is already running at ${BASE}/`); if (args.includes('--open')) await run('open', [], { BASE }); return; }
      await fetch(BASE + '/api/quit', { method: 'POST' }).catch(() => {}); await sleep(600);
    } else if (h) { console.log(h.den ? `Another Den (from ${h.folder}) is on port ${port}. Stop that one, or give this one another port in config.json.` : `Something else is using port ${port}. Give the Den another port in config.json ("port").`); return; }
    const node = realNode(); if (!node) { console.log(`This isn't plain Node (${process.execPath}). Run den.js with the real node.exe.`); return; }
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    const out = fs.openSync(LOG, 'a');
    const p = spawn(node, [path.join(ROOT, 'server.js')], { cwd: ROOT, detached: true, windowsHide: true, stdio: ['ignore', out, out] });
    p.unref();
    for (let i = 0; i < 40; i++) { await sleep(250); const h2 = await health(BASE); if (h2?.den) { console.log(`The Den is running at ${BASE}/`); if (args.includes('--open')) await run('open', [], { BASE }); return; } }
    console.log(`The Den didn't come up. The end of its log:\n${tail(8)}`); return;
  }
  if (cmd === 'stop') {
    const h = await health(BASE);
    if (!h) { console.log('The Den is not running.'); return; }
    if (!h.den || !same(h.folder, ROOT)) { console.log(`What's on port ${port} isn't this Den, so I left it alone.`); return; }
    await fetch(BASE + '/api/quit', { method: 'POST' }).catch(() => {}); console.log('The Den stopped.'); return;
  }
  if (cmd === 'open') {
    const h = await health(BASE); if (!h?.den) { console.log('The Den is not running. Start it: node tools/den.js start --open'); return; }
    const b = findBrowser(), url = `${BASE}/`;
    if (b) spawn(b, [`--app=${url}`, '--start-maximized', `--user-data-dir=${path.join(ROOT, 'data', 'window')}`], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    else spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    console.log(`Opened the Den${b ? ' in its own window' : ''}: ${url}`); return;
  }
  if (cmd === 'link') {
    const g = args[0] && path.resolve(args[0]);
    if (!g || !fs.existsSync(path.join(g, 'tools', 'glass.js'))) { console.log('den.js link <the glass folder>  (the folder that has tools/glass.js)'); return; }
    const c = conf() || {}; c.glass = g.split(path.sep).join('/'); fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2) + '\n');
    console.log(`Linked the glass at ${c.glass}.`);
    console.log(denLine(port)); return;
  }
  if (cmd === 'hello') { // for a start-of-chat hook: one quiet line, never an error
    const h = await health(BASE);
    if (!h?.den) { console.log(`The Den isn't running (node "${path.join(ROOT, 'tools', 'den.js').split(path.sep).join('/')}" start).`); return; }
    try {
      const a = await (await fetch(BASE + '/api/den/asks', { signal: AbortSignal.timeout(2500) })).json();
      const open = (Array.isArray(a) ? a : []).filter(x => !x.done);
      console.log(open.length ? `The Den: ${open.length} ask${open.length > 1 ? 's' : ''} from your person waiting (node tools/den.js asks in ${ROOT.split(path.sep).join('/')}).` : 'The Den is running. Nothing is waiting on you there.');
    } catch { console.log('The Den is running.'); }
    return;
  }
  if (cmd === 'doctor') return doctor(BASE, port);
  if (cmd === 'line') { console.log(settingsLine(port)); return; }
}

/** What goes in ~/.claude/settings.json so every chat knows the Den: a start-of-chat line, and the glass's Den button. */
function settingsLine(port) {
  const node = (realNode() || process.execPath).split(path.sep).join('/');
  const tool = path.join(ROOT, 'tools', 'den.js').split(path.sep).join('/');
  const hook = { hooks: [{ type: 'command', command: `"${node}" "${tool}" hello`, timeout: 5 }] };
  const block = { env: { GLASS_DEN_URL: `http://127.0.0.1:${port}` }, hooks: { SessionStart: [hook] } };
  return `Add these to ~/.claude/settings.json (merge them in; keep everything already there):\n${JSON.stringify(block, null, 2)}\n` +
    `The hook tells every new chat whether the Den is running and if anything waits there. GLASS_DEN_URL turns on the glass's ⤓ Den button (restart the glass after).`;
}

function denLine(port) {
  return `For the glass's ⤓ Den button, the glass needs to know where the Den is: GLASS_DEN_URL=http://127.0.0.1:${port}
Add it to the "env" of your Claude settings (~/.claude/settings.json), then restart the glass (node tools/glass.js restart in the glass folder).
If you aren't allowed to change your own settings, give your person this to paste into that file's "env" block:
  "GLASS_DEN_URL": "http://127.0.0.1:${port}"`;
}

function tail(n) { try { return fs.readFileSync(LOG, 'utf8').trim().split('\n').slice(-n).join('\n'); } catch { return '(no log yet)'; } }

async function doctor(BASE, port) {
  const ok = [], bad = [];
  const say = (good, what, fix) => (good ? ok : bad).push(good ? `✓ ${what}` : `✗ ${what}\n    fix: ${fix}`);
  const node = realNode(), major = Number(process.versions.node.split('.')[0]);
  say(!!node && major >= 20, `Node ${process.versions.node} at ${process.execPath}`, node ? 'install Node 20 or newer (nodejs.org, the LTS)' : 'run den.js with the real node.exe, not a wrapper');
  if (major > 24) ok.push(`  (Node ${major} is newer than any we've tested; if something odd happens, say which Node it was)`);
  const c = conf();
  say(!!c, 'config.json reads', 'it is broken: open it, fix the JSON (paths with forward slashes), or delete it and start again to get a fresh one');
  const h = await health(BASE);
  if (!h) say(false, `the Den answers on port ${port}`, 'node tools/den.js start');
  else if (!h.den || !same(h.folder, ROOT)) say(false, `port ${port} is this Den`, h.den ? `another Den (${h.folder}) is on it: stop that one, or set another "port" here` : `something else has port ${port}: set another "port" in config.json, then start`);
  else say(true, `the Den is running at ${BASE}/ (from this folder)`);
  const table = path.resolve(ROOT, c?.table || '.', 'table');
  let canWrite = false; try { fs.mkdirSync(table, { recursive: true }); const t = path.join(table, '.write-test'); fs.writeFileSync(t, 'x'); fs.rmSync(t); canWrite = true; } catch {}
  say(canWrite, `the table folder can be written (${table})`, 'move the Den out of a protected folder (Program Files, OneDrive sync conflicts), then start again');
  const b = findBrowser();
  say(!!b, `Chrome or Edge for page captures and mock-up pictures${b ? ` (${b})` : ''}`, 'install Chrome, or set "chrome" in config.json to a Chrome/Edge path');
  say(fs.existsSync(path.join(ROOT, 'tools', 'ocr.ps1')), 'Windows OCR helper (reads the words in pictures)', 'the file tools/ocr.ps1 is missing: git checkout tools/ocr.ps1');
  const codex = spawnSync('codex --version', { encoding: 'utf8', shell: true, windowsHide: true });
  const auth = fs.existsSync(path.join(os.homedir(), '.codex', 'auth.json'));
  if (codex.status === 0 && auth) ok.push(`✓ pictures: Codex ${codex.stdout.trim()} is signed in (Make pictures works)`);
  else ok.push(`· pictures are off: ${codex.status === 0 ? 'Codex is installed but not signed in (codex login, with ChatGPT)' : 'Codex CLI is not installed'}. Everything else works. To turn pictures on: the README's "Pictures" part.`);
  const g = c?.glass;
  if (!g) ok.push('· no glass linked (optional): node tools/den.js link <glass folder>');
  else {
    say(fs.existsSync(path.join(g, 'tools', 'glass.js')), `the glass is linked (${g})`, 'that folder moved: node tools/den.js link <where the glass is now>');
    say(!!process.env.GLASS_DEN_URL, "the glass knows the Den (GLASS_DEN_URL in this chat's settings)", denLine(port).split('\n').slice(1).join('\n    '));
  }
  console.log(ok.concat(bad).join('\n'));
  if (bad.length) console.log(`\nFix the first ✗ first. The end of the Den's log:\n${tail(5)}`);
  else console.log('\nAll good.');
}
