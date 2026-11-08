// Answer cleaning, checks and display for the per-offer onboarding forms.
// Everything here is driven by the question config in lib/questions.js; the
// browser runs the same checks (onboarding/form.html) so errors show by the
// field, and the server runs them again on submit.
import { OFFERS, questionsFor, COUNTRIES, EMAILS } from './questions.js';

export const OFFER_IDS = OFFERS.map((o) => o.id);
export const FORM_VERSION = 2;
export const offerLabel = (id) => (OFFERS.find((o) => o.id === id) || OFFERS[0]).label;
export const offerSection = (id) => (OFFERS.find((o) => o.id === id) || OFFERS[0]).section;
export { questionsFor, COUNTRIES, EMAILS };

export const FILE_TYPES = ['file_or_link', 'text_or_file'];

const text = (v, max = 1000) => String(v == null ? '' : v)
  .replace(/<[^>]*>/g, '')
  .replace(/[<>]/g, '')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .slice(0, max).trim();
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
export const isUrl = (v) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(String(v || '').trim());
export const isPhone = (v) => /^\+\d[\d\s().-]{6,}$/.test(String(v || '').trim());
const isNumber = (v) => /^\d+([.,]\d+)?$/.test(String(v || '').trim());
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const isZone = (v) => /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(String(v || ''));

export const visible = (q, a) => !q.showIf || (a || {})[q.showIf.id] === q.showIf.equals;

// Normalise one answer to its type's shape.
function cleanOne(q, v) {
  switch (q.type) {
    case 'long': return text(v, 6000);
    case 'country': return COUNTRIES.includes(v) ? v : '';
    case 'timezone': return isZone(v) ? String(v) : '';
    case 'single': return (q.options || []).some((o) => o.value === v) ? v : '';
    case 'multi': {
      const ok = (q.options || []).map((o) => o.value);
      let picked = Array.isArray(v) ? [...new Set(v.filter((x) => ok.includes(x)))] : [];
      if (q.none && picked.includes(q.none) && picked.length > 1) picked = [q.none];
      return picked;
    }
    case 'dates': return (Array.isArray(v) ? v : []).slice(0, 20)
      .map((d) => ({ date: isDate(obj(d).date) ? obj(d).date : '', what: text(obj(d).what, 300) }))
      .filter((d) => d.date || d.what);
    case 'links':
    case 'numbers': {
      const o = obj(v), r = {};
      for (const f of q.fields || []) r[f.key] = text(o[f.key], 1000);
      return r;
    }
    case 'file_or_link': return { link: text(obj(v).link, 1000) };
    case 'text_or_file': return { text: text(obj(v).text, 6000) };
    case 'text_and_link': return { text: text(obj(v).text, 6000), link: text(obj(v).link, 1000) };
    default: return text(v, 1000);
  }
}

// Keep only this offer's questions, in their shapes; answers to questions
// that aren't shown (a song-only question after switching away from "A song")
// are dropped, so they never reach admin or emails.
export function cleanAnswers(offer, input) {
  const a = obj(input);
  const r = {};
  const qs = questionsFor(offer);
  for (const q of qs) r[q.id] = cleanOne(q, a[q.id]);
  for (const q of qs) if (!visible(q, r)) delete r[q.id];
  return r;
}

