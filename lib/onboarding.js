// Client onboarding form at onboarding.maisondelites.com/<token>.
//
// worker.js maps that subdomain's root onto the /onboarding paths below
// (/<token> -> /onboarding/<token>, /admin -> /onboarding/admin), so the same
// routes also work as /onboarding/... on any other host the Worker answers.
//
//   /onboarding/<token>                 -> the client's form (no sign-in, the token is the key)
//   /onboarding/admin                   -> admin page: create links, track status, read answers
//   /onboarding/api/s/<token>           -> GET the client's saved state (marks the link opened)
//   /onboarding/api/s/<token>/save      -> POST autosave {answers, last_question}
//   /onboarding/api/s/<token>/submit    -> POST final answers; notifies the team and the client
//   /onboarding/api/s/<token>/state     -> POST {action: 'book_later' | 'booked'}
//   /onboarding/api/s/<token>/upload    -> chunked file upload into R2 (create/part/complete/abort)
//   /onboarding/api/s/<token>/file      -> DELETE ?id=<file id> (before submitting)
//   /onboarding/api/admin/...           -> admin API (ADMIN_PASSWORD, same as /admin)
//   /onboarding/api/file                -> short-lived signed file download for admins
//
// Storage (MEDIA R2 bucket):
//   onboarding/links/<token>.json            link record + answers
//   onboarding/files/<token>/<qid>/<file>    uploaded files (customMetadata: name, qid)
//
// Variables (Worker settings): CAL_ONBOARDING_URL, CAL_PERSONAL_BRANDING_URL,
// ONBOARDING_NOTIFY_EMAIL, ONBOARDING_DISCORD_WEBHOOK, optional ONBOARDING_FROM
// and ONBOARDING_BASE_URL (defaults to https://onboarding.maisondelites.com).
// Email uses the existing RESEND_API_KEY secret.
import { isAuthed, json } from './auth.js';
import { sequenceApi, nextStep } from './sequence.js';

export const LINKS = 'onboarding/links/';
const FILES = 'onboarding/files/';
const TOKEN = /^[A-Za-z0-9_-]{32,64}$/;
const DEFAULT_BASE = 'https://onboarding.maisondelites.com';
const enc = new TextEncoder();

const baseUrl = (env) => String((env && env.ONBOARDING_BASE_URL) || DEFAULT_BASE).replace(/\/+$/, '');
// On the onboarding.* subdomain the form sits at the root (/<token>, /admin);
// on any other host it sits under /onboarding.
const prefix = (env) => (/^https?:\/\/onboarding\./.test(baseUrl(env)) ? '' : '/onboarding');
export const formUrl = (env, token) => baseUrl(env) + prefix(env) + '/' + token;
export const adminUrl = (env, token) => baseUrl(env) + prefix(env) + '/admin#' + token;
const linkKey = (token) => LINKS + token + '.json';
const now = () => new Date().toISOString();

function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function noStore(res) {
  res.headers.set('cache-control', 'no-store');
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  return res;
}
const out = (obj, status) => noStore(json(obj, status));

export async function loadLink(env, token) {
  if (!TOKEN.test(token || '')) return null;
  const obj = await env.MEDIA.get(linkKey(token));
  if (!obj) return null;
  try { return JSON.parse(await obj.text()); } catch (e) { return null; }
}
export async function saveLink(env, rec) {
  rec.updated_at = now();
  await env.MEDIA.put(linkKey(rec.token), JSON.stringify(rec), { httpMetadata: { contentType: 'application/json' } });
}

// ---- Rate limit ------------------------------------------------------------
// Public routes are limited per client IP. Requests may arrive through the
// maisondelites.com route, so the real IP is read from CF-Connecting-IP. Uses
// the ONBOARDING_LIMITER binding (wrangler.toml) when present, otherwise a
// best-effort per-isolate counter.
const hits = new Map();
async function limited(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.ONBOARDING_LIMITER && typeof env.ONBOARDING_LIMITER.limit === 'function') {
    try { const { success } = await env.ONBOARDING_LIMITER.limit({ key: 'onb:' + ip }); return !success; } catch (e) { return false; }
  }
  const minute = Math.floor(Date.now() / 60000);
  const h = hits.get(ip);
  if (!h || h.minute !== minute) { hits.set(ip, { minute, n: 1 }); if (hits.size > 5000) hits.clear(); return false; }
  h.n += 1;
  return h.n > 300;
}

