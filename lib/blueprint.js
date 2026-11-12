// The Athlete Income Blueprint opt-in (Chris Bak, Run It Bak). Settings: lib/blueprint-config.js.
//
// Same order as the Maison d'Élites guide funnel: the lead is saved FIRST
// (R2, MEDIA bucket), then the background jobs run: delivery email (Resend),
// ManyChat tag on the DM contact (when the link carried ?mc=), and optional
// pings to Chris (email, Discord). A failed job never loses the lead and never
// shows the visitor an error.
import { json, isAuthed } from './auth.js';
import { BLUEPRINT as C, SECRET_NAMES as S, publicConfig } from './blueprint-config.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const txt = (v, max = 120) => String(v == null ? '' : v).normalize('NFKC').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const param = (v, max = 64) => String(v == null ? '' : v).replace(/[^\p{L}\p{N}_.\-@ ]/gu, '').trim().slice(0, max);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function cleanPhone(cc, num) {
  const d = (String(cc || '') + String(num || '')).replace(/[^\d]/g, '');
  return d.length >= 8 && d.length <= 16 ? '+' + d : '';
}

export async function handleBlueprintApi(request, env, ctx) {
  const path = new URL(request.url).pathname;
  if (path === '/api/blueprint/config') return json(publicConfig());
  if (path === '/api/blueprint/lead') return lead(request, env, ctx);
  if (path === '/api/blueprint/leads') return list(request, env);
  return json({ error: 'not found' }, 404);
}

async function lead(request, env, ctx) {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (env.ONBOARDING_LIMITER) {
    try {
      const ip = request.headers.get('CF-Connecting-IP') || 'local';
      const { success } = await env.ONBOARDING_LIMITER.limit({ key: 'blueprint:' + ip });
      if (!success) return json({ error: 'rate_limited' }, 429);
    } catch (e) { /* limiter unavailable: carry on */ }
  }
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }
  if (txt(b.website)) return json({ ok: true }); // honeypot: bots fill the hidden field

  const rec = {
    first_name: txt(b.first, 60),
    last_name: txt(b.last, 60),
    email: txt(b.email, 160).toLowerCase(),
    phone: cleanPhone(b.cc, b.phone),
    source: {},
    consent_version: C.consentVersion,
    created_at: new Date().toISOString(),
    jobs: {},
  };
  for (const k of ['src', 'mc', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const v = param(b[k]); if (v) rec.source[k] = v;
  }
  if (!rec.first_name || !rec.last_name) return json({ error: 'name' }, 422);
  if (!EMAIL.test(rec.email)) return json({ error: 'email' }, 422);
  if (!rec.phone) return json({ error: 'phone' }, 422);

  // 1) Save first. Nothing else matters if this fails.
  if (!env.MEDIA) return json({ error: 'storage' }, 500);
  const key = C.storagePrefix + rec.created_at.replace(/[:.]/g, '-') + '-' + Math.random().toString(36).slice(2, 8) + '.json';
  try {
    await env.MEDIA.put(key, JSON.stringify(rec), { httpMetadata: { contentType: 'application/json' } });
  } catch (e) {
    return json({ error: 'storage' }, 500);
  }

  // 2) Jobs in the background, results written back onto the record.
  const jobs = (async () => {
    const [email, manychat, notify] = await Promise.all([
      safe(() => sendDelivery(env, rec)),
      safe(() => tagManychat(env, rec)),
      safe(() => notifyChris(env, rec)),
    ]);
    rec.jobs = { email, manychat, notify, at: new Date().toISOString() };
    try { await env.MEDIA.put(key, JSON.stringify(rec), { httpMetadata: { contentType: 'application/json' } }); } catch (e) {}
  })();
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(jobs); else await jobs;

  return json({ ok: true });
}

async function safe(fn) {
  try { return await fn(); } catch (e) { return 'failed: ' + String((e && e.message) || e).slice(0, 160); }
}

