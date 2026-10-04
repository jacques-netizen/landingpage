# 05 Design system

The look comes from one reference: a calm, editorial landing page with a warm off-white background, a large high-contrast serif headline with an italic second line, a quiet sans for everything else, black pill buttons, frosted floating cards, hairline details and black-and-white photography. It is applied to the whole product, public site and app. Dashboards use the same type, colour and spacing but are denser and have no photography.

The reference image is `reference/home-reference.jpg` (copy it to `/docs/reference/` in the repository). Match it. If a rule here conflicts with it, the reference wins for the public pages and this file wins for the app and admin.

## 1. Principles

1. Quiet and spacious. Large margins, few elements per screen, one clear action.
2. Type does the work. Serif for headlines and big numbers, sans for everything else. Hierarchy comes from size and weight, not from boxes.
3. Black, white and warm off-white. Colour appears only in small soft icon chips and in status dots.
4. Hairlines instead of boxes. Separate content with 1px lines and space, not with filled grey panels.
5. Honest numbers. Money is always in dollars with cents where needed. No invented counts, ratings or claims anywhere.
6. Calm motion. Slow, small, and off when the user asks for reduced motion.

## 2. Colour tokens

```css
:root {
  --bg: #F6F4EF;            /* page background, warm off-white */
  --surface: #FFFFFF;       /* inputs, drawers, dialogs */
  --surface-glass: rgba(255,255,255,0.68);   /* frosted cards, with backdrop blur */
  --ink: #111111;           /* primary text, primary buttons */
  --ink-2: #5F5C57;         /* secondary text (passes 4.5:1 on --bg) */
  --ink-3: #8C8983;         /* hints, disabled, never for essential text */
  --line: #E4E0D8;          /* hairlines */
  --line-strong: #CFCAC0;   /* input borders, focused hairlines */

  /* soft chip colours, used only behind small icons and for campaign types */
  --chip-lime: #DDF59A;
  --chip-lavender: #D3C7FF;
  --chip-peach: #FFD3B0;
  --chip-sky: #CDE6FF;

  /* status, small dots and text only, never large fills */
  --ok: #2F7D4F;
  --warn: #B26A00;
  --bad: #B3261E;

  --focus: #111111;
}
```

Campaign type chips: clipping uses lime, logo uses lavender, music uses peach, UGC uses sky. The icon glyph inside is `--ink`.

Do not add a brand accent colour. The product is black and white on warm off-white.

## 3. Typography

| Use | Font | Notes |
| --- | --- | --- |
| Display and large numbers | Instrument Serif (regular and italic). Fallback Newsreader, then Georgia | Tight tracking (-0.02em). The reference headline looks heavier than Instrument Serif; if it reads too light, use Newsreader at 500 with its italic |
| Everything else | Geist Sans. Fallback Inter, then system sans | Weights 400, 500, 600 |
| Code and ids | Geist Mono | Reason codes, ids, bio codes |

Scale (desktop / mobile):

| Token | Size | Line height | Use |
| --- | --- | --- | --- |
| `display-xl` | 96 / 56 | 0.95 | Home hero headline |
| `display-lg` | 64 / 40 | 1.0 | Page titles on public pages |
| `display-md` | 40 / 32 | 1.05 | Section titles, big money numbers |
| `display-sm` | 28 / 24 | 1.1 | Card titles, drawer titles |
| `body-lg` | 18 / 17 | 1.5 | Intro paragraphs |
| `body` | 15 / 15 | 1.5 | Default text |
| `body-sm` | 13 / 13 | 1.45 | Table cells, helper text |
| `label` | 13 / 13 | 1.2 | Form labels, 500 weight, sentence case |

Headline pattern: the first line in regular, the second line in italic, as in the reference. Use it for the home hero and for at most one headline per other public page. Do not italicise body text.

Never use all caps or letter-spaced small labels above headings. Labels are sentence case.

## 4. Spacing, shape, depth

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px.
- Page container max width 1200px on public pages, 1280px in the app, 24px side padding on mobile.
- Radii: pill 999px (buttons, nav, filters), card 24px, input 14px, chip 12px, drawer 28px.
- Borders: 1px `--line`. Inputs 1px `--line-strong`.
- Shadows, used sparingly: frosted cards `0 24px 60px rgba(17,17,17,0.08)`, dialogs `0 32px 80px rgba(17,17,17,0.14)`. Nothing else has a shadow.
- Frosted card: `background: var(--surface-glass); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.8); border-radius: 24px;` with the card shadow.

## 5. Components

### Buttons
- Primary: black pill, white text, 48px tall (40px small), 22px horizontal padding, an arrow icon on the right for forward actions. Hover: lift 1px, shadow off. Active: scale 0.98.
- Secondary: white or transparent pill, 1px `--line-strong`, black text, optional leading icon in a black circle (like the Watch video button in the reference).
- Quiet: text only, underline on hover.
- Destructive: black pill with `--bad` text on white, never a red fill.
- Disabled: `--ink-3` text, `--line` border, no shadow.