// ---- Answers ---------------------------------------------------------------
// Text is stripped of HTML and control characters and bounded, so a public
// endpoint can't store huge blobs or markup that would render in admin/emails.
const text = (v, max = 4000) => String(v == null ? '' : v)
  .replace(/<[^>]*>/g, '')
  .replace(/[<>]/g, '')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .slice(0, max).trim();
const pick = (v, allowed) => (allowed.includes(v) ? v : '');
const picks = (v, allowed) => (Array.isArray(v) ? [...new Set(v.filter((x) => allowed.includes(x)))] : []);

const CONTACT = ['whatsapp', 'instagram', 'email'];
const PROMO = ['song', 'product', 'show', 'person', 'other'];
const WINS = ['streams', 'followers', 'sales', 'signups', 'awareness', 'other'];
const SOURCES = ['youtube', 'podcast', 'stream', 'drive', 'upload'];
const PLATFORMS = ['tiktok', 'reels', 'shorts', 'x'];

export const LABELS = {
  contact: { whatsapp: 'WhatsApp', instagram: 'Instagram DM', email: 'Email' },
  promo: { song: 'A song or album', product: 'A product', show: 'A show or podcast', person: 'A person or personal brand', other: 'Something else' },
  wins: { streams: 'More streams', followers: 'More followers', sales: 'More sales', signups: 'More sign-ups', awareness: 'More people knowing the name', other: 'Something else' },
  sources: { youtube: 'YouTube channel', podcast: 'Podcast episodes', stream: 'Twitch or Kick streams', drive: 'Google Drive or Dropbox folder', upload: 'Uploaded files' },
  platforms: { tiktok: 'TikTok', reels: 'Instagram Reels', shorts: 'YouTube Shorts', x: 'X' },
};

// Normalise whatever the browser sent into the known shape, and drop answers
// whose triggering question no longer shows them (so cleared answers never
// reach admin or emails).
function cleanAnswers(input) {
  const a = (input && typeof input === 'object') ? input : {};
  const o = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const r = {};
  r.q1 = text(a.q1, 160);
  r.q2 = { name: text(o(a.q2).name, 120), role: text(o(a.q2).role, 120) };
  r.q3 = pick(a.q3, CONTACT);
  if (r.q3) r.q3b = text(a.q3b, 200);
  if (r.q3 !== 'email') r.q4 = text(a.q4, 200);
  r.q5 = Array.isArray(a.q5) ? a.q5.slice(0, 20).map((x) => ({ name: text(o(x).name, 120), email: text(o(x).email, 200) })).filter((x) => x.name || x.email) : [];
  r.q6 = pick(a.q6, PROMO);
  if (r.q6 === 'other') r.q6_other = text(a.q6_other, 300);
  r.q7 = pick(a.q7, ['yes', 'no']);
  r.q8 = text(a.q8, 1000);
  const q9 = o(a.q9);
  r.q9 = q9.none ? { none: true } : { date: text(q9.date, 10).replace(/[^0-9-]/g, ''), what: text(q9.what, 300) };
  r.q10 = picks(a.q10, WINS);
  if (r.q10.includes('other')) r.q10_other = text(a.q10_other, 300);
  r.q11 = picks(a.q11, SOURCES);
  const q11b = o(a.q11b);
  r.q11b = {};
  for (const s of r.q11.filter((s) => s !== 'upload')) r.q11b[s] = text(q11b[s], 1000);
  r.q12 = text(a.q12, 6000);
  r.q13 = text(a.q13, 6000);
  const q14 = o(a.q14);
  r.q14 = { sound: text(q14.sound, 300), hashtags: text(q14.hashtags, 500), tags: text(q14.tags, 500), cta: text(q14.cta, 1000) };
  r.q16 = picks(a.q16, PLATFORMS);
  const q17 = o(a.q17);
  r.q17 = q17.worldwide ? { worldwide: true } : { text: text(q17.text, 400) };
  r.q18 = Array.isArray(a.q18) ? a.q18.slice(0, 20).map((x) => text(x, 200)).filter(Boolean) : [];
  r.q19 = text(a.q19, 6000);
  return r;
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v || '');
const isUrl = (v) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v || '');
const isPhone = (v) => /^\+\d[\d\s().-]{6,}$/.test((v || '').trim());
export const clientEmail = (a) => (a.q3 === 'email' ? a.q3b : a.q4) || '';

