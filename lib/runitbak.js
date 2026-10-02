// Run It Bak: a password-gated content bank at /runitbak.
//
//   /runitbak                 -> the gate (no cookie) or the content bank (cookie)
//   /runitbak/files           -> admin page that lists what athletes uploaded
//   /api/runitbak/unlock      -> POST {password}; sets a signed 30 day cookie
//   /api/runitbak/upload      -> athlete uploads (needs the cookie), chunked into R2
//   /api/runitbak/files       -> admin listing (ADMIN_PASSWORD, same as /admin)
//
// Secret: set RUNITBAK_PASSWORD in the Worker settings. Until it is set the
// password falls back to the default below, so change it before sharing.
// Uploads land in the MEDIA R2 bucket under runitbak/<script-slug>/.
import { isAuthed, json } from './auth.js';

const DEFAULT_PASSWORD = 'Steallikeanartist';
const COOKIE = 'rib_auth';
const MAX_AGE = 60 * 60 * 24 * 30;
const enc = new TextEncoder();

// Compared without regard to capitals, so phone keyboards that auto capitalise
// (or do not) still get people in.
const password = (env) => ((env && env.RUNITBAK_PASSWORD) || DEFAULT_PASSWORD).toLowerCase();

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// The cookie is "<expiry>.<hmac>" keyed by the password, so changing the
// password signs everyone out.
export async function hasAccess(request, env) {
  const m = new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)').exec(request.headers.get('cookie') || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return same(sig, await hmac('rib:' + password(env), exp));
}

async function unlock(request, env) {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  let given = '';
  try { given = String((await request.json()).password || '').trim().toLowerCase(); } catch (e) {}
  const ok = same(await hmac('cmp', given), await hmac('cmp', password(env)));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 700));
    return json({ ok: false }, 401);
  }
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const token = exp + '.' + (await hmac('rib:' + password(env), String(exp)));
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'set-cookie': `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`,
    },
  });
}

const SLUG = /^[a-z0-9-]{1,80}$/;
const KEY = /^runitbak\/[a-z0-9-]{1,80}\/[A-Za-z0-9._-]{1,200}$/;
const clean = (s) => String(s || 'video').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '').slice(-120) || 'video';

async function upload(request, env) {
  if (!env.MEDIA) return json({ error: 'storage is not configured' }, 500);
  if (!(await hasAccess(request, env))) return json({ error: 'locked' }, 401);
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';
  try {
    if (action === 'create') {
      const slug = url.searchParams.get('v') || '';
      if (!SLUG.test(slug)) return json({ error: 'bad script' }, 400);
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const rand = crypto.randomUUID().slice(0, 6);
      const key = `runitbak/${slug}/${stamp}-${rand}-${clean(url.searchParams.get('name'))}`;
      const who = (url.searchParams.get('who') || '').slice(0, 80);
      const mpu = await env.MEDIA.createMultipartUpload(key, {
        httpMetadata: { contentType: request.headers.get('x-file-type') || 'video/mp4' },
        customMetadata: { who, script: slug },
      });
      return json({ uploadId: mpu.uploadId, key });
    }
    const key = url.searchParams.get('key') || '';
    const uploadId = url.searchParams.get('uploadId') || '';
    if (!KEY.test(key) || !uploadId) return json({ error: 'bad upload' }, 400);
    const mpu = env.MEDIA.resumeMultipartUpload(key, uploadId);
    if (action === 'part') {
      const n = parseInt(url.searchParams.get('part'), 10);
      if (!n) return json({ error: 'missing part' }, 400);
      const part = await mpu.uploadPart(n, await request.arrayBuffer());
      return json({ partNumber: part.partNumber, etag: part.etag });
    }
    if (action === 'complete') {
      const body = await request.json();
      const parts = (body.parts || []).map((p) => ({ partNumber: p.partNumber, etag: p.etag }));
      const obj = await mpu.complete(parts);
      return json({ ok: true, key, size: obj.size });
    }
    if (action === 'abort') {
      await mpu.abort();
      return json({ ok: true });
    }
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) }, 500);
  }
  return json({ error: 'unknown action' }, 400);
}

async function files(request, env) {
  if (!env.MEDIA) return json({ error: 'storage is not configured' }, 500);
  if (!isAuthed(request, env)) return json({ error: 'unauthorized' }, 401);
  const out = [];
  let cursor;
  do {
    const page = await env.MEDIA.list({ prefix: 'runitbak/', cursor, include: ['customMetadata'] });
    for (const o of page.objects) {
      out.push({
        key: o.key,
        script: o.key.split('/')[1],
        size: o.size,
        uploaded: o.uploaded,
        who: (o.customMetadata && o.customMetadata.who) || '',
        url: '/v/' + o.key.split('/').map(encodeURIComponent).join('/'),
      });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  out.sort((a, b) => String(b.uploaded).localeCompare(String(a.uploaded)));
  return json({ files: out });
}

export function handleRunItBakApi(request, env) {
  const p = new URL(request.url).pathname;
  if (p === '/api/runitbak/unlock') return unlock(request, env);
  if (p === '/api/runitbak/upload') return upload(request, env);
  if (p === '/api/runitbak/files') return files(request, env);
  return json({ error: 'not found' }, 404);
}

// Static assets live in /runitbak/*.html. They are fetched through the assets
// binding and only served from /runitbak, never from their own paths, so the
// content bank cannot be read without the cookie.
async function asset(env, request, path) {
  const base = new URL(request.url);
  let res = await env.ASSETS.fetch(new Request(new URL(path, base).toString(), { method: 'GET' }));
  if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
    res = await env.ASSETS.fetch(new Request(new URL(res.headers.get('location'), base).toString(), { method: 'GET' }));
  }
  return res;
}
function page(res) {
  const h = new Headers(res.headers);
  h.set('cache-control', 'no-store');
  h.set('x-robots-tag', 'noindex, nofollow');
  return new Response(res.body, { status: res.status, headers: h });
}

export async function handleRunItBakPage(request, env) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, '') || '/';
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('method not allowed', { status: 405 });
  if (p === '/runitbak') return page(await asset(env, request, (await hasAccess(request, env)) ? '/runitbak/app' : '/runitbak/gate'));
  if (p === '/runitbak/files') return page(await asset(env, request, '/runitbak/files'));
  if (p === '/runitbak/chris.jpg') return env.ASSETS.fetch(request);
  return new Response('not found', { status: 404 });
}
