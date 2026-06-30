// Shared request handlers used by BOTH the Worker entry (worker.js) and the
// Pages Functions (functions/*). One source of truth for the logic.
import { isAuthed, json } from './auth.js';
import { SLOT_KEYS, SLOTS } from './slots.js';
import { clipsFromCSV } from './csv.js';

const cleanText = (v) => String(v == null ? '' : v).replace(/`/g, '').slice(0, 400).trim();

function prettyLabel(s) {
  return String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Format a Cal.com webhook (BOOKING_CREATED) into a Discord message.
function calContent(body) {
  const p = body.payload || {};
  const att = (Array.isArray(p.attendees) && p.attendees[0]) || {};
  const resp = p.responses || {};
  const valOf = (r) => (r && typeof r === 'object' ? r.value : r);

  const name = att.name || valOf(resp.name) || '';
  const email = att.email || valOf(resp.email) || '';

  let when = '';
  try {
    if (p.startTime) {
      const d = new Date(p.startTime);
      when = att.timeZone
        ? d.toLocaleString('en-US', { timeZone: att.timeZone, dateStyle: 'full', timeStyle: 'short' }) + ` (${att.timeZone})`
        : d.toUTCString();
    }
  } catch (e) { if (p.startTime) when = String(p.startTime); }

  const lines = [];
  if (name) lines.push(`**👤 Name:** ${cleanText(name)}`);
  if (email) lines.push(`**✉️ Email:** ${cleanText(email)}`);
  if (when) lines.push(`**🗓️ When:** ${cleanText(when)}`);

  const shown = { name: 1, email: 1, guests: 1 };
  for (const k in resp) {
    if (shown[k]) continue;
    const r = resp[k];
    const label = (r && typeof r === 'object' && r.label) ? r.label : k;
    let v = valOf(r);
    if (Array.isArray(v)) v = v.join(', ');
    else if (v && typeof v === 'object') v = JSON.stringify(v);
    if (v !== undefined && v !== null && String(v).trim()) {
      lines.push(`**${prettyLabel(label)}:** ${cleanText(v)}`);
    }
  }
  return '📅 **New discovery call booked, call them now!**\n' + lines.join('\n');
}

// Format the custom-form payload ({ lead, incomplete }) into a Discord message.
function leadContent(lead, incomplete) {
  const rows = [
    ['👤 Name', lead.name],
    ['📞 Phone', lead.phone],
    ['✉️ Email', lead.email],
    ['🏷️ Business', lead.business],
    ['🔗 IG / Website', lead.link],
    ['🎯 6-month goal', lead.goal],
    ['💸 Invested before', lead.invested],
    ['💰 Budget', lead.budget],
    ['⏱️ Timeline', lead.timing],
    ['📝 Notes', lead.notes],
  ];
  const lines = rows.filter(([, v]) => cleanText(v)).map(([label, v]) => `**${label}:** ${cleanText(v)}`);
  const header = incomplete
    ? '📅 **New discovery call booked**. ⚠️ They left before finishing the details, so some fields may be missing. Reach them via email / calendar.'
    : '📅 **New discovery call booked, call them now!**';
  return header + '\n' + lines.join('\n') + '\n\nExact time is in your calendar.';
}

// ---- POST /api/notify : ping a Discord channel when someone books ----
// Accepts three shapes: a Cal.com webhook, our custom-form { lead }, or a plain { note }.
export async function handleNotify(request, env) {
  if (request.method.toUpperCase() !== 'POST') return json({ error: 'method not allowed' }, 405);
  const hook = env.DISCORD_WEBHOOK_URL;
  if (!hook) return json({ error: 'DISCORD_WEBHOOK_URL not configured' }, 500);

  let b = null;
  try { b = await request.json(); } catch (e) { /* no body is fine */ }

  // Cal.com webhook: only ping when a booking is actually created.
  if (b && (b.triggerEvent || b.payload)) {
    if (b.triggerEvent && b.triggerEvent !== 'BOOKING_CREATED') {
      return json({ ok: true, skipped: b.triggerEvent });
    }
  }

  let content;
  if (b && (b.triggerEvent || b.payload)) {
    content = calContent(b);
  } else if (b && b.lead && typeof b.lead === 'object') {
    content = leadContent(b.lead, !!b.incomplete);
  } else {
    const note = b && b.note ? cleanText(b.note) : '';
    content = '📅 **New discovery call booked!** Someone just scheduled through the site.'
      + (note ? ('\n' + note) : '')
      + '\nCheck your calendar for the details.';
  }

  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    return json({ ok: res.ok });
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) }, 502);
  }
}

// ---- Campaign dashboard data feed ------------------------------------------
// Public GET returns the live campaign JSON; authed POST overwrites it. The
// data lives as a single JSON object in the same R2 bucket used for media.
const CAMPAIGN_KEY = 'campaign-data.json';

// Shipped default so the dashboard renders beautifully before any data is
// saved, and so the editor has something to start from. Numbers are illustrative.
export function defaultCampaign() {
  return {
    client: 'Itzdanielmichael',
    campaign: 'Need You · Please Stay',
    tagline: 'Live distribution across our creator network',
    updated: null,
    summary: {
      views: 0,
      clips: 0,
      creators: 0,
      budgetTotal: 1000,
      budgetSpent: 0,
      spendKnown: false,
      guaranteeFloor: 0,
    },
    platforms: [
      { name: 'TikTok', views: 0 },
      { name: 'Instagram', views: 0 },
      { name: 'YouTube', views: 0 },
    ],
    clips: [],
    creators: [],
  };
}

// Keep stored data tidy and bounded so the feed stays small and safe.
function sanitizeCampaign(input) {
  const d = (input && typeof input === 'object') ? input : {};
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
  const str = (v, max = 400) => String(v == null ? '' : v).replace(/[`\u0000-\u001f]/g, '').slice(0, max).trim();
  const s = (d.summary && typeof d.summary === 'object') ? d.summary : {};

  const clips = Array.isArray(d.clips) ? d.clips.slice(0, 120).map((c) => ({
    title: str(c && c.title, 160),
    creator: str(c && c.creator, 80),
    platform: str(c && c.platform, 24).toLowerCase(),
    url: str(c && c.url, 1000),
    thumb: str(c && c.thumb, 1000),
    views: num(c && c.views),
    posted: str(c && c.posted, 40),
    featured: !!(c && c.featured),
  })) : [];

  const creators = Array.isArray(d.creators) ? d.creators.slice(0, 100).map((c) => ({
    handle: str(c && c.handle, 80),
    views: num(c && c.views),
    clips: num(c && c.clips),
  })) : [];

  const platforms = Array.isArray(d.platforms) ? d.platforms.slice(0, 12).map((p) => ({
    name: str(p && p.name, 40),
    views: num(p && p.views),
  })) : [];

  return {
    client: str(d.client, 120) || 'Client',
    campaign: str(d.campaign, 120) || 'Distribution Campaign',
    tagline: str(d.tagline, 200),
    updated: new Date().toISOString(),
    summary: {
      views: num(s.views),
      clips: num(s.clips),
      creators: num(s.creators),
      budgetTotal: num(s.budgetTotal),
      budgetSpent: num(s.budgetSpent),
      spendKnown: !!s.spendKnown,
      guaranteeFloor: num(s.guaranteeFloor),
    },
    platforms,
    clips,
    creators,
  };
}