// Server-side check of every required answer. Returns the first problem as
// {q, error} so the form can jump back to it, or null when complete.
function firstProblem(a, fileQids) {
  if (!a.q1) return { q: 'q1', error: 'Please add the campaign name' };
  if (!a.q2.name || !a.q2.role) return { q: 'q2', error: 'Please add your name and role' };
  if (!a.q3) return { q: 'q3', error: 'Please pick one' };
  if (a.q3 === 'whatsapp' && !isPhone(a.q3b)) return { q: 'q3b', error: 'Please add your number with country code' };
  if (a.q3 === 'instagram' && !a.q3b) return { q: 'q3b', error: 'Please add your Instagram handle' };
  if (a.q3 === 'email' && !isEmail(a.q3b)) return { q: 'q3b', error: 'Please add a valid email' };
  if (a.q3 !== 'email' && !isEmail(a.q4)) return { q: 'q4', error: 'Please add a valid email' };
  if (a.q5.some((x) => !isEmail(x.email))) return { q: 'q5', error: 'Please check the email addresses' };
  if (!a.q6) return { q: 'q6', error: 'Please pick one' };
  if (a.q6 === 'other' && !a.q6_other) return { q: 'q6', error: 'Please tell us what it is' };
  if (!a.q7) return { q: 'q7', error: 'Please pick one' };
  if (!isUrl(a.q8)) return { q: 'q8', error: 'Please add a link' };
  if (!a.q10.length) return { q: 'q10', error: 'Please pick at least one' };
  if (a.q10.includes('other') && !a.q10_other) return { q: 'q10', error: 'Please tell us what a win looks like' };
  if (!a.q11.length) return { q: 'q11', error: 'Please pick at least one source' };
  for (const s of Object.keys(a.q11b)) if (!isUrl(a.q11b[s])) return { q: 'q11b', error: 'Please add a link for each source' };
  if (a.q11.includes('upload') && !fileQids.has('q11b')) return { q: 'q11b', error: 'Please upload at least one file' };
  if (!a.q16.length) return { q: 'q16', error: 'Please pick at least one platform' };
  if (!a.q18.length || a.q18.some((x) => !isEmail(x))) return { q: 'q18', error: 'Please add at least one valid email' };
  return null;
}

// ---- Files -----------------------------------------------------------------
const MB = 1024 * 1024;
const TYPES = {
  png: ['image/png', 50 * MB], jpg: ['image/jpeg', 50 * MB], jpeg: ['image/jpeg', 50 * MB],
  svg: ['image/svg+xml', 50 * MB], webp: ['image/webp', 50 * MB], pdf: ['application/pdf', 50 * MB],
  zip: ['application/zip', 50 * MB], mp4: ['video/mp4', 2048 * MB], mov: ['video/quicktime', 2048 * MB],
};
const FILE_QIDS = ['q11b', 'q15'];
const MAX_FILES = 80;
const safeName = (s) => String(s || 'file').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '').slice(-120) || 'file';
const extOf = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';

