#!/usr/bin/env node
// Make a picture through the person's own ChatGPT. Claude doesn't make images, so we ask Codex (OpenAI's coding
// CLI, signed in with ChatGPT, never an API key) to use its built-in image tool once and save the PNG where we say.
//   node tools/imagine.mjs "prompt" --out file.png [--size 16:9] [--ref picture.png]...
// den.js imagine calls this. Needs: Codex CLI installed (npm i -g @openai/codex) and `codex login` with ChatGPT.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const argv = process.argv.slice(2), refs = [], o = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--ref') refs.push(path.resolve(argv[++i]));
  else if (a.startsWith('--')) o[a.slice(2)] = argv[++i];
  else o.prompt = o.prompt ? o.prompt + ' ' + a : a;
}
if (!o.prompt || !o.out) { console.log('imagine.mjs "prompt" --out file.png [--size 16:9] [--ref picture.png]'); process.exitCode = 1; }
else {
  const out = path.resolve(o.out); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.rmSync(out, { force: true });
  const gen = path.join(os.homedir(), '.codex', 'generated_images');
  const before = new Set(fs.existsSync(gen) ? walk(gen) : []);
  const ask = `Use $imagegen exactly once through Codex's built-in image generation.
Pass this request through unchanged:
BEGIN PROMPT
${o.prompt}
END PROMPT
${o.size ? `Aspect: ${o.size}.\n` : ''}${refs.length ? 'Use the attached images as references.\n' : ''}Use only the signed-in ChatGPT subscription. Never use an API key or the Images API.
Save exactly one PNG to: ${out}
Reply with only the saved path.`;
  const args = ['exec', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'workspace-write', '-c', 'approval_policy="never"', '-C', path.dirname(out)];
  for (const r of refs) args.push('-i', r);
  args.push('-');
  const p = spawn(process.platform === 'win32' ? 'codex.cmd' : 'codex', args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: process.platform === 'win32' });
  let log = ''; p.stdout.on('data', d => log += d); p.stderr.on('data', d => log += d);
  p.on('error', e => { console.log('Codex did not start: ' + e.message + ' (install it: npm i -g @openai/codex, then codex login)'); });
  p.stdin.end(ask);
  const timer = setTimeout(() => p.kill(), 6 * 60_000); timer.unref?.();
  p.on('close', code => {
    clearTimeout(timer);
    // Codex's sandbox can't always copy the picture out; then it's the newest new file in its own folder.
    if (!fs.existsSync(out) && fs.existsSync(gen)) {
      const fresh = walk(gen).filter(f => !before.has(f) && /\.png$/i.test(f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
      if (fresh) fs.copyFileSync(fresh, out);
    }
    if (fs.existsSync(out)) console.log(out);
    else { console.log('No picture came back. ' + (/login|auth|sign/i.test(log) ? 'Codex needs `codex login` with ChatGPT.' : /free plan|not available/i.test(log) ? 'This ChatGPT plan has no image generation.' : 'The end of what Codex said: ' + log.trim().split('\n').slice(-3).join(' '))); process.exitCode = code || 1; }
  });
}
function walk(d) { const r = []; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) r.push(...walk(f)); else r.push(f); } return r; }
