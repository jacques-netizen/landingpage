// Client onboarding emails, run from the onboarding admin page and the Worker
// cron. Clients pay before they get the onboarding link, so there is no
// invoice or payment email.
//
//   Every offer:
//     Welcome           link created               sends by itself when the link is created
//                                                  (first name + email given), admin can resend.
//                                                  One template per offer in lib/questions.js
//     Form reminder     form still empty           cron sends 24h after the welcome, once
//   Clipping only:
//     Campaign live     campaign opens             admin sends
//     Weekly check-in   campaign running           cron flags it every 7 days, admin sends
//     Campaign complete final check, payouts sent  admin sends, ends the weekly emails
//
// The confirmation after the client submits (with the booking link) is sent
// by lib/onboarding.js from the offer's template.
//
// Every email is rendered here, server side, from the link record's `seq`
// fields, so the admin preview and the email that goes out are the same thing.
// An email never sends while a field it needs is empty, so nothing in
// [brackets] can reach a client.
//
// Stored on the link record (onboarding/links/<token>.json) as `seq`:
//   fields   values typed in the admin page (first name, report link, ...)
//   sent     { welcome, reminder, live, complete } ISO times (older records may also hold invoice, payment)
//   weekly   [{ n, at, views, clips }] one row per weekly email sent
//   weekly_due       ISO time the next weekly email is due
//   weekly_flagged   week number the team was last pinged about
//   errors   { <step>: { at, reason } } the last failed send per email, shown in admin
import { loadLink, saveLink, loadSettings, sendEmail, emailShell, button, esc, formUrl, adminUrl, clientEmail, clientName, isEmail, LINKS, renderTemplate, templateVars } from './onboarding.js';
import { EMAILS } from './questions.js';
import { handleCampaign } from './handlers.js';

const DAY = 24 * 60 * 60 * 1000;
const now = () => new Date().toISOString();
const clean = (v, max = 600) => String(v == null ? '' : v).replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(/[\u0000-\u001f]/g, ' ').slice(0, max).trim();
const isUrl = (v) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v || '');

const ALL_STEPS = [
  { id: 'welcome', name: 'Welcome', trigger: 'Onboarding link created', timing: 'Sends by itself' },
  { id: 'reminder', name: 'Form reminder', trigger: 'Onboarding form not completed', timing: '24 hours after the welcome' },
  { id: 'live', name: 'Campaign live', trigger: 'Campaign opens to clippers', timing: 'Launch day', offers: ['clipping'] },
  { id: 'weekly', name: 'Weekly check-in', trigger: 'Campaign running', timing: 'Every 7 days until complete', offers: ['clipping'] },
  { id: 'complete', name: 'Campaign complete', trigger: 'Final check done, payouts sent', timing: 'Within 2 days of the last payout', offers: ['clipping'] },
];
// The emails that apply to this record's offer, numbered in order.
export const stepsFor = (rec) => ALL_STEPS.filter((st) => !st.offers || st.offers.includes(rec.offer || 'clipping')).map((st, i) => ({ ...st, n: i + 1 }));

// Fields the admin can type, with the email(s) that use them.
const FIELDS = {
  first_name: 120, email: 200, campaign: 160,
  report_url: 500, first_clips: 40,
  views: 40, clips: 20, best_url: 500, best_views: 40, working: 600,
  final_views: 40, final_clips: 20, top_url: 500, top_views: 40, worked: 600,
};

function seqOf(rec) {
  const s = rec.seq && typeof rec.seq === 'object' ? rec.seq : {};
  s.fields = s.fields && typeof s.fields === 'object' ? s.fields : {};
  s.sent = s.sent && typeof s.sent === 'object' ? s.sent : {};
  s.weekly = Array.isArray(s.weekly) ? s.weekly : [];
  s.errors = s.errors && typeof s.errors === 'object' ? s.errors : {};
  rec.seq = s;
  return s;
}

// Defaults the record already knows, under what the admin typed.
function fieldsOf(env, rec) {
  const s = seqOf(rec);
  const a = rec.answers || {};
  const f = { ...s.fields };
  if (!f.campaign) f.campaign = a.q1 && a.q1 !== rec.client_name ? a.q1 : rec.campaign_name;
  if (!f.email) f.email = clientEmail(a);
  if (!f.first_name && clientName(a)) f.first_name = String(clientName(a)).split(/\s+/)[0];
  if (!f.report_url && rec.campaign_id) f.report_url = 'https://campaigns.maisondelites.com/' + rec.campaign_id;
  if (!f.first_clips) f.first_clips = '3 to 5';
  return f;
}