export async function handleCampaign(request, env) {
  if (!env.MEDIA) return json({ error: 'storage not configured' }, 500);
  const method = request.method.toUpperCase();

  if (method === 'GET') {
    const obj = await env.MEDIA.get(CAMPAIGN_KEY);
    let data;
    if (obj) {
      try { data = JSON.parse(await obj.text()); } catch (e) { data = defaultCampaign(); }
    } else {
      data = defaultCampaign();
    }
    return new Response(JSON.stringify(data), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // Always fresh so the live dashboard polls real values, not a cached copy.
        'cache-control': 'no-store, max-age=0',
      },
    });
  }

  if (method === 'POST' || method === 'PUT') {
    if (!isAuthed(request, env)) return json({ error: 'unauthorized' }, 401);
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'invalid JSON body' }, 400); }
    const clean = sanitizeCampaign(body);
    await env.MEDIA.put(CAMPAIGN_KEY, JSON.stringify(clean), {
      httpMetadata: { contentType: 'application/json' },
    });
    return json({ ok: true, updated: clean.updated });
  }

  return json({ error: 'method not allowed' }, 405);
}

// Load the saved campaign (or the shipped default) as a plain object.
async function loadCampaign(env) {
  const obj = await env.MEDIA.get(CAMPAIGN_KEY);
  if (!obj) return defaultCampaign();
  try { return JSON.parse(await obj.text()); } catch (e) { return defaultCampaign(); }
}