async function listFiles(env, token) {
  const files = [];
  let cursor;
  do {
    const page = await env.MEDIA.list({ prefix: FILES + token + '/', cursor, include: ['customMetadata'] });
    for (const o of page.objects) {
      const m = o.customMetadata || {};
      files.push({ id: o.key.slice((FILES + token + '/').length), key: o.key, qid: m.qid || o.key.split('/')[3], name: m.name || o.key.split('/').pop(), size: o.size, uploaded: o.uploaded });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  files.sort((a, b) => String(a.uploaded).localeCompare(String(b.uploaded)));
  return files;
}
async function deleteFiles(env, files) {
  for (let i = 0; i < files.length; i += 500) await env.MEDIA.delete(files.slice(i, i + 500).map((f) => f.key));
}

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
// Admin downloads use URLs signed with the admin password that expire after
// 15 minutes, so a link pasted somewhere stops working on its own.
async function signedFileUrl(env, key) {
  const exp = Math.floor(Date.now() / 1000) + 15 * 60;
  const sig = await hmac('onbfile:' + env.ADMIN_PASSWORD, key + '|' + exp);
  return '/onboarding/api/file?k=' + encodeURIComponent(key) + '&e=' + exp + '&s=' + sig;
}
async function serveFile(request, env) {
  const u = new URL(request.url);
  const key = u.searchParams.get('k') || '';
  const exp = Number(u.searchParams.get('e')) || 0;
  const sig = u.searchParams.get('s') || '';
  if (!env.ADMIN_PASSWORD || !key.startsWith(FILES) || exp < Date.now() / 1000) return new Response('link expired', { status: 403 });
  if (!same(sig, await hmac('onbfile:' + env.ADMIN_PASSWORD, key + '|' + exp))) return new Response('forbidden', { status: 403 });
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('not found', { status: 404 });
  const name = ((obj.customMetadata && obj.customMetadata.name) || key.split('/').pop()).replace(/["\\\r\n]/g, '');
  return new Response(obj.body, {
    headers: {
      'content-type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
      'content-length': String(obj.size),
      'content-disposition': 'attachment; filename="' + name + '"',
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    },
  });
}

// Chunked upload through the Worker into R2 (same approach as /admin and
// /runitbak). Type and size are enforced here, not just in the browser.
async function upload(request, env, rec) {
  if (request.method !== 'POST') return out({ error: 'method not allowed' }, 405);
  if (rec.status === 'submitted') return out({ error: 'This form has already been submitted.' }, 409);
  const u = new URL(request.url);
  const action = u.searchParams.get('action') || '';
  const prefix = FILES + rec.token + '/';
  try {
    if (action === 'create') {
      const qid = u.searchParams.get('q') || '';
      const name = String(u.searchParams.get('name') || '').slice(0, 200);
      const size = Number(u.searchParams.get('size')) || 0;
      const t = TYPES[extOf(name)];
      if (!FILE_QIDS.includes(qid)) return out({ error: 'bad question' }, 400);
      if (!t) return out({ error: 'That file type isn’t accepted.' }, 415);
      if (size <= 0 || size > t[1]) return out({ error: t[1] > 50 * MB ? 'Videos can be up to 2 GB.' : 'Files can be up to 50 MB.' }, 413);
      if ((await listFiles(env, rec.token)).length >= MAX_FILES) return out({ error: 'Too many files on this form.' }, 413);
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const key = prefix + qid + '/' + stamp + '-' + crypto.randomUUID().slice(0, 6) + '-' + safeName(name);
      const mpu = await env.MEDIA.createMultipartUpload(key, {
        httpMetadata: { contentType: t[0] },
        customMetadata: { qid, name: text(name, 200), limit: String(t[1]) },
      });
      return out({ uploadId: mpu.uploadId, key });
    }
    const key = u.searchParams.get('key') || '';
    const uploadId = u.searchParams.get('uploadId') || '';
    if (!key.startsWith(prefix) || key.includes('..') || !uploadId) return out({ error: 'bad upload' }, 400);
    const t = TYPES[extOf(key)];
    if (!t) return out({ error: 'bad upload' }, 400);
    const mpu = env.MEDIA.resumeMultipartUpload(key, uploadId);
    if (action === 'part') {
      const n = parseInt(u.searchParams.get('part'), 10);
      // 10 MB parts from the browser; cap the count so a part loop can't exceed the type's limit by much.
      if (!n || n < 1 || n > Math.ceil(t[1] / (5 * MB)) + 1) return out({ error: 'bad part' }, 400);
      const part = await mpu.uploadPart(n, await request.arrayBuffer());
      return out({ partNumber: part.partNumber, etag: part.etag });
    }
    if (action === 'complete') {
      const body = await request.json();
      const parts = (body.parts || []).map((p) => ({ partNumber: p.partNumber, etag: p.etag }));
      const obj = await mpu.complete(parts);
      if (obj.size > t[1]) {
        await env.MEDIA.delete(key);
        return out({ error: 'File too large.' }, 413);
      }
      return out({ ok: true, id: key.slice(prefix.length), size: obj.size });
    }
    if (action === 'abort') {
      await mpu.abort();
      return out({ ok: true });
    }
  } catch (err) {
    return out({ error: String(err && err.message ? err.message : err) }, 500);
  }
  return out({ error: 'unknown action' }, 400);
}

// ---- Booking ---------------------------------------------------------------
export function bookingUrl(env, rec) {
  const base = rec.call_type === 'personal_branding' ? env.CAL_PERSONAL_BRANDING_URL : env.CAL_ONBOARDING_URL;
  return base ? String(base).trim() : '';
}
export function withPrefill(url, a) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (a.q2 && a.q2.name) u.searchParams.set('name', a.q2.name);
    if (clientEmail(a)) u.searchParams.set('email', clientEmail(a));
    return u.toString();
  } catch (e) { return url; }
}

// What the client's browser gets back. Never includes admin-only fields.
async function clientState(env, rec) {
  const files = (await listFiles(env, rec.token)).map((f) => ({ id: f.id, qid: f.qid, name: f.name, size: f.size }));
  const state = {
    ok: true,
    client_name: rec.client_name,
    campaign_name: rec.campaign_name,
    status: rec.status,
    submitted: rec.status === 'submitted',
    answers: rec.answers || {},
    last_question: rec.last_question || '',
    booking_state: rec.booking_state || '',
    files,
  };
  if (state.submitted) {
    state.booking = { call_type: rec.call_type, url: bookingUrl(env, rec), name: (rec.answers.q2 || {}).name || '', email: clientEmail(rec.answers) };
  }
  return state;
}

// ---- Notifications ---------------------------------------------------------
export const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const callLabel = (t) => (t === 'personal_branding' ? 'Personal branding call' : 'Standard onboarding call');
const fromAddr = (env) => env.ONBOARDING_FROM || env.BRANDSHEET_FROM || 'Maison d\'Élites <onboarding@resend.dev>';

function keyDate(a) {
  if (!a.q9 || a.q9.none || !a.q9.date) return '';
  return a.q9.date + (a.q9.what ? ' (' + a.q9.what + ')' : '');
}
function teamSummary(rec) {
  const a = rec.answers;
  return [
    ['Client', rec.client_name],
    ['Campaign', a.q1 || rec.campaign_name],
    ['Call type', callLabel(rec.call_type)],
    ['Platforms', (a.q16 || []).map((p) => LABELS.platforms[p]).join(', ')],
    ['Key date', keyDate(a)],
  ].filter((r) => r[1]);
}

export async function sendEmail(env, payload) {
  if (!env.RESEND_API_KEY) return { sent: false, reason: 'RESEND_API_KEY not set' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: fromAddr(env), ...payload }),
    });
    return { sent: r.ok, status: r.status };
  } catch (err) {
    return { sent: false, reason: String(err && err.message ? err.message : err) };
  }
}