// Who gets the email: the client's address, plus (from the live email on) the
// people the form named for campaign updates and reports.
function recipients(rec, f, stepId) {
  const a = rec.answers || {};
  const extra = ['live', 'weekly', 'complete'].includes(stepId)
    ? [...(a.q5 || []).map((p) => p && p.email), ...(a.q18 || [])]
    : [];
  return [...new Set([f.email, clientEmail(a), ...extra].map((x) => String(x || '').trim().toLowerCase()).filter(isEmail))].slice(0, 50);
}

// ---- Rendering ------------------------------------------------------------
const P = (t) => '<p style="font:400 16px/1.6 Georgia,serif;color:#3a3226;margin:0 0 16px;">' + t + '</p>';
const UL = (items, ordered) => '<' + (ordered ? 'ol' : 'ul') + ' style="font:400 16px/1.6 Georgia,serif;color:#3a3226;margin:0 0 16px;padding-left:22px;">'
  + items.map((i) => '<li style="margin:0 0 8px;">' + i + '</li>').join('') + '</' + (ordered ? 'ol' : 'ul') + '>';
const B = (t) => '<b style="color:#221d15;">' + t + '</b>';
const A = (href, label) => '<a href="' + esc(href) + '" style="color:#9a7b36;">' + esc(label || href) + '</a>';
const BTN = (href, label) => '<div style="margin:4px 0 20px;">' + button(href, label) + '</div>';
const SIGN_HTML = P('Kind regards,<br>Jacques<br>Founder, Maison d’Élites');
const SIGN_TEXT = 'Kind regards,\nJacques\nFounder, Maison d’Élites';
const num = (v) => { const n = Number(String(v || '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };
const fmtNum = (v) => { const n = num(v); return n ? Math.round(n).toLocaleString('en-US') : String(v || ''); };

// Each step returns what it needs, the subject, the HTML body, the plain text
// body and the short version for WhatsApp or DMs.
function build(stepId, env, rec, f, extra) {
  const e = (k) => esc(f[k] || '');
  const t = (k) => String(f[k] || '');
  const form = formUrl(env, rec.token);
  switch (stepId) {
    case 'welcome': {
      // The offer's template from lib/questions.js, with the form link as the button.
      const r = renderTemplate(EMAILS.welcome[rec.offer] || EMAILS.welcome.clipping, { ...templateVars(rec), first_name: t('first_name') || 'there', campaign: t('campaign') || templateVars(rec).campaign }, form);
      return { need: ['email'], subject: r.subject, html: r.html, text: r.text, short: r.short };
    }
    case 'reminder': return {
      need: ['email'],
      subject: 'Quick one before we get started',
      html: P('Hi ' + (e('first_name') || 'there') + ',')
        + P('Just a nudge on the onboarding form. It is the one thing we need from you before we can get started:')
        + BTN(form, 'Open the onboarding form')
        + P('If it’s easier, send me the content links and goals here and we’ll fill it in for you.') + SIGN_HTML,
      text: 'Hi ' + (t('first_name') || 'there') + ',\n\nJust a nudge on the onboarding form. It is the one thing we need from you before we can get started:\n' + form + '\n\n'
        + 'If it’s easier, send me the content links and goals here and we’ll fill it in for you.\n\n' + SIGN_TEXT,
      short: 'Hi ' + (t('first_name') || 'there') + ', quick nudge on the onboarding form, it’s the last thing we need to set everything up: ' + form + '. Or just send me the content links here and we’ll handle it.',
    };
    case 'live': return {
      need: ['first_name', 'email', 'campaign', 'report_url', 'first_clips'],
      subject: t('campaign') + ' is live',
      html: P('Hi ' + e('first_name') + ',')
        + P(e('campaign') + ' is now live with our clipper network.')
        + P('Your live report is here:') + BTN(t('report_url'), 'Open your live report')
        + P('It updates on its own, so you can check views and posted clips whenever you like. Every clip is checked by our team before it counts, so what you see on the report is what made it through.')
        + P('What to expect:')
        + UL(['The first clips usually start appearing within ' + e('first_clips') + ' days.', 'Views build over the following weeks as more clips go up.', 'We send you a short update every week until the campaign is complete.'])
        + P('If you see a clip you’d like adjusted or taken down, just reply here.') + SIGN_HTML,
      text: 'Hi ' + t('first_name') + ',\n\n' + t('campaign') + ' is now live with our clipper network.\n\nYour live report is here:\n' + t('report_url') + '\n\n'
        + 'It updates on its own, so you can check views and posted clips whenever you like. Every clip is checked by our team before it counts, so what you see on the report is what made it through.\n\n'
        + 'What to expect:\n- The first clips usually start appearing within ' + t('first_clips') + ' days.\n- Views build over the following weeks as more clips go up.\n- We send you a short update every week until the campaign is complete.\n\n'
        + 'If you see a clip you’d like adjusted or taken down, just reply here.\n\n' + SIGN_TEXT,
      short: 'Hi ' + t('first_name') + ', ' + t('campaign') + ' is live. Here’s your live report, it updates by itself: ' + t('report_url') + '. First clips usually land within ' + t('first_clips') + ' days, and we’ll update you every week.',
    };
    case 'weekly': {
      const n = extra.week;
      return {
        need: ['first_name', 'email', 'campaign', 'views', 'clips', 'best_url', 'best_views', 'working', 'report_url'],
        subject: t('campaign') + ', week ' + n + ' update',
        html: P('Hi ' + e('first_name') + ',')
          + P('Here is where ' + e('campaign') + ' stands after week ' + n + ':')
          + UL(['Total views: ' + esc(fmtNum(f.views)), 'Clips posted: ' + esc(fmtNum(f.clips)), 'Best clip so far: ' + A(t('best_url'), 'watch it') + ', ' + esc(fmtNum(f.best_views)) + ' views'])
          + P(e('working'))
          + P('The full breakdown is always on your live report: ' + A(t('report_url'))) + SIGN_HTML,
        text: 'Hi ' + t('first_name') + ',\n\nHere is where ' + t('campaign') + ' stands after week ' + n + ':\n'
          + '- Total views: ' + fmtNum(f.views) + '\n- Clips posted: ' + fmtNum(f.clips) + '\n- Best clip so far: ' + t('best_url') + ', ' + fmtNum(f.best_views) + ' views\n\n'
          + t('working') + '\n\nThe full breakdown is always on your live report: ' + t('report_url') + '\n\n' + SIGN_TEXT,
        short: 'Week ' + n + ' update for ' + t('campaign') + ': ' + fmtNum(f.views) + ' views from ' + fmtNum(f.clips) + ' clips so far. Best one is here: ' + t('best_url') + '. Full report: ' + t('report_url'),
      };
    }
    case 'complete': return {
      need: ['first_name', 'email', 'campaign', 'final_views', 'final_clips', 'top_url', 'top_views', 'worked', 'report_url'],
      subject: t('campaign') + ' is complete',
      html: P('Hi ' + e('first_name') + ',')
        + P(e('campaign') + ' has wrapped. The full budget has now gone out to clippers after our final check of every clip.')
        + P('Final results:')
        + UL(['Total views: ' + esc(fmtNum(f.final_views)), 'Clips posted: ' + esc(fmtNum(f.final_clips)), 'Top clip: ' + A(t('top_url'), 'watch it') + ', ' + esc(fmtNum(f.top_views)) + ' views'])
        + P('Your live report stays up, so you can go back to it any time: ' + A(t('report_url')))
        + P('Thank you for building this with us. Two quick things:')
        + UL(['If you were happy with the campaign, a few lines about your experience would mean a lot to us. Just reply to this email.',
          e('worked') + ' If you’d like to build on that, we can have the next campaign ready to go whenever you are.'], true)
        + SIGN_HTML,
      text: 'Hi ' + t('first_name') + ',\n\n' + t('campaign') + ' has wrapped. The full budget has now gone out to clippers after our final check of every clip.\n\nFinal results:\n'
        + '- Total views: ' + fmtNum(f.final_views) + '\n- Clips posted: ' + fmtNum(f.final_clips) + '\n- Top clip: ' + t('top_url') + ', ' + fmtNum(f.top_views) + ' views\n\n'
        + 'Your live report stays up, so you can go back to it any time: ' + t('report_url') + '\n\nThank you for building this with us. Two quick things:\n'
        + '1. If you were happy with the campaign, a few lines about your experience would mean a lot to us. Just reply to this email.\n'
        + '2. ' + t('worked') + ' If you’d like to build on that, we can have the next campaign ready to go whenever you are.\n\n' + SIGN_TEXT,
      short: 'Hi ' + t('first_name') + ', ' + t('campaign') + ' is complete: ' + fmtNum(f.final_views) + ' views from ' + fmtNum(f.final_clips) + ' clips. Report stays live here: ' + t('report_url') + '. If you were happy, a few lines about your experience would mean a lot. And if you want to build on it, we can line up the next one whenever you’re ready.',
    };
  }
  return null;
}

const LABEL = {
  first_name: 'First name', email: 'Client email', campaign: 'Campaign name',
  report_url: 'Live report link', first_clips: 'Days until first clips', views: 'Total views', clips: 'Clips posted',
  best_url: 'Best clip link', best_views: 'Best clip views', working: 'What is working', final_views: 'Final views',
  final_clips: 'Final clips posted', top_url: 'Top clip link', top_views: 'Top clip views', worked: 'What worked',
};

// Order rules: each email waits for the one before it, the weekly emails run
// between live and complete. Clients have already paid when they get the link.
function blockedBy(stepId, rec) {
  const s = seqOf(rec);
  const sent = s.sent;
  if (!stepsFor(rec).some((st) => st.id === stepId)) return 'This email isn’t used for ' + (rec.offer || 'this offer') + '.';
  switch (stepId) {
    case 'welcome': return '';
    case 'reminder':
      if (!sent.welcome) return 'Send the welcome email first.';
      if (rec.status === 'submitted') return 'The client has submitted the form.';
      return '';
    case 'live': return sent.welcome ? '' : 'Send the welcome email first.';
    case 'weekly':
      if (!sent.live) return 'Send the campaign live email first.';
      if (sent.complete) return 'The campaign is complete.';
      return '';
    case 'complete': return sent.live ? (sent.complete ? 'Already sent.' : '') : 'Send the campaign live email first.';
  }
  return 'Unknown email.';
}

function render(stepId, env, rec, overrides) {
  const s = seqOf(rec);
  const f = { ...fieldsOf(env, rec), ...(overrides || {}) };
  const week = s.weekly.length + 1;
  const out = build(stepId, env, rec, f, { week });
  if (!out) return null;
  const missing = out.need.filter((k) => !String(f[k] || '').trim());
  const bad = [];
  if (f.email && !isEmail(f.email)) bad.push('Client email');
  for (const k of ['report_url', 'best_url', 'top_url']) if (out.need.includes(k) && f[k] && !isUrl(f[k])) bad.push(LABEL[k]);
  const step = ALL_STEPS.find((x) => x.id === stepId);
  const eyebrow = stepId === 'welcome' ? 'Welcome' : step.name;
  return {
    step: stepId,
    week: stepId === 'weekly' ? week : undefined,
    subject: out.subject,
    html: emailShell(eyebrow, out.html),
    text: out.text,
    short: out.short,
    to: recipients(rec, f, stepId),
    missing: missing.map((k) => LABEL[k] || k),
    invalid: bad,
    blocked: blockedBy(stepId, rec),
  };
}

// ---- Sending ----------------------------------------------------------------
const replyTo = (env) => String(env.ONBOARDING_REPLY_TO || env.ONBOARDING_NOTIFY_EMAIL || '').split(',').map((x) => x.trim()).filter(isEmail);

// Sends one email and records the outcome on the record: the sent time, or the
// reason it failed (shown in admin until a later send succeeds).
async function send(env, rec, stepId, overrides) {
  const res = await trySend(env, rec, stepId, overrides);
  const s = seqOf(rec);
  if (res.ok) delete s.errors[stepId];
  else s.errors[stepId] = { at: now(), reason: res.error };
  return res;
}

async function trySend(env, rec, stepId, overrides) {
  const r = render(stepId, env, rec, overrides);
  if (!r) return { ok: false, error: 'Unknown email.' };
  if (r.blocked) return { ok: false, error: r.blocked };
  if (r.missing.length) return { ok: false, error: 'Fill in: ' + r.missing.join(', ') + '.' };
  if (r.invalid.length) return { ok: false, error: 'Check: ' + r.invalid.join(', ') + '.' };
  if (!r.to.length) return { ok: false, error: 'Add the client’s email address.' };
  const payload = { to: r.to, subject: r.subject, html: r.html, text: r.text };
  const rt = replyTo(env);
  if (rt.length) payload.reply_to = rt;
  const res = await sendEmail(env, payload);
  if (!res.sent) return { ok: false, error: 'The email did not send: ' + (res.reason || ('status ' + res.status)) };
  const s = seqOf(rec);
  const at = now();
  if (stepId === 'weekly') {
    const f = { ...fieldsOf(env, rec), ...(overrides || {}) };
    s.weekly.push({ n: r.week, at, views: f.views, clips: f.clips });
    s.weekly_due = new Date(Math.max(Date.parse(s.weekly_due || at), Date.now() - DAY) + 7 * DAY).toISOString();
    // The next week's numbers start fresh.
    for (const k of ['views', 'clips', 'best_url', 'best_views', 'working']) delete s.fields[k];
  } else {
    s.sent[stepId] = at;
  }
  if (stepId === 'live') s.weekly_due = new Date(Date.now() + 7 * DAY).toISOString();
  if (stepId === 'complete') s.weekly_due = null;
  return { ok: true, at, to: r.to };
}

// The welcome on link creation. Skipped (not an error) when admin left out the
// email: the link is then sent by hand. No first name greets with "Hi there".
export async function autoWelcome(env, rec) {
  const f = fieldsOf(env, rec);
  if (!isEmail(f.email)) return { sent: false, skipped: 'No email, so the link wasn’t emailed. Send it yourself.' };
  const r = await send(env, rec, 'welcome');
  return r.ok ? { sent: true, to: r.to } : { sent: false, error: r.error };
}

// ---- Campaign numbers -------------------------------------------------------
// Prefills the weekly and final emails from the campaign dashboard data
// (campaigns.maisondelites.com/<campaign_id>) when the link is tied to one.
async function campaignNumbers(env, rec) {
  if (!rec.campaign_id) return null;
  try {
    const res = await handleCampaign(new Request('https://internal/api/campaign?client=' + encodeURIComponent(rec.campaign_id)), env);
    const d = await res.json();
    const s = d.summary || {};
    const clips = Array.isArray(d.clips) ? d.clips.filter((c) => c && c.url && c.status !== 'rejected') : [];
    const best = clips.slice().sort((a, b) => (b.views || 0) - (a.views || 0))[0];
    if (!s.views && !clips.length) return null;
    return { views: s.views || 0, clips: s.clips || clips.length, best_url: best ? best.url : '', best_views: best ? best.views || 0 : 0 };
  } catch (e) {
    return null;
  }
}

// ---- Admin API (/onboarding/api/admin/sequence?token=...) --------------------
export async function sequenceState(env, rec) {
  const s = seqOf(rec);
  const steps = stepsFor(rec).map((st) => {
    const r = render(st.id, env, rec);
    return {
      ...st,
      sent_at: st.id === 'weekly' ? (s.weekly.length ? s.weekly[s.weekly.length - 1].at : null) : s.sent[st.id] || null,
      blocked: r.blocked,
      missing: r.missing,
    };
  });
  return {
    fields: fieldsOf(env, rec),
    sent: s.sent,
    weekly: s.weekly,
    weekly_due: s.weekly_due || null,
    errors: s.errors,
    auto_reminder_at: s.sent.welcome && !s.sent.reminder && rec.status !== 'submitted' ? new Date(Date.parse(s.sent.welcome) + DAY).toISOString() : null,
    steps,
    numbers: await campaignNumbers(env, rec),
    labels: LABEL,
  };
}

// A short line for the links list: the next email that needs doing.
export function nextStep(rec, env) {
  const s = seqOf(rec);
  // A failed send comes first, with Resend's reason, so it can't be missed.
  const failed = stepsFor(rec).find((st) => st.id !== 'weekly' && !s.sent[st.id] && s.errors[st.id]);
  if (failed) return { label: failed.name + ' failed to send', error: true, reason: s.errors[failed.id].reason };
  if (!s.sent.welcome && rec.status !== 'submitted') {
    if (env && !isEmail(fieldsOf(env, rec).email)) return { label: 'No email: send the link yourself' };
    return { label: 'Next: Welcome', due: true };
  }
  if (rec.status !== 'submitted') return { label: 'Welcome sent, waiting for the form' };
  if ((rec.offer || 'clipping') !== 'clipping') return { label: 'Form in', done: true };
  if (s.sent.complete) return { label: 'Complete', done: true };
  if (s.sent.live) {
    const due = s.weekly_due && Date.parse(s.weekly_due) <= Date.now();
    return { label: due ? 'Weekly check-in due' : 'Running, week ' + (s.weekly.length + 1), due: !!due };
  }
  return { label: 'Next: Campaign live', due: true };
}

export async function sequenceApi(request, env, rec) {
  const method = request.method.toUpperCase();
  if (method === 'GET') return { ok: true, sequence: await sequenceState(env, rec) };
  if (method !== 'POST') return { ok: false, status: 405, error: 'method not allowed' };
  let body = {};
  try { body = await request.json(); } catch (e) { return { ok: false, status: 400, error: 'invalid JSON body' }; }
  const s = seqOf(rec);
  // Fields typed in the page are saved on every call, so nothing is lost.
  if (body.fields && typeof body.fields === 'object') {
    for (const k of Object.keys(FIELDS)) {
      if (k in body.fields) {
        const v = clean(body.fields[k], FIELDS[k]);
        if (v) s.fields[k] = v; else delete s.fields[k];
      }
    }
  }
  const step = stepsFor(rec).find((x) => x.id === body.step);
  let result = { ok: true };
  if (body.action === 'preview') {
    if (!step) return { ok: false, status: 400, error: 'bad step' };
    await saveLink(env, rec);
    return { ok: true, preview: render(step.id, env, rec), sequence: await sequenceState(env, rec) };
  }
  if (body.action === 'send') {
    if (!step) return { ok: false, status: 400, error: 'bad step' };
    result = await send(env, rec, step.id);
    await saveLink(env, rec);
    if (!result.ok) return { ok: false, status: 422, error: result.error, sequence: await sequenceState(env, rec) };
    return { ok: true, sent: result, sequence: await sequenceState(env, rec) };
  }
  if (body.action === 'mark') {
    // For an email that went out another way (WhatsApp, a reply thread): record it
    // as done so the sequence moves on without sending anything.
    if (!step || step.id === 'weekly') return { ok: false, status: 400, error: 'bad step' };
    const blocked = blockedBy(step.id, rec);
    if (blocked && step.id !== 'reminder') return { ok: false, status: 422, error: blocked };
    s.sent[step.id] = now();
    delete s.errors[step.id];
    if (step.id === 'live') s.weekly_due = new Date(Date.now() + 7 * DAY).toISOString();
    if (step.id === 'complete') s.weekly_due = null;
  }
  await saveLink(env, rec);
  return { ok: true, sequence: await sequenceState(env, rec) };
}

// ---- Cron ---------------------------------------------------------------------
// Runs with the Worker's 15-minute cron:
//  - sends the form reminder 24 hours after the welcome if the form is still not submitted
//  - pings the team (Discord + email) when a weekly check-in is due, once per week
async function pingTeam(env, rec, line) {
  const url = adminUrl(env, rec.token);
  const jobs = [];
  if (env.ONBOARDING_DISCORD_WEBHOOK) {
    jobs.push(fetch(env.ONBOARDING_DISCORD_WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: '📬 ' + line + '\n' + url, allowed_mentions: { parse: [] } }) }).catch(() => null));
  }
  const to = String(env.ONBOARDING_NOTIFY_EMAIL || '').split(',').map((x) => x.trim()).filter(isEmail);
  if (to.length) {
    jobs.push(sendEmail(env, { to, subject: line, html: emailShell('Client emails', P(esc(line)) + BTN(url, 'Open in the admin page')), text: line + '\n\n' + url }));
  }
  await Promise.all(jobs);
}