const titleCase = (s) => String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());

// Turn a list of clips into a full campaign object: total views, clip count,
// platform split and creator leaderboard are all derived. Campaign metadata
// (client, budget, guarantee floor) is carried over from `base` unless
// overridden in `meta`.
export function deriveFromClips(clips, base, meta) {
  base = base || defaultCampaign();
  meta = meta || {};
  let views = 0;
  let earned = 0;
  const byPlat = {};
  const byCreator = {};
  for (const c of clips) {
    const v = Number(c.views) || 0;
    views += v;
    earned += Number(c.earnings) || 0;
    const p = c.platform || 'other';
    byPlat[p] = (byPlat[p] || 0) + v;
    if (c.creator) {
      const k = c.creator;
      byCreator[k] = byCreator[k] || { handle: k, views: 0, clips: 0 };
      byCreator[k].views += v;
      byCreator[k].clips += 1;
    }
  }
  const platforms = Object.keys(byPlat)
    .map((name) => ({ name: titleCase(name), views: byPlat[name] }))
    .sort((a, b) => b.views - a.views);
  const creators = Object.values(byCreator).sort((a, b) => b.views - a.views);
  const bs = base.summary || {};
  const pick = (a, b) => (a == null || a === '' ? b : a);

  // Spend is NEVER estimated. It is only reported when the CSV carried a real
  // per-clip earnings/reward column (summed here). Otherwise spendKnown is false
  // and the dashboard simply shows no spend figure.
  const spendKnown = earned > 0;
  const budgetSpent = spendKnown ? Math.round(earned * 100) / 100 : 0;

  return {
    client: pick(meta.client, base.client),
    campaign: pick(meta.campaign, base.campaign),
    tagline: pick(meta.tagline, base.tagline),
    summary: {
      views,
      clips: clips.length,
      creators: creators.length,
      budgetTotal: Number(pick(meta.budgetTotal, bs.budgetTotal)) || 0,
      budgetSpent,
      spendKnown,
      guaranteeFloor: Number(pick(meta.guaranteeFloor, bs.guaranteeFloor)) || 0,
    },
    platforms,
    clips,
    creators,
  };
}

// ---- Thumbnail resolution --------------------------------------------------
// Give every clip a real preview image so the dashboard renders actual content,
// not placeholders. Resolution order, stopping at the first hit:
//   1. YouTube — derived from the video id (no network).
//   2. og:image / twitter:image scraped straight from the post page using a
//      link-unfurler user-agent. This is how Slack/iMessage/Facebook get a
//      preview and works for TikTok, Instagram and most platforms.
//   3. TikTok public oEmbed.
//   4. A keyless preview service (microlink) as a last resort.
// Best-effort and bounded: a miss just leaves the clip without a thumb (the
// dashboard shows a tasteful placeholder and retries client-side).
const CRAWLER_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

function ytThumb(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?v=|embed\/|v\/))([\w-]{6,})/);
  return m ? 'https://i.ytimg.com/vi/' + m[1] + '/hqdefault.jpg' : null;
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&#x2[fF];/g, '/').replace(/&#47;/g, '/')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function extractOgImage(html) {
  if (!html) return '';
  const res = [
    /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];
  for (const re of res) {
    const m = html.match(re);
    if (m && m[1] && /^https?:\/\//i.test(m[1])) return decodeEntities(m[1]);
  }
  return '';
}

async function fetchText(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 6000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'user-agent': CRAWLER_UA,
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
        'range': 'bytes=0-262144', // og tags live in <head>; cap the download
      },
    });
    if (!r.ok && r.status !== 206) return '';
    return await r.text();
  } catch (e) { return ''; } finally { clearTimeout(t); }
}

async function fetchJSON(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 6000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': CRAWLER_UA } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; } finally { clearTimeout(t); }
}