// The problem with one answer, or ''. `files` = number of files uploaded to it.
export function problemWith(q, v, files) {
  const empty = (x) => !String(x == null ? '' : x).trim();
  const o = obj(v);
  switch (q.type) {
    case 'email':
      if (empty(v)) return q.required ? 'Please add your email address' : '';
      return isEmail(v) ? '' : 'Please add a valid email address';
    case 'phone':
      if (empty(v)) return q.required ? 'Please add your number with the country code, for example +44 7700 900123' : '';
      return isPhone(v) ? '' : 'Please include the country code, for example +44 7700 900123';
    case 'url':
      if (empty(v)) return q.required ? 'Please add a link starting with https://' : '';
      return isUrl(v) ? '' : 'Please add a link starting with https://';
    case 'number':
      if (empty(v)) return q.required ? 'Please add a number' : '';
      return isNumber(v) ? '' : 'Please add a number, for example 10';
    case 'country': return q.required && empty(v) ? 'Please pick your country' : '';
    case 'timezone': return q.required && empty(v) ? 'Please pick your time zone' : '';
    case 'single': return q.required && empty(v) ? 'Please pick one' : '';
    case 'multi': return q.required && !(Array.isArray(v) && v.length) ? 'Please pick at least one' : '';
    case 'dates': return (Array.isArray(v) ? v : []).some((d) => obj(d).what && !obj(d).date) ? 'Please add the date for each item, or remove it' : (q.required && !(Array.isArray(v) && v.length) ? 'Please add at least one date' : '');
    case 'links': {
      const filled = (q.fields || []).filter((f) => !empty(o[f.key]));
      if (filled.some((f) => !isUrl(o[f.key]))) return 'Please use full links starting with https://';
      if ((q.atLeastOne || q.required) && !filled.length) return 'Please add at least one link';
      return '';
    }
    case 'numbers': {
      const fs = q.fields || [];
      if (fs.some((f) => !empty(o[f.key]) && !isNumber(o[f.key]))) return 'Please use numbers only, for example 40';
      if (q.required && fs.some((f) => empty(o[f.key]))) return 'Please add all ' + fs.length + ' numbers';
      return '';
    }
    case 'file_or_link':
      if (!empty(o.link) && !isUrl(o.link)) return 'Please add a link starting with https://';
      return q.required && empty(o.link) && !files ? 'Please upload the file or paste a link' : '';
    case 'text_or_file': return q.required && empty(o.text) && !files ? 'Please type it in or upload a file' : '';
    case 'text_and_link':
      if (!empty(o.link) && !isUrl(o.link)) return 'Please add a link starting with https://';
      return q.required && empty(o.text) && empty(o.link) ? 'Please tell us how to get access' : '';
    default: return q.required && empty(v) ? 'Please fill this in' : '';
  }
}

// First problem in the whole form, as { q, error }, or null when complete.
export function firstProblem(offer, a, fileCounts) {
  for (const q of questionsFor(offer)) {
    if (!visible(q, a)) continue;
    const e = problemWith(q, a[q.id], (fileCounts || {})[q.id] || 0);
    if (e) return { q: q.id, error: e };
  }
  return null;
}

// The answer as plain text, for admin, emails and the export.
export function displayAnswer(q, v, files) {
  const o = obj(v);
  const fileLine = (files || []).map((f) => 'File: ' + f.name);
  const lab = (val) => ((q.options || []).find((x) => x.value === val) || {}).label || val;
  switch (q.type) {
    case 'single': return v ? lab(v) : '';
    case 'multi': return (Array.isArray(v) ? v : []).map(lab).join(', ');
    case 'dates': return (Array.isArray(v) ? v : []).map((d) => [d.date, d.what].filter(Boolean).join(': ')).join('\n');
    case 'links':
    case 'numbers': return (q.fields || []).filter((f) => o[f.key]).map((f) => f.label + ': ' + o[f.key]).join('\n');
    case 'file_or_link': return [o.link].filter(Boolean).concat(fileLine).join('\n');
    case 'text_or_file': return [o.text].filter(Boolean).concat(fileLine).join('\n');
    case 'text_and_link': return [o.text, o.link].filter(Boolean).join('\n');
    default: return v == null ? '' : String(v);
  }
}

// The client-safe version of an offer's questions, for the browser.
export function formDefinition(offer) {
  return {
    offer,
    offer_label: offerLabel(offer),
    questions: questionsFor(offer).map((q) => ({ ...q })),
    countries: COUNTRIES,
  };
}

// Answers from the first version of the form (one form for everyone, ids
// q1..q19) carried over to the new clipping questions, for links that were
// opened but not yet submitted.
export function migrateLegacy(a) {
  a = obj(a);
  const q2 = obj(a.q2);
  const r = {};
  if (q2.name) r.full_name = q2.name;
  if (a.q1) r.business_name = a.q1;
  const email = a.q3 === 'email' ? a.q3b : a.q4;
  if (email) r.email = email;
  if (a.q3 === 'whatsapp' && a.q3b) r.whatsapp = a.q3b;
  if (['whatsapp', 'instagram', 'email'].includes(a.q3)) r.contact_method = a.q3;
  const drive = obj(a.q11b).drive;
  if (isUrl(drive)) r.raw_content = drive;
  if (a.q13) r.clipper_rules = a.q13;
  const q9 = obj(a.q9);
  if (q9.date) r.key_dates = [{ date: q9.date, what: q9.what || '' }];
  return r;
}