function deliveryEmail(rec) {
  // Same look as the PDF: black, panels #161616, yellow #F2B705, heavy capitals, mono labels.
  // Web-safe fallbacks only (email clients do not load web fonts reliably).
  const url = C.leadMagnetUrl;
  const ig = '@' + C.instagramHandle;
  const name = (C.leadMagnetName || '').toUpperCase();
  const text = [
    `Hey ${rec.first_name}, Chris here.`,
    '',
    `Here's your prompt: ${name}`,
    '',
    `Open it: ${url}`,
    '',
    'How to use it:',
    '01 Open Claude. claude.ai or the app. A free account works.',
    '02 Paste the prompt. Copy the whole block on pages 3 to 5 and send it as your first message.',
    '03 Answer precisely. Plain language, real numbers. Do not move on until each stage is confirmed.',
    '',
    'Set aside 20-30 minutes of focused time. Do not run this while multitasking through a gym session.',
    '',
    `When Claude gives you your offer, reply to this email and tell me what it landed on. If you want help implementing it, message me on Instagram at ${ig}.`,
    '',
    'Chris',
  ].join('\n');
  const mono = "font-family:'DejaVu Sans Mono',Menlo,Consolas,monospace";
  const heavy = "font-family:'Archivo Black','Arial Black',Arial,sans-serif";
  const sans = "font-family:Inter,Helvetica,Arial,sans-serif";
  const p = (s, c = '#8A8A8A') => `<p style="margin:0 0 16px;${sans};font-size:16px;line-height:1.6;color:${c}">${s}</p>`;
  const k = (s) => `<div style="margin:0 0 8px;${mono};font-size:12px;color:#F2B705">${s}</div>`;
  const btn = (href, label) => `<a href="${esc(href)}" style="display:inline-block;padding:15px 24px;background:#F2B705;color:#0D0D0D;${heavy};font-size:15px;text-transform:uppercase;text-decoration:none">${esc(label)}</a>`;
  const step = (n, h, d) => `<tr><td style="padding:0 0 14px 16px;border-left:4px solid #F2B705">${k(n)}<div style="${heavy};font-size:16px;color:#FFFFFF;text-transform:uppercase">${h}</div><div style="${sans};font-size:15px;line-height:1.5;color:#8A8A8A">${d}</div></td></tr><tr><td style="height:14px"></td></tr>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(C.emailSubject)}</title></head>
<body style="margin:0;background:#0D0D0D"><div style="display:none;max-height:0;overflow:hidden">Here's your prompt. 5 stages, 20-30 minutes, a free Claude account works.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;border-top:6px solid #F2B705"><tr><td align="center" style="padding:36px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px">
<tr><td>${k('// A FREE CLAUDE PROMPT BY CHRIS BAK')}</td></tr>
<tr><td style="padding:0 0 22px;${heavy};font-size:34px;line-height:1;color:#FFFFFF;text-transform:uppercase">The Athlete<br>Income<br><span style="color:#F2B705">Blueprint</span></td></tr>
<tr><td>${p(`Hey ${esc(rec.first_name)}, Chris here.`, '#FFFFFF')}${p("Here's your prompt. It turns Claude into an interviewer that pulls out what your career taught you, shapes it into one high-ticket digital offer, and gives you 20 reel topics to reach the people who would buy it.")}</td></tr>
<tr><td style="padding:2px 0 30px">${btn(url, 'Open the blueprint')}</td></tr>
<tr><td>${k('// HOW TO USE IT')}</td></tr>
<tr><td style="padding-top:6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${step('01', 'Open Claude', 'claude.ai or the app. A free account works.')}
${step('02', 'Paste the prompt', 'Copy the whole block on pages 3 to 5 and send it as your first message.')}
${step('03', 'Answer precisely', 'Plain language, real numbers. Do not move on until each stage is confirmed.')}
</table></td></tr>
<tr><td style="padding:4px 0 26px"><div style="padding:14px 16px;background:#161616;border:1px solid #2A2A2A;border-left:4px solid #F2B705;${sans};font-size:14px;line-height:1.5;color:#8A8A8A">Set aside 20-30 minutes of focused time. Do not run this while multitasking through a gym session.</div></td></tr>
<tr><td>${p('When Claude gives you your offer, reply to this email and tell me what it landed on.')}${p(`If you want help implementing it, message me on Instagram at <span style="color:#FFFFFF">${esc(ig)}</span>.`)}</td></tr>
<tr><td style="padding:2px 0 28px">${btn(C.instagramDmUrl, 'DM ' + ig)}</td></tr>
<tr><td>${p('Chris', '#FFFFFF')}</td></tr>
<tr><td style="padding-top:22px;border-top:1px solid #2A2A2A;${mono};font-size:11px;line-height:1.6;color:#8A8A8A">ATHLETE_INCOME_BLUEPRINT v1.0 | ${esc(ig)}<br>You asked for this prompt on the page. Reply "stop" and you will not hear from me again.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: C.emailSubject, text, html };
}

async function sendDelivery(env, rec) {
  const key = env[S.resendKey];
  if (!key) return 'skipped: no email key';
  const m = deliveryEmail(rec);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json', 'idempotency-key': 'bp-' + rec.created_at + rec.email },
    body: JSON.stringify({ from: env[S.emailFrom] || C.emailFrom, to: [rec.email], reply_to: env[S.replyTo] || C.emailReplyTo || undefined, subject: m.subject, html: m.html, text: m.text }),
  });
  return r.ok ? 'sent' : 'failed: ' + r.status;
}

async function manychat(token, path, body) {
  const r = await fetch('https://api.manychat.com/fb' + path, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.status !== 'success') throw new Error(path + ' ' + r.status + ' ' + (d.message || ''));
}

async function tagManychat(env, rec) {
  const token = env[S.manychatToken];
  const id = rec.source.mc || '';
  if (!token) return 'skipped: no token';
  if (!/^\d{1,30}$/.test(id)) return 'skipped: no contact id in link';
  await manychat(token, '/subscriber/addTagByName', { subscriber_id: id, tag_name: C.manychatTag });
  const fields = { [C.manychatEmailField]: rec.email, [C.manychatPhoneField]: rec.phone };
  for (const [field_name, field_value] of Object.entries(fields)) {
    if (!field_name) continue;
    await manychat(token, '/subscriber/setCustomFieldByName', { subscriber_id: id, field_name, field_value }).catch(() => {});
  }
  return 'tagged';
}

async function notifyChris(env, rec) {
  const line = `New blueprint sign-up: ${rec.first_name} ${rec.last_name}, ${rec.email}, ${rec.phone}` + (rec.source.src ? `, from ${rec.source.src}` : '');
  const out = [];
  const hook = env[S.discordWebhook];
  if (hook) {
    const r = await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: line, allowed_mentions: { parse: [] } }) });
    out.push('discord ' + (r.ok ? 'sent' : r.status));
  }
  const to = env[S.notifyEmail];
  if (to && env[S.resendKey]) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env[S.resendKey], 'content-type': 'application/json' },
      body: JSON.stringify({ from: env[S.emailFrom] || C.emailFrom, to: to.split(',').map((s) => s.trim()).filter(Boolean), subject: 'New blueprint sign-up: ' + rec.first_name, text: line }),
    });
    out.push('email ' + (r.ok ? 'sent' : r.status));
  }
  return out.length ? out.join(', ') : 'skipped';
}

async function list(request, env) {
  if (!isAuthed(request, env)) return json({ error: 'unauthorized' }, 401);
  if (!env.MEDIA) return json({ error: 'storage' }, 500);
  const items = [];
  let cursor;
  do {
    const page = await env.MEDIA.list({ prefix: C.storagePrefix, limit: 1000, cursor });
    for (const o of page.objects || []) {
      const obj = await env.MEDIA.get(o.key);
      if (!obj) continue;
      try { items.push(JSON.parse(await obj.text())); } catch (e) {}
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (new URL(request.url).searchParams.get('format') === 'csv') {
    const cols = ['created_at', 'first_name', 'last_name', 'email', 'phone', 'src', 'mc', 'email_job', 'manychat_job'];
    const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = items.map((r) => [r.created_at, r.first_name, r.last_name, r.email, r.phone, r.source && r.source.src, r.source && r.source.mc, r.jobs && r.jobs.email, r.jobs && r.jobs.manychat].map(cell).join(','));
    return new Response([cols.join(','), ...rows].join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="blueprint-leads.csv"', 'cache-control': 'no-store' } });
  }
  return json({ ok: true, leads: items });
}
