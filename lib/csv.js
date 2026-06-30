// Tolerant CSV -> campaign-clips parser, shared by the import API, the
// scheduled auto-sync, and (ported) the editor's paste box. One source of truth
// for how a spreadsheet row becomes a clip tile.

// RFC4180-ish parser: handles quoted fields, escaped quotes, and CRLF.
export function parseCSV(text) {
  text = String(text == null ? '' : text).replace(/^﻿/, ''); // strip BOM
  const rows = [];
  let field = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* handled by the following \n */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // drop fully-empty rows
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

const norm = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Accepted column header synonyms -> canonical field.
const HEADERS = {
  url:      ['url', 'link', 'posturl', 'postlink', 'post', 'videourl', 'video', 'contenturl', 'clipurl', 'permalink'],
  views:    ['views', 'viewcount', 'plays', 'play', 'totalviews', 'impressions', 'reach'],
  creator:  ['creator', 'handle', 'username', 'user', 'account', 'creatorhandle', 'clipper', 'name', 'author'],
  platform: ['platform', 'source', 'network', 'app', 'site'],
  title:    ['title', 'caption', 'description', 'desc', 'content', 'text'],
  posted:   ['posted', 'date', 'postdate', 'posteddate', 'createdat', 'created', 'submittedat', 'submitted'],
  thumb:    ['thumb', 'thumbnail', 'thumbnailurl', 'image', 'imageurl', 'img', 'cover', 'preview', 'media', 'mediaurl', 'displayurl', 'posterurl', 'poster', 'snapshot'],
  featured: ['featured', 'top', 'highlight', 'pinned', 'star'],
  status:   ['status', 'state', 'approval'],
  earnings: ['earnings', 'earned', 'paid', 'payout', 'payouts', 'reward', 'rewards', 'amount', 'revenue', 'spend', 'spent', 'cost', 'payment', 'commission'],
};

// "$12.50", "1,250.00", "€12" -> number
export function parseMoney(v) {
  v = String(v == null ? '' : v).replace(/[^0-9.]/g, '');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// "1.2M", "980K", "1,200,000", "1.2m views" -> number
export function parseViews(v) {
  v = String(v == null ? '' : v).trim().toLowerCase().replace(/views?/g, '').replace(/[, ]/g, '');
  if (!v) return 0;
  const m = v.match(/^([\d.]+)\s*([kmb])?/);
  if (!m) { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n) : 0; }
  let n = parseFloat(m[1]) || 0;
  if (m[2] === 'k') n *= 1e3; else if (m[2] === 'm') n *= 1e6; else if (m[2] === 'b') n *= 1e9;
  return Math.round(n);
}

export function normPlatform(p, url) {
  p = String(p || '').toLowerCase().trim();
  const test = (s) => p.includes(s);
  if (p) {
    if (test('tiktok') || test('tt')) return 'tiktok';
    if (test('insta') || test('ig') || test('reel')) return 'instagram';
    if (test('short')) return 'youtube';
    if (test('you') || test('yt')) return 'youtube';
    return p.split(/\s+/)[0];
  }
  url = String(url || '').toLowerCase();
  if (url.includes('tiktok')) return 'tiktok';
  if (url.includes('instagram')) return 'instagram';
  if (url.includes('youtu')) return 'youtube';
  return 'other';
}

const isTruthy = (v) => /^(1|y|yes|true|x|top|star|featured|★)$/i.test(String(v || '').trim());
const isRejected = (v) => /^(reject|rejected|flag|flagged|denied|removed)$/i.test(String(v || '').trim());

// Parse CSV text into an array of clip objects ready for the dashboard.
// Rows whose status column reads rejected/flagged are skipped.
export function clipsFromCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const head = rows[0].map(norm);
  const idx = {};
  for (const field in HEADERS) {
    for (const syn of HEADERS[field]) {
      const ci = head.indexOf(syn);
      if (ci >= 0) { idx[field] = ci; break; }
    }
  }
  // If no header matched a URL column, auto-detect it: pick the column whose
  // values most often look like links. Makes link + thumbnail capture robust to
  // oddly-named exports ("Content", "Submission", etc.).
  if (idx.url == null) {
    const cols = head.length;
    let best = -1, bestHits = 0;
    for (let ci = 0; ci < cols; ci++) {
      let hits = 0;
      for (let r = 1; r < rows.length; r++) {
        if (/^\s*https?:\/\//i.test(String(rows[r][ci] || ''))) hits++;
      }
      if (hits > bestHits) { bestHits = hits; best = ci; }
    }
    if (best >= 0 && bestHits > 0) idx.url = best;
  }

  // Need at least a url or a views column to be a usable sheet.
  if (idx.url == null && idx.views == null && idx.title == null) return [];

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (f) => (idx[f] != null ? String(row[idx[f]] == null ? '' : row[idx[f]]).trim() : '');
    if (idx.status != null && isRejected(get('status'))) continue;
    const url = get('url');
    const title = get('title');
    const views = parseViews(get('views'));
    if (!url && !title && !views) continue;
    out.push({
      title,
      creator: get('creator'),
      platform: normPlatform(get('platform'), url),
      url,
      thumb: get('thumb'),
      views,
      earnings: parseMoney(get('earnings')),
      posted: get('posted'),
      featured: isTruthy(get('featured')),
    });
  }
  return out;
}