### Navigation
- Public site: a centred pill with a 1px hairline border containing 4 to 5 links. The active link sits in a soft inner pill (`rgba(17,17,17,0.05)`). The wordmark sits at the left in black. A black pill button sits at the right (Start earning, with the small diagonal arrow icon).
- Creator app: the same centred pill with Overview, Campaigns, Submissions, Wallet. The avatar and notification dot sit at the right. A wallet balance in serif sits next to the avatar.
- Staff admin: a left column of plain text links (no icons required), 15px, with the active link in black and the others in `--ink-2`. Page title in `display-sm` at the top. Same background and hairlines.
- Mobile: the pill collapses to a menu button that opens a full-screen sheet.

### Inputs
- 48px tall, 14px radius, white fill, 1px `--line-strong`, 16px side padding. Label above in `label` style. Helper text below in `body-sm` `--ink-2`.
- Focus: 2px `--focus` outline with 2px offset. Error: border `--bad`, message below with a small icon. Never rely on colour alone.
- Selects and menus use the same shape. Filters on lists are pills.

### Cards
- Frosted cards appear in two places only: floating accent cards on the home hero, and the campaign card on the browse page.
- Campaign card: portrait, 3:4, 24px radius. The cover image fills the top 65%. Below it on `--surface`: title in `display-sm`, budget left as a large serif number, rate in sans ("$2.00 per 1,000 views"), platform icons, a 2px progress hairline showing dollars paid against budget. A chip with the type icon sits over the top left corner of the image. No "ending soon" badges, no countdown timers.
- Elsewhere do not use cards. Use rows separated by hairlines.

### Lists and tables
- Rows separated by 1px `--line`. No zebra striping, no filled header row. The header is `body-sm` `--ink-2`, sticky, with a hairline under it.
- Admin tables are dense: 13px text, 44px row height, row hover `rgba(17,17,17,0.03)`.
- Status is a 6px dot plus a word: dot colour `--ok`, `--warn`, `--bad` or `--ink-3`. Never a coloured pill background.
- Row actions appear on hover and always on touch.
- Empty tables show one sentence and one button, centred, in `body` text.

### Money display
- Large balances and campaign budgets use `display-md` in serif with tabular numerals. Cents shown in `--ink-2`.
- Labels beside numbers in `body-sm`: "Available", "Pending", "Left in budget".
- Pending and available are two lines of text, not two boxes.

### Drawers and dialogs
- Submission detail opens in a right drawer 560px wide, 28px radius on the inside corners, with a hairline-separated layout: summary, view chart, checks, history.
- Dialogs are centred, 24px radius, one primary action at the bottom right.

### Charts
- One chart style: a single 1.5px black line on the off-white background, hairline grid, no fills, no gradients, a small dot on the latest point, labels in `body-sm`. Dollar and view numbers in tabular figures.

### Toasts
- Black pill at the bottom centre with white text, auto dismiss after 4 seconds, one line only.

### Avatars and avatar stacks
- 32px circles with a 2px `--bg` ring, overlapped by 10px, ending in a small white circle with a plus. Only show a stack when it reflects real creators on that campaign.

### Ornaments
- The four-point star glyph is the brand ornament. Use it at 16 to 24px in place of bullets in short lists and as a quiet mark beside a short tagline. Maximum two on any screen.
- The circular rotating text badge from the reference may appear once on the home hero, with real MDE wording. Static if reduced motion is on.
- Hairline curved connectors may join floating cards on the home hero. Not used in the app.

## 6. Motion

- Easing `cubic-bezier(0.2, 0.7, 0.2, 1)`. Durations: 150ms for hovers, 220ms for dialogs and drawers, 400ms for page fades.
- Floating accent cards on the home hero drift up and down 6px over 7 seconds, offset from each other. Nothing else floats.
- No parallax, no scroll-jacking, no count-up animations on money.
- Respect `prefers-reduced-motion`: turn off the drift and the rotating badge and shorten fades to 0.

## 7. Imagery

- Public pages use black and white photography of real creators, with soft depth. Frosted glass panels may overlap the photo, as in the reference. The client or MDE supplies the photos. Until then use a flat `--line` rectangle with the aspect ratio kept. Do not use stock illustrations or AI-looking gradients.
- Campaign covers come from the client's assets and may be colour. They sit inside the card's rounded top.
- App and admin screens have no decorative imagery.

## 8. Page layouts

