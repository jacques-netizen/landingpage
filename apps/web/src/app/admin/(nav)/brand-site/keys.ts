import { CASE_STUDIES } from '@/designed/brands.data'

// The brand site's media slots, by content key (see designed/brands.data.ts and brands-client.tsx).
export const BRAND_SITE_SLOTS = [
  ...CASE_STUDIES.flatMap((c) => [
    { key: `video.${c.slug}`, label: `${c.tab}: case study video`, kind: 'video' as const, group: 'Case studies' },
    {
      key: `case.${c.slug}.poster`,
      label: `${c.tab}: picture shown before it plays`,
      kind: 'image' as const,
      group: 'Case studies',
    },
  ]),
  { key: 'video.kojo-testimonial', label: 'Kojo Blak testimonial video', kind: 'video' as const, group: 'Testimonial' },
  ...[1, 2, 3, 4].map((i) => ({
    key: `video.frame-${i}`,
    label: `Frame ${i}`,
    kind: 'video' as const,
    group: 'Clips in the four phone frames',
  })),
  {
    key: 'link.book-call',
    label: 'Book a call link (Calendly or similar)',
    kind: 'link' as const,
    group: 'Book a call',
  },
]
export const BRAND_SITE_KEYS = BRAND_SITE_SLOTS.map((s) => s.key)
