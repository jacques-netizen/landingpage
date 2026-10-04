// Case studies and videos for the brand site, keyed for the content settings (content.brands).
// Text is the approved copy from docs/design/handoff/Platform Mockups.dc.html. Video links are empty
// until staff add them in settings. Stat rows are label and value pairs; an empty label hides the row.

export const CASE_STUDIES = [
  { tab: 'Walmart', slug: 'walmart' },
  { tab: 'Wale', slug: 'wale' },
  { tab: 'Kojo Blak', slug: 'kojo-blak' },
  { tab: 'Jake & Logan Paul', slug: 'jake-logan-paul' },
] as const

export const MAX_STATS = 3

export const brandsDataContent: Record<string, string> = {
  'case.walmart.tab': 'Walmart',
  'case.walmart.title': 'Walmart',
  'case.walmart.objective': 'Drive attention to Walmart’s beauty box.',
  'case.walmart.strategy': 'Engage influencers to post about it.',
  'case.walmart.result': '',
  'case.walmart.poster': '',
  'case.walmart.stat1.label': 'TOTAL VIEWS',
  'case.walmart.stat1.value': '3M',
  'case.walmart.stat2.label': 'EFFECTIVE CPM',
  'case.walmart.stat2.value': '$2.30',

  'case.wale.tab': 'Wale',
  'case.wale.title': 'Mannywellz ft. Wale',
  'case.wale.objective': 'Promote the Mannywellz ft. Wale release.',
  'case.wale.strategy': 'Clippers across the network posted clips of the release.',
  'case.wale.result': '',
  'case.wale.poster': '/designed/proof/poster-wale.png',
  'case.wale.stat1.label': 'TOTAL VIEWS',
  'case.wale.stat1.value': '4.6M',
  'case.wale.stat2.label': 'CREATORS',
  'case.wale.stat2.value': '19',
  'case.wale.stat3.label': 'EFFECTIVE CPM',
  'case.wale.stat3.value': '$0.48',

  'case.kojo-blak.tab': 'Kojo Blak',
  'case.kojo-blak.title': 'Kojo Blak',
  'case.kojo-blak.objective': 'Promote Kojo Blak’s two latest songs: his feature with Fantana, and Excellent.',
  'case.kojo-blak.strategy': 'Clippers earned $2.00 per 1,000 views for posting clips of the release.',
  'case.kojo-blak.result': 'He later won Best New Ghanaian Artist.',
  'case.kojo-blak.poster': '/designed/proof/poster-kojo-blak.png',
  'case.kojo-blak.stat1.label': 'TOTAL VIEWS',
  'case.kojo-blak.stat1.value': '1.9M',

  'case.jake-logan-paul.tab': 'Jake & Logan Paul',
  'case.jake-logan-paul.title': 'Jake & Logan Paul',
  'case.jake-logan-paul.objective': 'Drive views for their TV show, Paul American.',
  'case.jake-logan-paul.strategy': 'Clippers reposted clips from episodes 2 and 3 at $2.00 per 1,000 views.',
  'case.jake-logan-paul.result': '',
  'case.jake-logan-paul.poster': '',
  'case.jake-logan-paul.stat1.label': 'TOTAL VIEWS',
  'case.jake-logan-paul.stat1.value': '11.2M',
  'case.jake-logan-paul.stat2.label': 'EFFECTIVE CPM',
  'case.jake-logan-paul.stat2.value': '$1.78',

  // Direct video links (.mp4, .mov or .webm), hosted on Mux, Cloudflare Stream or Vimeo.
  'video.walmart': '',
  'video.wale': '',
  'video.kojo-blak': '',
  'video.jake-logan-paul': '',
  'video.kojo-testimonial': '',
  'video.frame-1': '',
  'video.frame-2': '',
  'video.frame-3': '',
  'video.frame-4': '',

  // Where the Book a call buttons go. Empty means the contact email from config.
  'link.book-call': '',
}
