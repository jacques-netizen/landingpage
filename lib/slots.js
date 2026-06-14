// The fixed set of video "slots" on the site. The admin page lets you upload
// a video into any of these; the public site plays it from /v/<key>.
// To add a new slot: add it here, then point a player at /v/<key> in index.html.
export const SLOTS = [
  { key: 'faq-1',   label: 'FAQ · What is content distribution & how clipping works' },
  { key: 'faq-2',   label: 'FAQ · How is this different from paid ads' },
  { key: 'faq-3',   label: 'FAQ · How do you make sure the views are real' },
  { key: 'walmart', label: 'Walmart case-study clip' },
];

export const SLOT_KEYS = SLOTS.map(s => s.key);
