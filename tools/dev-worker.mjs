// Run the real worker.js locally with fake storage and fake email, to test the
// onboarding form, the client email sequence, reports routing and dashboards
// without touching production or emailing anyone.
//
//   node tools/dev-worker.mjs            -> http://localhost:8787
//   admin password: test
//
// Fakes:
//   MEDIA (R2)   in memory, empty on every start
//   ASSETS       the repo's files on disk
//   Resend       emails are not sent; each one is appended to /tmp/dev-worker-emails.json
//   Discord      accepted and dropped
// Helpers:
//   GET /__cron              run the 15-minute cron once (form reminders, weekly alerts)
//   GET /__time?shift=25     move every sequence timestamp 25 hours into the past
//   Any host: send a Host-like path, e.g. /onboarding/admin, /reports/<name>/
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { default: worker } = await import(path.join(ROOT, 'worker.js'));
const OUTBOX = '/tmp/dev-worker-emails.json';
const store = new Map();
const sent = [];
fs.writeFileSync(OUTBOX, '[]');

const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  const s = String((u && u.url) || u);
  if (s.startsWith('https://api.resend.com')) {
    const b = JSON.parse(o.body);
    if (b.attachments) b.attachments = b.attachments.map((a) => ({ filename: a.filename, bytes: (a.content || '').length }));
    sent.push(b); fs.writeFileSync(OUTBOX, JSON.stringify(sent, null, 1));
    console.log('[email]', b.subject, '->', [].concat(b.to).join(', '));
    return new Response('{"id":"dev"}', { status: 200 });
  }
  if (s.includes('discord.com')) return new Response('', { status: 204 });
  return realFetch(u, o);
};

const obj = (v) => ({
  body: v.data, size: v.data.length, httpMetadata: v.http || {}, customMetadata: v.meta || {}, uploaded: v.uploaded,
  text: async () => new TextDecoder().decode(v.data),
  json: async () => JSON.parse(new TextDecoder().decode(v.data)),
  arrayBuffer: async () => v.data.buffer.slice(v.data.byteOffset, v.data.byteOffset + v.data.byteLength),
});
const MEDIA = {
  async get(k) { const v = store.get(k); return v ? obj(v) : null; },
  async head(k) { const v = store.get(k); return v ? obj(v) : null; },
  async put(k, data, opts = {}) {
    const d = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data instanceof ArrayBuffer ? data : await new Response(data).arrayBuffer());
    store.set(k, { data: d, http: opts.httpMetadata, meta: opts.customMetadata, uploaded: new Date().toISOString() });
  },
  async delete(k) { [].concat(k).forEach((x) => store.delete(x)); },
  async list({ prefix = '' } = {}) {
    return { truncated: false, objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => ({ key: k, size: store.get(k).data.length, uploaded: store.get(k).uploaded, customMetadata: store.get(k).meta })) };
  },
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.json': 'application/json' };
const ASSETS = {
  async fetch(req) {
    let f = path.join(ROOT, decodeURIComponent(new URL(req.url).pathname));
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    else if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return new Response('not found', { status: 404 });
    return new Response(fs.readFileSync(f), { headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } });
  },
};
const env = { MEDIA, ASSETS, ADMIN_PASSWORD: 'test', RESEND_API_KEY: 're_dev', ONBOARDING_NOTIFY_EMAIL: 'team@example.com', ONBOARDING_BASE_URL: 'http://localhost:8787' };
const ctx = { waitUntil: (p) => p && p.catch && p.catch(() => {}) };

http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  if (req.url === '/__cron') { await worker.scheduled({}, env, { waitUntil: (p) => p }); res.end('cron ran'); return; }
  if (req.url.startsWith('/__time?')) {
    const h = Number(new URL('http://x' + req.url).searchParams.get('shift')) || 0;
    for (const [k, v] of store) {
      if (!k.startsWith('onboarding/links/')) continue;
      const r = JSON.parse(new TextDecoder().decode(v.data));
      if (r.seq) {
        for (const x in r.seq.sent || {}) r.seq.sent[x] = new Date(Date.parse(r.seq.sent[x]) - h * 36e5).toISOString();
        if (r.seq.weekly_due) r.seq.weekly_due = new Date(Date.parse(r.seq.weekly_due) - h * 36e5).toISOString();
      }
      store.set(k, { ...v, data: new TextEncoder().encode(JSON.stringify(r)) });
    }
    res.end('moved back ' + h + 'h'); return;
  }
  const r = new Request('http://localhost:8787' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const out = await worker.fetch(r, env, ctx);
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(8787, () => console.log('dev worker on http://localhost:8787  (admin password: test, emails -> ' + OUTBOX + ')'));