// Optionally route a fetch through a scraping proxy (ScraperAPI) that uses
// residential IPs, so Instagram serves the embed it blocks for datacenter IPs.
// No key set -> direct fetch (unchanged). Set the SCRAPER_API_KEY secret to
// turn it on.
function viaScraper(targetUrl, env) {
  const key = env && (env.SCRAPER_API_KEY || env.SCRAPERAPI_KEY);
  if (!key) return targetUrl;
  return 'https://api.scraperapi.com/?api_key=' + encodeURIComponent(key) + '&url=' + encodeURIComponent(targetUrl);
}

function igShortcode(url) {
  const m = String(url || '').match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

function unescapeJsonUrl(s) {
  return String(s || '').replace(/\\u0026/gi, '&').replace(/\\\//g, '/').replace(/\\u003d/gi, '=').replace(/&amp;/g, '&');
}

// Instagram's public embed exposes the media image even when the main page is
// gated. Try og:image, then the display_url/thumbnail_src in the embed JSON,
// then the embedded <img>.
function extractIgImage(html) {
  if (!html) return '';
  let m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (m && /^https?:/i.test(m[1])) return decodeEntities(m[1]);
  m = html.match(/"display_url":"(https:(?:[^"\\]|\\.)*)"/);
  if (m) return unescapeJsonUrl(m[1]);
  m = html.match(/"thumbnail_src":"(https:(?:[^"\\]|\\.)*)"/);
  if (m) return unescapeJsonUrl(m[1]);
  m = html.match(/class=["']EmbeddedMediaImage["'][^>]+src=["']([^"']+)["']/i);
  if (m) return decodeEntities(m[1]);
  return '';
}

// Find an Instagram CDN image URL anywhere in a JSON response, so this works
// across whichever Instagram API the user subscribes to (field names differ).
function findIgImageInJson(text) {
  if (!text) return '';
  let m = text.match(/"(?:thumbnail_url|display_url|image_url|thumbnail_src|image_versions2?|cover_frame_url)"\s*:\s*"(https:(?:[^"\\]|\\.)*)"/i);
  if (m) return unescapeJsonUrl(m[1]);
  m = text.match(/"(https:(?:[^"\\]|\\.)*(?:cdninstagram|fbcdn)(?:[^"\\]|\\.)*\.(?:jpg|jpeg|webp|png)(?:[^"\\]|\\.)*)"/i);
  if (m) return unescapeJsonUrl(m[1]);
  return '';
}

// Resolve an Instagram thumbnail through a purpose-built Instagram API on
// RapidAPI. Host/path are configurable so any equivalent API works; defaults
// target instagram-scraper-api2. Returns '' unless RAPIDAPI_KEY is set.
async function rapidIgImage(postUrl, env) {
  const key = env && env.RAPIDAPI_KEY;
  if (!key) return '';
  const host = (env.RAPIDAPI_IG_HOST || 'instagram-scraper-api2.p.rapidapi.com').trim();
  const tmpl = (env.RAPIDAPI_IG_PATH || '/v1/post_info?code_or_id_or_url={url}').trim();
  const path = tmpl.replace('{url}', encodeURIComponent(postUrl)).replace('{code}', igShortcode(postUrl) || '');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch('https://' + host + path, {
      signal: ctrl.signal,
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host },
    });
    clearTimeout(t);
    if (!r.ok) return '';
    return findIgImageInJson(await r.text());
  } catch (e) { return ''; }
}