### Home
1. Top: centred nav pill, wordmark left, black button right.
2. Hero, centred: the headline in `display-xl`, first line regular, second line italic (working copy below). One line of supporting text in `body-lg` `--ink-2`, max 520px wide. Two buttons: primary "Start earning", secondary "How it works" with a play-style icon circle.
3. Around the hero: two tilted frosted cards (about -4 and +4 degrees) at the left and right, each with a small icon chip, a two-line serif statement and a one-line explanation. A hairline curve connects each to the centre image. A small star and a short tagline in the lower corners.
4. Centre image: a black and white portrait of a creator with two or three frosted glass panels overlapping it, each with an icon chip and a short label (Clipping, Logo, Music, UGC). Use real campaign types only.
5. Below the fold: Live campaigns (a row of campaign cards, real data), how it works in five steps (a numbered text list in serif numerals, not circles), fees (a plain table), for clients, then the footer.
6. Proof elements only if real: a creator count or amount paid appears only when it comes from the database, and with a date.

Working copy, replaceable: headline "Post it. Watch it grow." with the second line italic "Get paid for every view."; supporting text "Join a campaign, post on your own account, and earn for every view that counts. See the rules and the budget before you join."

### Campaigns (browse)
Title in `display-lg`. A row of filter pills (type, platform, sort) and a search field. Cards in a grid of 4 on desktop, 2 on tablet, 1 on mobile. Closed campaigns below, lighter, without the join prompt.

### Campaign page
Two columns on desktop. Left: title in `display-lg`, type chip, status, brief, assets, rules in a hairline-separated list with plain labels. Right, sticky: the budget in `display-md`, "left of" the total, a 2px progress hairline, the rate, platforms, dates, and the Join or Submit button. The terms version date sits under the rules.

### Creator overview
Top-left greeting in `display-sm`. Large "Available" balance in `display-md` serif with the Withdraw pill. "Pending" beneath in sans. Then "Recent activity" as hairline rows. Then "Your campaigns" as hairline rows with the amount earned at the right. No boxes, no stat tiles.

### Wallet
Same top as Overview. Tabs as text with an underline (Transactions, Withdrawals). Transaction rows: date, description, amount, with the amount in serif.

### Submissions
Table as in section 5. The drawer opens on row click.

### Staff review queue
Two panes. Left: a narrow list of posts with platform icon, creator, campaign, flags as small text. Right: the post detail with the embedded link, checks as a hairline list with ok, warn and bad dots, the view chart, the reason picker as a list of pills, a note field, and Approve and Reject buttons. Shortcuts shown in the footer as plain text (J next, A approve, R reject).

### Staff dashboard, campaigns, creators, ledger, settings
Page title in `display-sm`, a one-line description, then lists and tables as in section 5. No stat tile rows. Where a number matters (budget used, posts waiting) show it as a sentence or a serif numeral with a label, in a simple vertical list.

### Client report
Same look as the public site, calm and printable. Spend and views as large serif numbers in a single line of text with labels, then a chart, then the post list. Print stylesheet included.

### Sign in and sign up
Centred single column, 420px wide, on `--bg`. Title in `display-md`. Provider buttons as secondary pills, then the email field, then the primary pill. Terms and age checkboxes with plain wording.

## 9. Copy and tone

- Plain words. Short sentences. Say what happens and what it costs.
- No hype, no countdown pressure, no "limited spots".
- Say "post", "views", "counted", "earn". Avoid jargon such as "CPM" in creator screens. Show "$2.00 per 1,000 views". Use CPM only in staff screens.
- Every rejection shows its reason in a full sentence, and an Appeal link.
- Never claim a number you do not have in the database.
- Dates in the user's locale, money in USD with the dollar sign, times in the user's time zone.

## 10. Accessibility

- All text meets WCAG AA contrast on `--bg` and `--surface`.
- Every interactive element is reachable by keyboard with a visible focus ring.
- Touch targets at least 44 by 44 px.
- Status never relies on colour alone. A word accompanies every dot.
- Forms have labels, error messages tied to fields, and focus moves to the first error.
- Charts have a text summary and a table view toggle.
- Frosted blur must have a solid fallback colour where `backdrop-filter` is not supported.

## 11. Do not

- No rounded grey card grids, no stat-tile rows, no numbered circles, no small caps labels above titles, no zebra tables, no italic caveat lines under tables, no bullets on every section.
- No default component library look (blue buttons, grey panels, heavy shadows).
- No gradients except the soft image overlays on campaign covers.
- No emoji in the interface.
- No em dashes in interface copy, emails or documents the product produces.
- No stock illustrations, no AI-generated imagery.
- No dark patterns: no fake urgency, no hidden fees, no pre-ticked consents.
- No invented user counts, ratings, logos or testimonials.

## 12. Deliverables for the design work

Claude Code builds these in Phase 0 before any feature screens:
1. `/styleguide` page showing colours, type scale, spacing, buttons, inputs, tabs, tables, drawer, dialog, toast, chips, avatar stack, charts, empty states and the money display, each in all states.
2. The home page, built to this file, with real data hooks where data exists and clearly marked placeholders where it does not.
3. A screenshot of each at 1440, 1024 and 390 px wide committed to `/docs/screens/` for review.
