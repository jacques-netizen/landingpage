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
- Phone layouts (under 640px) for the home page and brand site were proposed and then approved by the owner, and are now locked at 390px. They live in `apps/web/src/designed/phone.css`, keyed by `data-m` markers the converter adds (`$mark`), and reflow the same elements with the mockups' fonts, colours, components and copy. At 640px and wider nothing changes, so the locked 1440 and 1024 designs are untouched (the visual tests show 0 differing pixels). Between 640px and 1440px the mockups' own width scaling applies. Reason: the owner asked for proposals with screenshots; once approved, their 390px screenshots join the locked reference set.
- Review screenshots of each Phase 0 screen at 1440, 1024 and 390px are in `docs/screens/` (Git LFS), per 05_DESIGN_SYSTEM.md section 12. Reason: deliverable for review; they are not the locked references.
- Email sign in creates the account (unverified) with its consent times when the sign-up link is requested, rather than when the link is opened. Reason: the link may be opened on another device, where the consent cookie does not exist.
- A sign-in request for an address with no account shows the same "check your email" screen and emails the owner of that inbox a sign-up link. Reason: the screen must not reveal which addresses have accounts.
- Password sign in (optional in 03_SYSTEMS.md section 1) is not built yet. Reason: magic link is the default and covers the Phase 0 acceptance; passwords can be added without changing the schema.
- Signed-out visitors to `/admin` are sent to sign in; signed-in people without a staff role get 403. Staff API returns 401 or 403 as JSON in the `{ error: { code, message } }` shape. Reason: 03_SYSTEMS.md sections 1 and 10.
- The sign-up terms line is plain text for now. Reason: the legal pages arrive in Phase 2 and the line should not link to pages that do not exist yet.

## Owner answers

- The Data / Loading / Error switches on the campaigns and wallet mockups are preview tools, not product. They are not shipped; the real loading, empty and error states appear on their own when they happen. The visual tests for those screens will mask the switches only. Reason: confirmed by the owner.

## Open items the owner will answer later

- Case study videos: the owner will upload every case study, frame and testimonial video. Until then a case study with no video or poster (Walmart, Jake & Logan Paul) shows an empty video box. No fallback is needed.
- Home "How it works" button: stays unlinked until the owner says where it goes (expected: the Phase 2 how it works page).
- Brand footer "Careers": stays unlinked until the owner gives a destination.
- A "For brands" link on the creator home: not added. The brand site stays reachable at `/brands` by URL until the owner decides.
- "Sample data for layout only" notes on the app screens: ask the owner whether they ship when building those screens.

## Money engine (Phase 1)

- The engine (`packages/money`) talks to storage through one interface with two implementations: Postgres for the product and an in-memory store for tests. Reason: the property tests run the exact engine code 10,000 times in seconds; a smaller sample runs the same scenarios against real Postgres.
- The in-memory store enforces what the database enforces at commit (balanced transactions, no guarded balance below zero, all or nothing). Reason: a property run cannot pass in memory and fail in Postgres for a reason the tests never see.
- Earnings transactions use the idempotency key `submission:{id}:{n}`, where n is how many money transactions that submission already has, taken under the submission's row lock. Reason: the example key `earning:{submission_id}:{counted_views}` in 02_DATA_AND_MONEY.md collides when views fall and rise back to the same number (10,000, 9,000, 10,000), which would silently skip the third adjustment. Running the same view check twice still posts nothing, because earnings are recomputed from totals and the second run finds no change.
- The database rejects at commit any ledger transaction that does not sum to zero or has fewer than two entries, and any balance other than the outside world's going below zero. Ledger rows cannot be updated, deleted or truncated. Reason: section 3 and section 7; the engine checks the same things first, the database is the last line.
- Lock order in every money operation is campaign budget account, then the submission or withdrawal row, then creator and platform accounts, each set locked in a stable order. Reason: parallel jobs serialise on the campaign budget instead of overspending or deadlocking (tested with 20 parallel accruals on a 10,000 cent budget).
- A campaign moves to `closing` once its budget balance is below 1 cent. Reason: section 5.3, "less than the smallest possible new payment", and the smallest payment is 1 cent.
- A submission moves from `approved` to `earning` once its counted views are above zero and at or past the campaign minimum. Reason: 01_PRODUCT.md section 7 and 03_SYSTEMS.md section 3.3 step 8.
- Earnings grow only while the post is approved or earning and the campaign is live. Corrections down still apply to final posts. Released (paid out) earnings are never reversed automatically. Reason: sections 5.3 and 5.4.
- A withdrawal can be marked paid or failed only once it is in a batch or sent; repeating either is a no-op. Reason: section 6, and webhooks can arrive twice.
- Release refuses while a submission has an open fraud flag or open appeal. Reason: section 5.4 step 4.
- The withdrawal quote lives in `@mde/money/quote`, a module with no server imports. Reason: section 6 requires the form and the server to use the same function.