export function emailShell(eyebrow, inner) {
  return '<div style="background:#f4eee2;padding:28px 0;">'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fbf7ee;border:1px solid #e6ddcb;border-radius:14px;overflow:hidden;">'
    + '<tr><td style="background:#14110d;padding:24px 30px;"><div style="font:600 10px/1 Arial,sans-serif;letter-spacing:3px;text-transform:uppercase;color:#c7a867;">Maison d’Élites · ' + esc(eyebrow) + '</div></td></tr>'
    + '<tr><td style="padding:28px 30px 32px;">' + inner + '</td></tr></table></div>';
}
export const button = (href, label) => '<a href="' + esc(href) + '" style="display:inline-block;background:#9a7b36;color:#ffffff;font:600 14px/1 Arial,sans-serif;text-decoration:none;padding:14px 24px;border-radius:10px;">' + esc(label) + '</a>';

async function notifyTeamEmail(env, rec) {
  const to = env.ONBOARDING_NOTIFY_EMAIL;
  if (!to) return { sent: false, reason: 'ONBOARDING_NOTIFY_EMAIL not set' };
  const url = adminUrl(env, rec.token);
  const rows = teamSummary(rec);
  const html = emailShell('Onboarding',
    '<div style="font:500 24px/1.25 Georgia,serif;color:#221d15;">Onboarding submitted</div>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 24px;">'
    + rows.map((r) => '<tr><td style="font:400 13px/1.6 Arial,sans-serif;color:#8a8073;padding:3px 18px 3px 0;vertical-align:top;">' + esc(r[0]) + '</td><td style="font:400 15px/1.6 Georgia,serif;color:#221d15;padding:3px 0;">' + esc(r[1]) + '</td></tr>').join('')
    + '</table>' + button(url, 'View the answers'));
  const textBody = 'Onboarding submitted\n\n' + rows.map((r) => r[0] + ': ' + r[1]).join('\n') + '\n\nView the answers: ' + url;
  const payload = { to: String(to).split(',').map((s) => s.trim()).filter(Boolean), subject: 'Onboarding submitted: ' + (rec.answers.q1 || rec.campaign_name), html, text: textBody };
  const reply = clientEmail(rec.answers);
  if (reply) payload.reply_to = reply;
  return sendEmail(env, payload);
}

