// Just enough of a router for the Den's routes, so it runs on plain Node with nothing to install.
// It speaks the small part of Express the routes use: r.get/post/patch/delete with :params, req.body/query/params,
// res.status/json/set/type/send/sendFile/attachment.
import fs from 'node:fs';
import path from 'node:path';

const TYPES = { html: 'text/html; charset=utf-8', 'text/markdown': 'text/markdown; charset=utf-8', png: 'image/png', json: 'application/json' };
const EXT = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv' };

export function Router() {
  const routes = [];
  const add = method => (pattern, fn) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+?)'; }) + '/?$');
    routes.push({ method, re, keys, fn });
  };
  const r = { get: add('GET'), post: add('POST'), patch: add('PATCH'), delete: add('DELETE') };
  /** Handle a request whose path (below the mount) is `sub`. Returns false when nothing matched. */
  r.handle = async (req, res, sub) => {
    for (const rt of routes) {
      if (rt.method !== req.method) continue;
      const m = rt.re.exec(sub); if (!m) continue;
      req.params = Object.fromEntries(rt.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      try { await rt.fn(req, res, err => { if (err) throw err; }); }
      catch (e) { if (!res.headersSent) res.status(e.status || 500).json({ error: e.message || String(e), ...(e.extra || {}) }); }
      return true;
    }
    return false;
  };
  return r;
}

/** Give a plain Node response the few Express methods the routes call. */
export function dress(req, res) {
  res.status = c => { res.statusCode = c; return res; };
  res.set = (k, v) => { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) res.setHeader(a, b); else res.setHeader(k, v); return res; };
  res.type = t => { res.setHeader('Content-Type', TYPES[t] || t); return res; };
  res.json = o => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
  res.send = b => { res.end(b); return res; };
  res.attachment = name => { res.setHeader('Content-Disposition', `attachment; filename="${String(name).replace(/"/g, '')}"`); return res; };
  res.sendFile = p => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', EXT[path.extname(p).toLowerCase()] || 'application/octet-stream');
    fs.createReadStream(p).on('error', () => { if (!res.headersSent) res.statusCode = 404; res.end(); }).pipe(res);
    return res;
  };
  res.flushHeaders = res.flushHeaders || (() => {});
  return res;
}

/** Read a JSON body (the Den takes pictures as base64, so up to 60 MB). */
export function readBody(req, limit = 60 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (req.method === 'GET' || req.method === 'HEAD') return resolve({});
    let size = 0; const parts = [];
    req.on('data', d => { size += d.length; if (size > limit) { reject(Object.assign(new Error('too big'), { status: 413 })); req.destroy(); } else parts.push(d); });
    req.on('end', () => { const t = Buffer.concat(parts).toString('utf8'); if (!t) return resolve({}); try { resolve(JSON.parse(t)); } catch { reject(Object.assign(new Error('that was not JSON'), { status: 400 })); } });
    req.on('error', reject);
  });
}