## Campaigns (Phase 2)

- Campaign status means: `draft` (being built), `awaiting_funding` (published, waiting for the client's money), `live` (published and funded), `closing` (budget used, no new earnings), `closed`, `cancelled`. Publishing an unfunded campaign leaves it waiting; funding it then makes it live at once. Reason: section 5.3 of 01_PRODUCT.md, "the campaign goes live only when fully funded".
- A live campaign with a future start date shows on the site and can be joined; submissions open at the start date (Phase 3 check 1). The lifecycle job therefore only closes campaigns. Reason: simplest reading of "open at start_at" without a separate scheduled status.
- Once funded, the budget cannot change. Once live, the budget, caps, minimum views, type and client cannot change; the rate can (existing posts keep their locked rate). Reason: changing caps or minimums after posts earned would change money already owed, which is a money rule decision for the owner.
- Rules text is saved as a new terms version when a campaign is published and whenever it changes on a published campaign. Reason: 02_DATA_AND_MONEY.md terms versions, and every submission is paid under the version in force when it was submitted.
- Only campaigns that were never funded can be cancelled; funded campaigns are closed so the budget is accounted for. Reason: no money may be left unexplained.
- Template-specific rules (logo file, safe zone, audio link and similar) are stored in `campaigns.template_fields`. Template minimum durations and hashtags start empty. Reason: 01_PRODUCT.md section 6.2 lists these fields but the table has no columns for them, and the numbers are for staff to set, not to invent.
- Staff type money as dollars ("$1,250.00"); `@mde/money/dollars` turns it into whole cents with string maths. Reason: no floating point anywhere money is handled.
- "Dollars paid" on a campaign is what creators have earned on it (sum of earned cents); "left" is the campaign budget account balance from the ledger. Reason: section 6.3 of 01_PRODUCT.md, figures from the ledger, never a stored balance.
- Private campaigns are not listed. Their page is reached by link and joining needs the access code (case does not matter). Reason: 01_PRODUCT.md sections 5.1 and 6.1.
- Development seed lives in `packages/seed` and funds and earns through the money engine, so the seeded campaigns show the mockups' sample numbers exactly. Reason: the visual tests compare those screens against the locked screenshots.
- The campaigns screen is built from "Creator Site v1" (screen browse) with real campaigns. Active campaigns are the live public ones, oldest first (campaigns that opened first lead the list). Reason: the mockup shows one Active section and no sort control; closing and closed campaigns wait for the owner's answer on a Closed section.
- The featured campaign and its title, line and two tags are staff-edited content (`content.browse`, keys `featured.*`); the amount left is live from the ledger. With nothing set, the first live campaign is featured in its own words; with no live campaigns, the featured block is not shown. Reason: the mockup's featured copy differs from the campaign card's, so it is marketing content.
- The mockup's Data / Loading / Error switch and "Sample data and artwork for layout only." note are rendered invisible (converter `$hide`), keeping the locked layout exactly; visual tests mask only them. Reason: owner confirmed the switch is preview tooling; the note would be untrue with real data.
- The hero and the campaign list load separately. If the list fails, the page shows the mockup's error state with the hero in place; the loading screen shows the hero while the list loads. While loading or after an error the "N campaigns" count is blank rather than wrong. Reason: matches the mockup's states without showing a false count.
- The search box is a real input styled to render exactly like the mockup's text, searching titles, labels and platforms. The account button reads Sign in, or Sign out once signed in. Reason: behaviour without visual change; the signed-in state is not designed.
- The Dark or Glass choice is kept in a cookie so the server renders the chosen theme on the first paint. Dark is the default. Reason: no flash of the wrong theme.
- Loading and error states of designed screens are rendered for visual tests by `/design-states/...`, which returns 404 in production unless `DESIGN_STATES=1` (set in CI only). Reason: those states cannot be caught reliably otherwise.
- Visual tests run in their own Playwright project before the flow tests. Reason: flow tests create campaigns that would change the seeded screens.