async function resolveOneThumb(clip, env) {
  if (clip.thumb) return;
  const url = clip.url || '';
  const yt = ytThumb(url);
  if (yt) { clip.thumb = yt; return; }
  if (!url) return;

  // Instagram: a dedicated Instagram API (RapidAPI) is the reliable path, since
  // generic scrapers and datacenter fetches are blocked. Fall back to the public
  // embed (optionally via a residential proxy) if no API key is configured.
  if (clip.platform === 'instagram') {
    const viaApi = await rapidIgImage(url, env);
    if (viaApi) { clip.thumb = viaApi; return; }
    const code = igShortcode(url);
    if (code) {
      for (const path of ['/embed/captioned/', '/embed/']) {
        const target = 'https://www.instagram.com/p/' + code + path;
        const img = extractIgImage(await fetchText(viaScraper(target, env)));
        if (img) { clip.thumb = img; return; }
      }
    }
  }

  // OpenGraph image straight from the post page (great for TikTok and others).
  const og = extractOgImage(await fetchText(viaScraper(url, env)));
  if (og) { clip.thumb = og; return; }

  // TikTok public oEmbed.
  if (clip.platform === 'tiktok') {
    const d = await fetchJSON('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url));
    if (d && d.thumbnail_url) { clip.thumb = d.thumbnail_url; return; }
  }

  // Keyless preview service (last resort).
  const d = await fetchJSON('https://api.microlink.io/?url=' + encodeURIComponent(url) + '&meta=false');
  const img = d && d.data && (d.data.image || d.data.logo);
  if (img && img.url) clip.thumb = img.url;
}

// Resolve thumbnails for a list of clips with bounded concurrency.
async function resolveThumbnails(clips, env) {
  const queue = clips.slice(0, 100);
  const run = async () => { while (queue.length) { const c = queue.shift(); if (c) { try { await resolveOneThumb(c, env); } catch (e) { /* skip */ } } } };
  const workers = Array.from({ length: Math.min(8, queue.length) }, run);
  try { await Promise.all(workers); } catch (e) { /* best effort */ }
  return clips;
}

// Load the saved campaign, fill in any missing clip thumbnails, and save it
// back. Runs in the background after a publish (and from cron) so the dashboard
// picks up real previews on its next poll without slowing the upload down.
async function resolveStoredThumbnails(env) {
  try {
    const data = await loadCampaign(env);
    const clips = Array.isArray(data.clips) ? data.clips : [];
    const todo = clips.filter((c) => c && !c.thumb && c.url);
    if (!todo.length) return { ok: true, resolved: 0 };
    await resolveThumbnails(todo, env);
    await env.MEDIA.put(CAMPAIGN_KEY, JSON.stringify(data), {
      httpMetadata: { contentType: 'application/json' },
    });
    return { ok: true, resolved: todo.filter((c) => c.thumb).length };
  } catch (e) { return { error: String(e && e.message ? e.message : e) }; }
}

// ---- GET /api/campaign/thumbtest?url=... : diagnose thumbnail resolution -----
// Authed. Runs the exact resolution a single post URL goes through and returns a
// step-by-step trace (was the scraper used, HTTP status, bytes returned, whether
// an image was found) so we can see precisely where Instagram resolution breaks.
export async function handleThumbTest(request, env) {
  if (!isAuthed(request, env)) return json({ error: 'unauthorized' }, 401);
  const u = new URL(request.url);
  const target = u.searchParams.get('url') || '';
  if (!target) return json({ error: 'add ?url=<post url>' }, 400);

  const scraperKey = !!(env.SCRAPER_API_KEY || env.SCRAPERAPI_KEY);
  const platform = /instagram\.com/i.test(target) ? 'instagram'
    : /tiktok/i.test(target) ? 'tiktok'
    : /youtu/i.test(target) ? 'youtube' : 'other';
  const trace = { input: target, platform, rapidApiKeyPresent: !!(env.RAPIDAPI_KEY), scraperKeyPresent: scraperKey, steps: [] };

  if (platform === 'youtube') { trace.thumb = ytThumb(target) || ''; return json(trace); }

  // Instagram API (RapidAPI) — the primary path. Trace the raw result.
  if (platform === 'instagram' && env.RAPIDAPI_KEY) {
    const host = (env.RAPIDAPI_IG_HOST || 'instagram-scraper-api2.p.rapidapi.com').trim();
    const tmpl = (env.RAPIDAPI_IG_PATH || '/v1/post_info?code_or_id_or_url={url}').trim();
    const apiUrl = 'https://' + host + tmpl.replace('{url}', encodeURIComponent(target)).replace('{code}', igShortcode(target) || '');
    const step = { label: 'rapidapi', host };
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(apiUrl, { signal: ctrl.signal, headers: { 'x-rapidapi-key': env.RAPIDAPI_KEY, 'x-rapidapi-host': host } });
      clearTimeout(t);
      const txt = await r.text();
      step.httpStatus = r.status;
      step.bytes = txt.length;
      step.imageFound = findIgImageInJson(txt) || '';
      step.snippet = txt.slice(0, 240).replace(/\s+/g, ' ');
      trace.steps.push(step);
      if (step.imageFound) { trace.thumb = step.imageFound; return json(trace); }
    } catch (e) { step.error = String(e && e.message ? e.message : e); trace.steps.push(step); }
  }

  const tryFetch = async (label, pageUrl, extractor) => {
    const fetchUrl = viaScraper(pageUrl, env);
    const step = { label, page: pageUrl, routedThroughScraper: fetchUrl !== pageUrl };
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(fetchUrl, { signal: ctrl.signal, headers: { 'user-agent': CRAWLER_UA, accept: 'text/html' } });
      clearTimeout(t);
      const html = await r.text();
      step.httpStatus = r.status;
      step.bytes = html.length;
      step.imageFound = extractor(html) || '';
      step.snippet = html.slice(0, 200).replace(/\s+/g, ' ');
      trace.steps.push(step);
      return step.imageFound;
    } catch (e) { step.error = String(e && e.message ? e.message : e); trace.steps.push(step); return ''; }
  };

  if (platform === 'instagram') {
    const code = igShortcode(target);
    trace.shortcode = code;
    if (code) {
      for (const path of ['/embed/captioned/', '/embed/']) {
        const img = await tryFetch('ig' + path, 'https://www.instagram.com/p/' + code + path, extractIgImage);
        if (img) { trace.thumb = img; break; }
      }
    }
  } else {
    const img = await tryFetch('og', target, extractOgImage);
    if (img) trace.thumb = img;
  }
  return json(trace);
}