export async function runSequence(env) {
  if (!env.MEDIA) return;
  await loadSettings(env, true);
  let cursor;
  do {
    const page = await env.MEDIA.list({ prefix: LINKS, cursor });
    for (const o of page.objects) {
      const token = o.key.slice(LINKS.length).replace(/\.json$/, '');
      const rec = await loadLink(env, token);
      if (!rec || !rec.seq) continue;
      const s = seqOf(rec);
      let changed = false;
      // 3. Form reminder
      if (s.sent.welcome && !s.sent.reminder && rec.status !== 'submitted' && Date.now() - Date.parse(s.sent.welcome) >= DAY) {
        const hadError = !!s.errors.reminder;
        const r = await send(env, rec, 'reminder');
        changed = true;
        // Ping the team once when it starts failing; it retries every run.
        if (!r.ok && !hadError) await pingTeam(env, rec, 'Form reminder for ' + rec.client_name + ' could not send: ' + r.error);
      }
      // 6. Weekly check-in due
      if (s.sent.live && !s.sent.complete && s.weekly_due && Date.parse(s.weekly_due) <= Date.now()) {
        const week = s.weekly.length + 1;
        if (s.weekly_flagged !== week) {
          s.weekly_flagged = week;
          changed = true;
          await pingTeam(env, rec, 'Week ' + week + ' check-in for ' + (fieldsOf(env, rec).campaign || rec.client_name) + ' is due');
        }
      }
      if (changed) await saveLink(env, rec);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
