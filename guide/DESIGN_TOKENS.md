# Design tokens

Captured from the live site, https://maisondelites.com, at 390px and 1440px
widths (Phase 0, section 9.1 of the build plan). Screenshots and the raw
computed style dump sit in `docs/reference/`:

- `docs/reference/site-390.png` (mobile, 2x)
- `docs/reference/site-1440.png` (desktop)
- `docs/reference/computed-styles.json` (counts of computed colors, fonts,
  sizes, radii, borders, plus button and text samples)

Re-run with `node scripts/capture-design.mjs`.

The Tailwind theme in `src/app/globals.css` is written from this file. Change
a token here first, then mirror it there.

## Color

| Token | Value | Where the site uses it |
|---|---|---|
| `paper` | `#F2EEE6` | Page background |
| `paper-deep` | `#EEE9DB` | Hero and alternating section background |
| `paper-light` | `#F7F3EA` | Raised surfaces, light panels |
| `ink` | `#1A1510` | Main text, primary buttons, dark sections |
| `ink-deep` | `#15110D` | Footer and dark panels |
| `ink-black` | `#0B0907` | Video letterbox, darkest panels |
| `ink-soft` | `#4F493F` | Strong secondary text |
| `muted` | `#6E675C` | Body copy on paper |
| `muted-light` | `#8A8378` | Captions, small print |
| `line` | `#D8CDB9` | Hairlines, pill borders |
| `line-strong` | `#CDBFA8` | Secondary button border |
| `gold` | `#A8843A` | Accent, stars, rules, active marks |
| `gold-deep` | `#8A6A22` | Accent text on paper (passes contrast) |
| `gold-light` | `#D8C58F` | Accent on dark |
| `cream` | `#F4F1EA` | Text on dark sections |
| `cream-dim` | `rgba(244,241,234,0.7)` | Secondary text on dark |

Case study panels use a warm red to orange gradient (`#6E1522`, `#B3331F`,
`#C2412A`, `#E8803A`). Use it only for proof moments.

Contrast notes (measured on `paper`): `muted` is 4.8:1 and passes AA for body
text. `muted-light` is 3.2:1 and `gold` is 3.0:1, so use them only for large
text (24px or larger) or decoration. `gold-deep` is 4.4:1, fine for 18px and up.
On `ink`, `cream` is 16:1 and `gold-light` is 10.6:1.

## Type

| Role | Family | Weight | Notes |
|---|---|---|---|
| Display and headlines | EB Garamond | 400 | Tight tracking, about -0.03em. Italic 400 for the emphasised phrase ("*Clips on every feed, at scale.*", "built for *reach*") |
| UI and body | Archivo | 400, 500, 600 | Body 15 to 17px, line height about 1.6. Buttons 13 to 15px at 500 |
| Labels | Geist Mono | 500 | The site uses tiny uppercase mono kickers. The build plan bans kicker labels, so **this app does not use them**. Mono is kept only for tabular numbers if ever needed |

Type scale (as rendered on the site):

| Step | Desktop | Mobile | Line height | Tracking |
|---|---|---|---|---|
| Hero | 76px | 40px | 0.96 | -0.035em |
| H1 | 64px | 40px | 1.0 | -0.03em |
| H2 | 58px | 34px | 1.0 | -0.03em |
| H3 | 44px | 32px | 1.04 | -0.025em |
| Card title (serif) | 34px | 34px | 1.0 | 0 |
| Lead (sans) | 17px | 17px | 1.6 | 0 |
| Body (sans) | 15px | 15px | 1.55 | 0 |
| Small (sans) | 13px | 13px | 1.4 | 0 |

This app scales display type up beyond the site on question scenes (type-led
layout, section 9.2), using the same families, weights and tracking.

## Shape

- Buttons and chips: fully rounded pills, `border-radius: 999px`.
- Primary button: ink fill, white text, 50px high (44px compact), 28px side
  padding, Archivo 15px 500. Arrow glyph after the label.
- Secondary button: `rgba(255,255,255,0.5)` fill, 1px `line-strong` border, ink text.
- Large media: 26 to 36px radius. Small media: 10 to 20px.
- Borders are always 1px hairlines.
- Shadows are soft and warm. The site leans on white glass panels over imagery.
  This app avoids card grids (section 9.2), so shadows are rare.

## Spacing

- Desktop page gutter: 48px (nav) and 62px (content column).
- Mobile gutter: 16 to 20px.
- Section rhythm: about 120 to 160px between sections on desktop, 72 to 96px on mobile.
- Max content width: 1240px. Reading width: about 34 to 40ch for leads.

## Motion

What the site does:

- Slow ambient drift on floating elements (`drift` 6 to 10s ease-in-out, infinite).
- Logo and category marquees (38 to 46s linear).
- A slowly spinning badge (28s linear).
- No snappy UI transitions, no bounce.

What this app does with that feel (section 9.3):

- Scene changes are film cuts and dissolves: 380 to 520ms, ease
  `cubic-bezier(0.22, 1, 0.36, 1)` (out-expo-ish) for entrances and
  `cubic-bezier(0.64, 0, 0.78, 0)` for exits.
- Headlines rise 12 to 24px and fade in line by line, staggered 60 to 90ms.
- Ambient drift is allowed on imagery only.
- `prefers-reduced-motion`: every movement becomes a plain 200ms fade.

## Imagery

Re-hosted from the site under `public/brand/` (converted to WebP where it saves
weight). Logos stay in their original format.

- Logo: `brand/logo-nav-clear.png` (960 x 100, transparent, ink wordmark)
- Hero and story: `brand/bh-3.webp`, `brand/story-1-s.webp` to `story-4-s.webp`,
  `brand/concert-s.webp`, `brand/bb-b.webp`, `brand/sky-b.webp`
- Client logos: `brand/logos/walmart.png`, `nintendo-t.png`, `wyde.svg`,
  `sony.png`, `defjam.png`
- Testimonial posters: `brand/proof/poster-kojo-blak.webp`, `poster-wale.webp`

Campaign videos on the site (`/files/...`) were used only to cut the
placeholder films in `public/media/placeholder/` (see
`scripts/make-placeholders.sh`). The owner still has to confirm re-hosting
rights before launch (section 14, item 8).

## Links

- Privacy Policy: `https://maisondelites.com/legal/privacy`
