# Decisions

Choices made while building, each with a one line reason. Newest at the bottom of each section.

## Repository and tooling

- The platform lives in this repository next to the existing static site, under `apps/` and `packages/`. Reason: the owner set this repository as the build target. Everything platform related is listed in `.assetsignore` so the existing Cloudflare Worker never serves it.
- pnpm workspaces for the monorepo. Reason: simplest workspace tool that ships with the Node install here and keeps one lockfile.
- TypeScript 5.9, not 7. Reason: Next.js and the type-aware lint tooling are built and tested against 5.x.
- Playwright is pinned to 1.56.1. Reason: it matches the Chromium build installed in the development container, so screenshots render with the same engine as the reference captures.
- ESLint and Prettier run on `apps/` and `packages/` only. Reason: the existing static site and the locked docs are not part of the platform code.
- `docs/design/reference-screens/*.png` is stored in Git LFS. Reason: the owner asked for it to keep the repository small. CI checks out with LFS so the visual tests can read them.

## Database

- Money columns use Drizzle `bigint` in `number` mode. Reason: whole cents stay exact as JS numbers up to 2^53 cents, far above any real budget, and the code stays simple. Inputs are validated as safe integers in code because Postgres silently rounds a fractional value cast to bigint.
- `audit_log.entity_id` is `text`, not `uuid`. Reason: some audited entities are keyed by text (settings keys, reason codes).
- `users.display_name` and `users.avatar_url` are exposed to Auth.js as `name` and `image`; `auth_identities` doubles as the Auth.js accounts table with `provider_user_id` as `providerAccountId`. Reason: one table per concept, as in 02_DATA_AND_MONEY.md, while still using the stock Auth.js Drizzle adapter.
- Added `users.adult_confirmed_at`, `users.terms_accepted_at`, `users.email_verified_at`, and the Auth.js `sessions` and `verification_tokens` tables. Reason: 03_SYSTEMS.md section 1 asks to store the confirmation time, and Auth.js needs the other three.
- `audit_log` is append only through a database trigger that blocks UPDATE, DELETE and TRUNCATE. Reason: 03_SYSTEMS.md section 13 says audit rows cannot be edited or deleted by the application.
- Fraud thresholds start at: 10 times the median of the last 5 checks, 100,000 views in an hour for accounts under 1,000 followers, 20 bps engagement floor after 10,000 views, 50% follower drop, 5 posts in a new creator's first hour. Reason: 03_SYSTEMS.md section 6 names the rules but leaves the numbers to settings; all are editable by admins.
- The Phase 0 seed creates staff, creators, clients, campaigns, terms, settings and reason codes. Submissions, snapshots, appeals, warnings and the funded ledger are seeded once the money engine exists. Reason: seeded ledger rows must come from the real money code so they balance.
- Seed users use the `seed.invalid` domain and the seed refuses to run with `NODE_ENV=production`. Reason: seed data must never reach production.

## Design build

- Marketing copy and videos for the designed public pages are stored in settings under `content.home` and `content.brands` as overrides keyed by text slot. Missing keys fall back to the approved mockup copy. Reason: the owner wants staff to edit words and videos without code while the layout stays fixed.
- Designed screens are generated from the mockup templates by `apps/web/scripts/dc-to-tsx.mjs` into `apps/web/src/designed/`, keeping every element, inline style and text node exactly as in the mockup. Reason: hand-porting thousands of style values risks drift; the visual tests prove the output matches the locked screenshots.
- Designed screens keep the mockups' literal inline style values rather than Tailwind classes. Tokens extracted from those values (`packages/ui/src/tokens.css`) drive Tailwind for screens the mockups do not show. Reason: pixel parity with the locked design comes first, and new screens still share the same palette, fonts and radii.
- No Tailwind preflight anywhere. Reason: the mockups render on browser defaults (content-box sizing, default margins); a CSS reset would move designed elements.
- The mockups' fonts (EB Garamond, Archivo, Plus Jakarta Sans, Geist Mono) are self-hosted from the same Google Fonts files and unicode ranges the mockups load. Reason: identical glyph rendering, and no network fetch at build or run time.
- The mockups scale the 1440 px hero and the network wall by window width. A small inline script sets the same numbers as CSS variables before first paint. Reason: identical rendering with server rendering and no layout flash.
- Home is built from "Creator Site v1" (nav: Campaigns, Wallet). The brand site is the "For brands" screen of "Platform Mockups" at `/brands`, reached from the creator site by URL. Reason: Creator Site v1 wins on creator screens and has no For brands link; adding one would change a designed screen.
- The case study, frame and testimonial video pickers ("Paste link", "Add video", "Add clip", "Add testimonial video") and the image slot are not shipped. Videos come from settings (`content.brands`, keys `video.*`). Reason: they are the mockup's preview tooling, like image-slot.js; the visual tests mask only those areas.
- Buttons the mockups draw without a link are wired without changing their look: Start earning goes to `/sign-up`, Book a call goes to the `link.book-call` content setting (or the contact email), See the results, Case studies and Pricing scroll to their sections. How it works stays unlinked until its page exists in Phase 2. Reason: behaviour only, no visual change.
- Clickable non-button elements in designed screens get role, tab focus and Enter or Space activation, with a focus ring only for keyboard focus. Reason: keyboard access (05_DESIGN_SYSTEM.md section 10) without changing the design.
- Visual tests compare full-page screenshots with pixelmatch (colour threshold 0.1) and allow at most 0.2% of pixels to differ. Reason: absorbs anti-aliasing noise between machines while a one-word copy change (about 1%) fails.
- Phone layouts (under 640px) for the home page and brand site are proposals waiting for the owner's approval. They live in `apps/web/src/designed/phone.css`, keyed by `data-m` markers the converter adds (`$mark`), and reflow the same elements with the mockups' fonts, colours, components and copy. At 640px and wider nothing changes, so the locked 1440 and 1024 designs are untouched (the visual tests show 0 differing pixels). Between 640px and 1440px the mockups' own width scaling applies. Reason: the owner asked for proposals with screenshots; once approved, their 390px screenshots join the locked reference set.
- Review screenshots of each Phase 0 screen at 1440, 1024 and 390px are in `docs/screens/` (Git LFS), per 05_DESIGN_SYSTEM.md section 12. Reason: deliverable for review; they are not the locked references.
- Email sign in creates the account (unverified) with its consent times when the sign-up link is requested, rather than when the link is opened. Reason: the link may be opened on another device, where the consent cookie does not exist.
- A sign-in request for an address with no account shows the same "check your email" screen and emails the owner of that inbox a sign-up link. Reason: the screen must not reveal which addresses have accounts.
- Password sign in (optional in 03_SYSTEMS.md section 1) is not built yet. Reason: magic link is the default and covers the Phase 0 acceptance; passwords can be added without changing the schema.
- Signed-out visitors to `/admin` are sent to sign in; signed-in people without a staff role get 403. Staff API returns 401 or 403 as JSON in the `{ error: { code, message } }` shape. Reason: 03_SYSTEMS.md sections 1 and 10.
- The sign-up terms line is plain text for now. Reason: the legal pages arrive in Phase 2 and the line should not link to pages that do not exist yet.