async function notifyTeamDiscord(env, rec) {
  const hook = env.ONBOARDING_DISCORD_WEBHOOK;
  if (!hook) return { sent: false };
  const clean = (v) => String(v || '').replace(/[`*_~|>]/g, '').slice(0, 300);
  const content = '📋 **Onboarding submitted**\n'
    + teamSummary(rec).map((r) => '**' + r[0] + ':** ' + clean(r[1])).join('\n')
    + '\n' + adminUrl(env, rec.token);
  try {
    const r = await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }) });
    return { sent: r.ok };
  } catch (err) {
    return { sent: false };
  }
}

async function notifyClient(env, rec) {
  const a = rec.answers;
  const to = [...new Set([clientEmail(a), ...(a.q18 || [])].map((s) => String(s || '').trim().toLowerCase()).filter(isEmail))];
  if (!to.length) return { sent: false, reason: 'no client email' };
  const book = withPrefill(bookingUrl(env, rec), a);
  const html = emailShell('Onboarding',
    '<div style="font:500 24px/1.25 Georgia,serif;color:#221d15;">We’ve received your campaign details</div>'
    + '<p style="font:400 16px/1.6 Georgia,serif;color:#3a3226;margin:18px 0 0;">Thank you for completing your onboarding. Our team is now reviewing your answers.</p>'
    + (book ? '<p style="font:400 16px/1.6 Georgia,serif;color:#3a3226;margin:16px 0 20px;">If you haven’t booked your onboarding call yet, you can pick a time here:</p>' + button(book, 'Book your onboarding call') : '')
    + '<p style="font:400 16px/1.6 Georgia,serif;color:#3a3226;margin:22px 0 0;">Once your campaign is live, you’ll receive a link to your live campaign report, which updates automatically.</p>'
    + '<p style="font:400 16px/1.6 Georgia,serif;color:#3a3226;margin:22px 0 0;">Kind regards,<br>Maison d’Élites</p>');
  const textBody = 'Thank you for completing your onboarding. Our team is now reviewing your answers.\n\n'
    + (book ? 'If you haven’t booked your onboarding call yet, you can pick a time here:\n' + book + '\n\n' : '')
    + 'Once your campaign is live, you’ll receive a link to your live campaign report, which updates automatically.\n\nKind regards,\nMaison d’Élites';
  return sendEmail(env, { to: to.slice(0, 50), subject: 'We’ve received your campaign details', html, text: textBody });
}

// Everything that happens after a submission is stored. Each step is
// independent and best effort; a later CRM sync (GoHighLevel) slots in as one
// more step at the end without touching the others.
async function afterSubmit(env, rec) {
  const steps = [notifyTeamEmail, notifyTeamDiscord, notifyClient];
  const results = await Promise.all(steps.map((step) => step(env, rec).catch((e) => ({ sent: false, reason: String(e) }))));
  return results;
}

// ---- Client API ------------------------------------------------------------
async function clientApi(request, env, ctx, token, action) {
  const rec = await loadLink(env, token);
  if (!rec) return out({ error: 'This link isn’t valid.' }, 404);
  const method = request.method.toUpperCase();

  if (!action) {
    if (method !== 'GET') return out({ error: 'method not allowed' }, 405);
    if (rec.status === 'sent') {
      rec.status = 'opened';
      rec.opened_at = now();
      await saveLink(env, rec);
    }
    return out(await clientState(env, rec));
  }
  if (action === 'upload') return upload(request, env, rec);
  if (action === 'file') {
    if (method !== 'DELETE') return out({ error: 'method not allowed' }, 405);
    if (rec.status === 'submitted') return out({ error: 'This form has already been submitted.' }, 409);
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id || id.includes('..') || id.startsWith('/')) return out({ error: 'bad file' }, 400);
    await env.MEDIA.delete(FILES + token + '/' + id);
    return out({ ok: true });
  }

  if (method !== 'POST') return out({ error: 'method not allowed' }, 405);
  let body = {};
  try { body = await request.json(); } catch (e) { return out({ error: 'invalid JSON body' }, 400); }

  if (action === 'save') {
    if (rec.status === 'submitted') return out({ error: 'This form has already been submitted.', submitted: true }, 409);
    rec.answers = cleanAnswers(body.answers);
    rec.last_question = text(body.last_question, 20);
    if (rec.status !== 'in_progress') {
      rec.status = 'in_progress';
      if (!rec.opened_at) rec.opened_at = now();
    }
    await saveLink(env, rec);
    return out({ ok: true });
  }

  if (action === 'submit') {
    if (rec.status === 'submitted') return out(await clientState(env, rec));
    const answers = cleanAnswers(body.answers);
    let files = await listFiles(env, token);
    // Files under a question that's no longer shown are cleared, like hidden answers.
    if (!answers.q11.includes('upload')) {
      const stale = files.filter((f) => f.qid === 'q11b');
      if (stale.length) await deleteFiles(env, stale);
      files = files.filter((f) => f.qid !== 'q11b');
    }
    const problem = firstProblem(answers, new Set(files.map((f) => f.qid)));
    rec.answers = answers;
    if (problem) {
      await saveLink(env, rec);
      return out({ error: problem.error, q: problem.q }, 422);
    }
    rec.status = 'submitted';
    rec.submitted_at = now();
    rec.call_type = answers.q7 === 'yes' ? 'personal_branding' : 'standard';
    if (rec.booking_state !== 'booked') rec.booking_state = '';
    const first = !rec.notified_at;
    rec.notified_at = rec.notified_at || now();
    await saveLink(env, rec);
    // Notify once per link; a reopened and resubmitted form doesn't email everyone again.
    if (first) {
      const job = afterSubmit(env, rec);
      if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(job); else await job;
    }
    return out(await clientState(env, rec));
  }

  if (action === 'state') {
    if (rec.status !== 'submitted') return out({ error: 'not submitted' }, 409);
    const v = body.action === 'booked' ? 'booked' : body.action === 'book_later' ? 'book_later' : '';
    if (!v) return out({ error: 'bad action' }, 400);
    if (rec.booking_state !== 'booked') {
      rec.booking_state = v;
      if (v === 'booked') rec.booked_at = now();
      await saveLink(env, rec);
    }
    return out({ ok: true, booking_state: rec.booking_state });
  }

  return out({ error: 'not found' }, 404);
}

// ---- Admin API -------------------------------------------------------------
function summary(rec) {
  return {
    token: rec.token,
    client_name: rec.client_name,
    campaign_name: rec.campaign_name,
    status: rec.status,
    call_type: rec.call_type || '',
    booking_state: rec.booking_state || '',
    created_at: rec.created_at,
    opened_at: rec.opened_at || null,
    submitted_at: rec.submitted_at || null,
    campaign_id: rec.campaign_id || null,
    next: nextStep(rec),
  };
}

async function adminApi(request, env, action) {
  if (!isAuthed(request, env)) return out({ error: 'unauthorized' }, 401);
  const method = request.method.toUpperCase();
  const u = new URL(request.url);

  if (action === 'links') {
    if (method === 'GET') {
      const items = [];
      let cursor;
      do {
        const page = await env.MEDIA.list({ prefix: LINKS, cursor });
        const recs = await Promise.all(page.objects.map(async (o) => {
          const obj = await env.MEDIA.get(o.key);
          try { return obj ? JSON.parse(await obj.text()) : null; } catch (e) { return null; }
        }));
        for (const r of recs) if (r && r.token) items.push(summary(r));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return out({ ok: true, base: baseUrl(env) + prefix(env), links: items });
    }
    if (method === 'POST') {
      let body = {};
      try { body = await request.json(); } catch (e) { return out({ error: 'invalid JSON body' }, 400); }
      const client_name = text(body.client_name, 120);
      const campaign_name = text(body.campaign_name, 120);
      if (!client_name || !campaign_name) return out({ error: 'Client name and campaign name are required.' }, 422);
      const rec = {
        token: newToken(), client_name, campaign_name, status: 'sent', call_type: '',
        created_by: 'admin', created_at: now(), opened_at: null, submitted_at: null, campaign_id: null,
        answers: { q1: client_name }, last_question: '', booking_state: '',
        seq: { fields: {}, sent: {}, weekly: [] },
      };
      const first = text(body.first_name, 120);
      const email = text(body.email, 200).toLowerCase();
      if (first) rec.seq.fields.first_name = first;
      if (email && isEmail(email)) rec.seq.fields.email = email;
      rec.seq.fields.campaign = campaign_name;
      await saveLink(env, rec);
      return out({ ok: true, link: summary(rec), url: formUrl(env, rec.token) });
    }
    return out({ error: 'method not allowed' }, 405);
  }

  const token = u.searchParams.get('token') || '';
  const rec = await loadLink(env, token);
  if (!rec) return out({ error: 'not found' }, 404);

  if (action === 'link') {
    if (method === 'GET') {
      const files = await listFiles(env, token);
      for (const f of files) f.url = await signedFileUrl(env, f.key);
      return out({ ok: true, base: baseUrl(env) + prefix(env), link: summary(rec), answers: rec.answers || {}, files, labels: LABELS, booking_url: rec.call_type ? withPrefill(bookingUrl(env, rec), rec.answers || {}) : '' });
    }
    if (method === 'POST') {
      let body = {};
      try { body = await request.json(); } catch (e) { return out({ error: 'invalid JSON body' }, 400); }
      if (body.action === 'reopen') {
        if (rec.status !== 'submitted') return out({ error: 'Only submitted forms can be reopened.' }, 409);
        rec.status = 'in_progress';
        rec.reopened_at = now();
      } else if (body.action === 'set_campaign') {
        rec.campaign_id = String(body.campaign_id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || null;
      } else {
        return out({ error: 'bad action' }, 400);
      }
      await saveLink(env, rec);
      return out({ ok: true, link: summary(rec) });
    }
    if (method === 'DELETE') {
      await deleteFiles(env, await listFiles(env, token));
      await env.MEDIA.delete(linkKey(token));
      return out({ ok: true });
    }
    return out({ error: 'method not allowed' }, 405);
  }

  // The client email sequence: state, preview, send, mark as sent.
  if (action === 'sequence') {
    const r = await sequenceApi(request, env, rec);
    return out(r, r.ok ? 200 : (r.status || 400));
  }

  // Values the campaign editor prefills from a submission ("Create campaign from this").
  if (action === 'prefill') {
    const a = rec.answers || {};
    return out({
      ok: true,
      token,
      client: a.q1 || rec.client_name,
      campaign: rec.campaign_name,
      brief: {
        mainLink: a.q8 || '',
        platforms: (a.q16 || []).map((p) => LABELS.platforms[p]),
        offLimits: a.q13 || '',
        sound: (a.q14 || {}).sound || '',
        hashtags: (a.q14 || {}).hashtags || '',
        tags: (a.q14 || {}).tags || '',
        cta: (a.q14 || {}).cta || '',
        reportRecipients: a.q18 || [],
        onboarding: token,
      },
    });
  }

  return out({ error: 'not found' }, 404);
}

// ---- Pages -----------------------------------------------------------------
async function asset(env, request, path) {
  const base = new URL(request.url);
  let res = await env.ASSETS.fetch(new Request(new URL(path, base).toString(), { method: 'GET' }));
  if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
    res = await env.ASSETS.fetch(new Request(new URL(res.headers.get('location'), base).toString(), { method: 'GET' }));
  }
  const h = new Headers(res.headers);
  h.set('cache-control', 'no-store');
  h.set('x-robots-tag', 'noindex, nofollow');
  h.set('referrer-policy', 'no-referrer');
  return new Response(res.body, { status: res.status, headers: h });
}

export async function handleOnboarding(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const seg = path.split('/').filter(Boolean); // ['onboarding', ...]

  if (seg[1] === 'api') {
    if (!env.MEDIA) return out({ error: 'storage is not configured' }, 500);
    if (seg[2] === 'admin') return adminApi(request, env, seg[3] || '');
    if (seg[2] === 'file') return serveFile(request, env);
    if (seg[2] === 's') {
      if (await limited(request, env)) return out({ error: 'Too many requests. Please wait a minute and try again.' }, 429);
      return clientApi(request, env, ctx, seg[3] || '', seg[4] || '');
    }
    return out({ error: 'not found' }, 404);
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('method not allowed', { status: 405 });
  if (seg.length === 2 && seg[1] === 'admin') return asset(env, request, '/onboarding/admin');
  if (seg.length === 2 && TOKEN.test(seg[1])) {
    if (await limited(request, env)) return new Response('Too many requests. Please wait a minute and try again.', { status: 429 });
    return asset(env, request, '/onboarding/form');
  }
  return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
}