// ---- POST /api/campaign/import : authed CSV -> dashboard --------------------
// Body may be raw CSV (content-type text/csv) or JSON { csv, ...metaOverrides }.
// ?dryRun=1 parses and returns the derived campaign WITHOUT saving (used by the
// editor so you can review before publishing); without it, the result is saved.
export async function handleCampaignImport(request, env, ctx) {
  if (!env.MEDIA) return json({ error: 'storage not configured' }, 500);
  if (request.method.toUpperCase() !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!isAuthed(request, env)) return json({ error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  let csv = '';
  let meta = {};
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  try {
    if (ct.includes('application/json')) {
      const body = await request.json();
      csv = String(body.csv || '');
      meta = body; // metadata overrides (client, budget, etc.) read by deriveFromClips
    } else {
      csv = await request.text();
    }
  } catch (e) { return json({ error: 'could not read body' }, 400); }

  const clips = clipsFromCSV(csv);
  if (!clips.length) {
    return json({ error: 'no usable rows found — needs a header row with a url or views column' }, 422);
  }

  // YouTube thumbnails are free (derived from the id) — set them inline so they
  // show instantly; the rest are resolved in the background after we respond.
  for (const c of clips) { if (!c.thumb) { const y = ytThumb(c.url); if (y) c.thumb = y; } }

  const existing = await loadCampaign(env);
  const derived = sanitizeCampaign(deriveFromClips(clips, existing, meta));

  if (dryRun) return json({ ok: true, dryRun: true, campaign: derived });

  await env.MEDIA.put(CAMPAIGN_KEY, JSON.stringify(derived), {
    httpMetadata: { contentType: 'application/json' },
  });

  // Resolve the remaining (TikTok / Instagram) thumbnails. Do it in the
  // background when we can so publishing returns immediately; the dashboard
  // polls every ~20s and picks the previews up as they fill in.
  const finish = resolveStoredThumbnails(env);
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(finish); else await finish;

  return json({ ok: true, updated: derived.updated, imported: clips.length, views: derived.summary.views, budgetSpent: derived.summary.budgetSpent });
}

// ---- Scheduled auto-sync: pull a CSV URL and refresh the dashboard ----------
// Runs from the Worker cron trigger. No-op unless CAMPAIGN_CSV_URL is set, so
// it is safe to leave the cron enabled even before you wire up a sheet.
export async function pullCampaignCSV(env) {
  const src = env && env.CAMPAIGN_CSV_URL;
  if (!src || !env.MEDIA) return { skipped: true };
  try {
    const res = await fetch(src, { cf: { cacheTtl: 0 }, headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) return { error: 'fetch ' + res.status };
    const csv = await res.text();
    const clips = clipsFromCSV(csv);
    if (!clips.length) return { error: 'no rows' };
    await resolveThumbnails(clips, env);
    const existing = await loadCampaign(env);
    const derived = sanitizeCampaign(deriveFromClips(clips, existing));
    await env.MEDIA.put(CAMPAIGN_KEY, JSON.stringify(derived), {
      httpMetadata: { contentType: 'application/json' },
    });
    return { ok: true, imported: clips.length, views: derived.summary.views };
  } catch (err) {
    return { error: String(err && err.message ? err.message : err) };
  }
}

// ---- Whop API probe / passthrough (discovery only) -------------------------
// Authed with ADMIN_PASSWORD. Uses the WHOP_API_KEY secret to talk to Whop's
// GraphQL API so we can find out whether content-rewards submission/view data
// is reachable, and iterate on the exact query before wiring the auto-sync.
//   GET  -> introspect Query fields, highlight reward/submission/clip ones
//   POST {query, variables} -> run that GraphQL against Whop, return raw result
const WHOP_GQL = 'https://api.whop.com/public-graphql';

export async function handleWhopProbe(request, env) {
  if (!isAuthed(request, env)) return json({ error: 'unauthorized' }, 401);
  const key = env && env.WHOP_API_KEY;
  if (!key) return json({ error: 'WHOP_API_KEY is not set on the Worker. Add it as a secret, then redeploy.' }, 400);

  const headers = {
    'authorization': 'Bearer ' + key,
    'content-type': 'application/json',
  };
  // Optional company scoping headers, if provided.
  if (env.WHOP_COMPANY_ID) headers['x-company-id'] = env.WHOP_COMPANY_ID;

  const callWhop = async (body) => {
    const r = await fetch(WHOP_GQL, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await r.text();
    let parsed; try { parsed = JSON.parse(text); } catch (e) { parsed = { raw: text.slice(0, 2000) }; }
    return { status: r.status, body: parsed };
  };

  try {
    if (request.method.toUpperCase() === 'POST') {
      let b; try { b = await request.json(); } catch (e) { return json({ error: 'send JSON { query, variables }' }, 400); }
      if (!b || !b.query) return json({ error: 'missing "query"' }, 400);
      const res = await callWhop({ query: b.query, variables: b.variables || {} });
      return json(res, res.status >= 200 && res.status < 500 ? 200 : 502);
    }

    // GET: introspect the Query type and surface campaign-relevant fields.
    const introspection = '{ __schema { queryType { fields { name description args { name } } } } }';
    const res = await callWhop({ query: introspection });
    const fields = (((res.body || {}).data || {}).__schema || {}).queryType;
    const list = (fields && fields.fields) || [];
    const rx = /reward|submission|clip|campaign|content|experience|view|payout|creator|leaderboard/i;
    return json({
      whopStatus: res.status,
      campaignIdFromUrl: 'yjTMgbYt7KKmXj',
      totalQueryFields: list.length,
      candidateFields: list.filter((f) => rx.test(f.name + ' ' + (f.description || '')))
        .map((f) => ({ name: f.name, args: (f.args || []).map((a) => a.name), description: f.description })),
      allFieldNames: list.map((f) => f.name),
      note: list.length ? 'Share candidateFields and I will wire the auto-sync.' : 'Introspection returned nothing — paste whopStatus/body. We may need the scraper path.',
      rawIfEmpty: list.length ? undefined : res.body,
    });
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) }, 502);
  }
}

export async function handleUpload(request, env) {
  if (!env.MEDIA) return json({ error: 'R2 bucket binding "MEDIA" is not configured' }, 500);
  if (!isAuthed(request, env)) return json({ error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const slot = url.searchParams.get('slot') || '';
  if (!SLOT_KEYS.includes(slot)) return json({ error: 'unknown slot' }, 400);

  const method = request.method.toUpperCase();

  if (method === 'DELETE') {
    await env.MEDIA.delete(slot);
    return json({ ok: true, deleted: slot });
  }
  if (method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const action = url.searchParams.get('action') || '';
  try {
    if (action === 'create') {
      const contentType = request.headers.get('x-file-type') || 'video/mp4';
      const mpu = await env.MEDIA.createMultipartUpload(slot, { httpMetadata: { contentType } });
      return json({ uploadId: mpu.uploadId });
    }
    if (action === 'part') {
      const uploadId = url.searchParams.get('uploadId');
      const partNumber = parseInt(url.searchParams.get('part'), 10);
      if (!uploadId || !partNumber) return json({ error: 'missing uploadId or part' }, 400);
      const mpu = env.MEDIA.resumeMultipartUpload(slot, uploadId);
      const buf = await request.arrayBuffer();
      const part = await mpu.uploadPart(partNumber, buf);
      return json({ partNumber: part.partNumber, etag: part.etag });
    }
    if (action === 'complete') {
      const uploadId = url.searchParams.get('uploadId');
      if (!uploadId) return json({ error: 'missing uploadId' }, 400);
      const body = await request.json();
      const parts = (body.parts || []).map((p) => ({ partNumber: p.partNumber, etag: p.etag }));
      const mpu = env.MEDIA.resumeMultipartUpload(slot, uploadId);
      const obj = await mpu.complete(parts);
      return json({ ok: true, slot, size: obj.size });
    }
    if (action === 'abort') {
      const uploadId = url.searchParams.get('uploadId');
      if (uploadId) {
        const mpu = env.MEDIA.resumeMultipartUpload(slot, uploadId);
        await mpu.abort();
      }
      return json({ ok: true });
    }
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) }, 500);
  }
  return json({ error: 'unknown action' }, 400);
}

// ---- GET /api/list : authenticated slot status for the admin page ----
export async function handleList(request, env) {
  if (!env.MEDIA) return json({ error: 'R2 bucket binding "MEDIA" is not configured' }, 500);
  if (!isAuthed(request, env)) return json({ error: 'unauthorized' }, 401);

  const out = [];
  for (const s of SLOTS) {
    const head = await env.MEDIA.head(s.key);
    out.push({
      key: s.key,
      label: s.label,
      exists: !!head,
      size: head ? head.size : 0,
      uploaded: head && head.uploaded ? head.uploaded : null,
      contentType: head && head.httpMetadata ? head.httpMetadata.contentType : null,
    });
  }
  return json({ slots: out });
}

// ---- GET/HEAD /v/<slot> : public media server with Range support ----
function metaHeaders(meta, size) {
  const h = new Headers();
  h.set('accept-ranges', 'bytes');
  h.set('cache-control', 'public, max-age=300');
  if (meta && meta.contentType) h.set('content-type', meta.contentType);
  if (typeof size === 'number') h.set('content-length', String(size));
  return h;
}

export async function handleMedia(request, env) {
  if (!env.MEDIA) return new Response('storage not configured', { status: 500 });

  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.replace(/^\/v\//, ''));
  if (!key) return new Response('not found', { status: 404 });

  const method = request.method.toUpperCase();

  if (method === 'HEAD') {
    const head = await env.MEDIA.head(key);
    if (!head) return new Response(null, { status: 404 });
    return new Response(null, { status: 200, headers: metaHeaders(head.httpMetadata, head.size) });
  }
  if (method !== 'GET') return new Response('method not allowed', { status: 405 });

  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (m) {
      const head = await env.MEDIA.head(key);
      if (!head) return new Response('not found', { status: 404 });
      const size = head.size;
      let start = m[1] === '' ? undefined : parseInt(m[1], 10);
      let end = m[2] === '' ? undefined : parseInt(m[2], 10);
      let offset, length;
      if (start === undefined) {
        length = end; offset = Math.max(0, size - end); start = offset; end = size - 1;
      } else {
        offset = start;
        if (end === undefined || end >= size) end = size - 1;
        length = end - start + 1;
      }
      const obj = await env.MEDIA.get(key, { range: { offset, length } });
      if (!obj) return new Response('not found', { status: 404 });
      const h = metaHeaders(obj.httpMetadata, length);
      h.set('content-range', `bytes ${start}-${end}/${size}`);
      return new Response(obj.body, { status: 206, headers: h });
    }
  }

  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('not found', { status: 404 });
  return new Response(obj.body, { status: 200, headers: metaHeaders(obj.httpMetadata, obj.size) });
}
