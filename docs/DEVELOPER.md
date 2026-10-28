# Developer handbook: Maison d'Élites content rewards platform

Last updated 2026-10-28. This is the guide for a developer joining the project: what the platform does,
how the code is laid out, how to run it, how money moves, and how it is deployed. It describes the code
as it is today. Where it and the older brief in `01` to `05` disagree, this file and `DECISIONS.md` win.

## 1. What the platform does

Clients fund a budget for a campaign (usually a song). Clippers (creators) post short videos on their own
TikTok, Instagram, YouTube or X accounts and submit the links. The platform checks each post, tracks its
views every hour, and pays the clipper from the budget at a set rate per 1,000 views. Staff (Maison
d'Élites) run every campaign: they review posts, verify views, pay out, and send the client a report.

Live addresses:

| Address | What it serves |
| --- | --- |
| `app.maisondelites.com` | Creator app (`/campaigns`, `/submissions`, `/wallet`...), staff admin (`/admin`), client report links (`/r/<token>`), published client reports (`/reports/<slug>`) |
| `maisondelites.com` | The brand site (`/`, `/for-clients`, `/legal/*`), served by the same Next.js app |
| `campaigns.maisondelites.com` and the static pages in the repo root | The older static site and client dashboards on a Cloudflare Worker (`worker.js`, `DEPLOY.md`, `SOP.md`). Separate from the platform |

## 2. Repository layout

The repository holds two things: the old static site (repo root: `index.html`, client folders,
`worker.js`, `wrangler.toml`) and the platform, a pnpm monorepo in `apps/` and `packages/`. Anything
that must not be public on the Cloudflare static site is listed in `.assetsignore`.

```
apps/
  web/          Next.js 16 app: creator app, staff admin, brand site, client reports, API routes
  worker/       Background jobs (BullMQ on Redis): view checks, releases, emails...
  Dockerfile    One image for both services
  railway.web.json, railway.worker.json   Railway config for each service
packages/
  db/           Drizzle schema (schema.ts), migrations, migrate/seed/staff:grant scripts, audit log
  config/       Environment variables (env.ts), staff roles, settings, reason codes
  money/        The ledger and every money operation (engine.ts), earnings rules, ledger check
  campaigns/    Campaign service (create, publish, budget, close, reopen), client report queries
  submissions/  Submitting a post, the automatic checks, states, check schedule
  tracking/     View checks, fraud flags, account rechecks, releasing earnings
  review/       Staff decisions, appeals, warnings and strikes, view verifications
  platforms/    Data providers: Scrape Creators (TikTok, Instagram, X), YouTube API, mock; bio codes, OAuth
  notifications/ In-app and email notifications, email sending, appeal deadlines
  ui/           Shared React components and design tokens
  seed/         Sample data for local development and tests
docs/           The original brief (01-05), deploy guide, design handoff and locked screenshots
DECISIONS.md    Every choice made where the brief was silent, and every owner rule since. Read it.
CLAUDE.md       The rules the project is built under (locked design, money rules, commits)
```

Inside `apps/web/src`:

| Folder | What is there |
| --- | --- |
| `app/` | Routes (App Router). `(auth)` sign-in and sign-up, `(public)` public pages, `admin/(nav)` the staff admin, `api/` API routes, `r/[token]` client report link, `reports/[slug]` published client report |
| `server/` | Server-only code used by pages: queries, guards (`guard.ts`), storage, rate limits, client report, Google check |
| `server/reports/` | Client report builder: data, Claude writing, versions, publishing, PDF |
| `reports/` | Pure report code: spec schema, renderer, writing rules, the reference CSS and script |
| `designed/` | Screens built pixel for pixel from the locked mockups (home, brand site, campaigns, wallet) |
| `components/`, `lib/`, `content/`, `styles/` | Shared UI, helpers, marketing copy, global CSS |
| `proxy.ts` | Next 16 "proxy" (middleware): routes the brand domain and the app domain, and guards `/admin` |
| `auth.ts` | Auth.js setup: email codes, username and password, Google, Discord |

## 3. Tech stack

- Node 22, pnpm 10 workspaces, TypeScript everywhere.
- Next.js 16 (App Router, server components, server actions). Next 16 changed several APIs; its docs
  ship in `apps/web/node_modules/next/dist/docs/`. Read them before using a Next API.
- PostgreSQL with Drizzle ORM. Redis (ioredis) for rate limits, caches and the job queue (BullMQ).
- Auth.js (next-auth v5) with a Drizzle adapter.
- Tailwind CSS 4 for the app; the designed screens use the mockups' own CSS.
- Vitest for unit and integration tests, Playwright for end-to-end and visual tests.
- Resend for email, Scrape Creators for TikTok/Instagram/X data, YouTube Data API v3, Anthropic API
  (Claude) for writing client reports, headless Chromium (playwright-core) for report PDFs.

## 4. Running it locally

You need Node 22, pnpm 10, PostgreSQL 16 and Redis.

```bash
pnpm install
cp .env.example apps/web/.env.local   # every variable, empty; or export them as below
export DATABASE_URL=postgres://postgres@localhost:5432/mde
export REDIS_URL=redis://localhost:6379
export AUTH_SECRET=$(openssl rand -base64 48)
export MOCK_PROVIDER=1          # fake post data instead of Scrape Creators
export EMAIL_DEV_OUTBOX=1       # sign-in emails written to a local outbox instead of sent
pnpm db:migrate                 # apply migrations
pnpm db:seed                    # sample campaigns, creators and staff (refuses to run on production)
pnpm dev                        # web app on http://localhost:3000
pnpm worker                     # background jobs, in a second terminal
```

Staff sign in at `/staff/sign-in`. Give an address a role with `pnpm staff:grant you@example.com admin`
(roles: `reviewer`, `finance`, `admin`), or set `ADMIN_EMAIL` and sign in with it.

Useful commands (from the repository root):

| Command | Does |
| --- | --- |
| `pnpm typecheck` | TypeScript across every package |
| `pnpm lint`, `pnpm format:check` | ESLint and Prettier |
| `pnpm test` | Every package's Vitest suite (needs Postgres; each package uses its own test database) |
| `pnpm test:e2e` | Playwright end-to-end and visual tests against a built app |
| `pnpm db:generate` | New migration from schema changes (`npx drizzle-kit generate --custom --name x` in `packages/db` for SQL-only data migrations) |

## 5. Environment variables

Defined and validated in `packages/config/src/env.ts`. Only the first three are required to start.
Set the same values on the web and worker services.

| Variable | Needed for |
| --- | --- |
| `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET` | Required |
| `APP_URL` | The app's own address, e.g. `https://app.maisondelites.com` (no trailing slash) |
| `BRAND_HOST` | `maisondelites.com`: which domain shows the brand site |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Resend; sign-in codes and notifications |
| `DATA_PROVIDER_API_KEY` | Scrape Creators: views for TikTok, Instagram and X |
| `YOUTUBE_API_KEY` | YouTube views |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google sign-in and "Link with YouTube". The OAuth client must list `APP_URL/api/auth/callback/google` and `APP_URL/api/oauth/youtube/callback` |
| `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET` | Discord sign-in |
| `TOKEN_ENCRYPTION_KEY` | Encrypts linked YouTube tokens. Never change it once set |
| `ANTHROPIC_API_KEY` | Claude writes and edits client reports. Without it reports start from a plain draft |
| `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_REGION` | S3-compatible bucket for uploads. Unset: files up to 25 MB are kept in Postgres |
| `ADMIN_EMAIL` | Comma-separated addresses that become admin when they sign in |
| `BRAND_NAME`, `LEGAL_ENTITY`, `CONTACT_EMAIL`, `SUPPORT_DISCORD_URL` | Shown in the interface and emails |
| `STRIPE_*`, `PAYPAL_*`, `META_*`, `TIKTOK_*`, `SENTRY_DSN` | Reserved; not in use yet |

Test-only, never in production: `MOCK_PROVIDER`, `MOCK_PROVIDER_FILE`, `EMAIL_DEV_OUTBOX`,
`DESIGN_STATES`, the `*_URL_OVERRIDE` variables and the `*_TEST_DATABASE_URL` variables.

## 6. Data model

All tables are in `packages/db/src/schema.ts`; migrations in `packages/db/migrations/` (0000 to 0037).

| Area | Tables |
| --- | --- |
| People and access | `users`, `creator_profiles`, `staff_roles`, `sessions`, `auth_identities`, `sign_in_codes`, `trusted_devices`, `api_keys` |
| Accounts on platforms | `linked_accounts` (handle, followers, how it was verified: bio code or OAuth) |
| Clients and campaigns | `clients`, `campaigns`, `campaign_members`, `terms_versions`, `client_report_links` |
| Posts | `submissions`, `view_snapshots` (every read), `view_snapshot_days` (one row per post per day), `review_decisions`, `fraud_flags`, `appeals`, `view_proofs`, `warnings` |
| Money | `ledger_accounts`, `ledger_transactions`, `ledger_entries`, `withdrawals`, `payout_batches` |
| Client reports | `campaign_reports`, `campaign_report_versions` |
| Everything else | `notifications`, `settings`, `reason_codes`, `legal_documents`, `files`, `audit_log` (append only; a trigger blocks updates and deletes) |

Campaign status: `draft` → `awaiting_funding` → `live` → `closing` (budget used up) → `closed`, or
`cancelled`. A closed campaign can be resumed (`reopenCampaign`) until its earnings are released.

Submission states: `checking`, `rejected_auto`, `needs_review`, `needs_info`, `approved`, `earning`,
`flagged`, `final` (campaign closed), `paid_out`, `rejected`, `removed`, `appealed`. What creators see
for each is in `packages/submissions/src/states.ts`.

Campaign columns worth knowing: `rate_cents_per_1000`, `budget_cents`, `cap_per_post_cents`,
`cap_per_creator_cents`, `min_views_to_earn`, `client_spend_factor` (the client report shows spend at
this multiple, e.g. 2 for a $2 client CPM on a $1 clipper rate), `client_budget_cents` (the budget the
client report shows), `demo` (showcase campaigns, never tracked or paid).

## 7. Money

The rules are in `docs/02_DATA_AND_MONEY.md` (read it) and `DECISIONS.md`. The short version:

- Money is whole cents in USD, stored as `bigint`. Never floats. Rounding is always down
  (`mulDivFloor` in `packages/money/src/math.ts`).
- Every movement is a balanced double-entry transaction in the ledger, written only by
  `packages/money/src/engine.ts`. Nothing else writes ledger rows. Each transaction has an idempotency
  key, so a retried job never pays twice.
- Ledger accounts: `client_funds_holding` → `campaign_budget` → `creator_pending` →
  `creator_available` → `payout_in_transit` → `external`; MDE's fee goes to `platform_revenue`.
- Operations: `recordClientFunding`, `fundCampaign`, `changeCampaignBudget`, `accrueEarnings`,
  `reverseEarnings`, `releaseEarnings`, `requestWithdrawal`, `approveWithdrawal`, `markWithdrawalPaid`,
  `markWithdrawalFailed`, `returnCampaignRemainder`, `manualAdjustment`.
- A post's earnings are recomputed in full from its counted views every time
  (`postEarnings` in `earnings.ts`): views × locked rate / 1,000, zero below the campaign's minimum,
  then capped per post, per creator and by what is left in the budget. The difference from what it
  already earned is posted.
- Counted views are every view the post has, including the ones it had when it was submitted (owner
  rule, 2026-10-26; the baseline is always 0). A verified count from staff or the clipper stands until
  the scraper reads more.
- Earnings only grow while the post is approved and the campaign is `live`. When the campaign closes,
  posts become `final`; after the review window (7 days, a setting) `release-earnings` moves them to
  `creator_available` and returns the unused budget.
- The `ledger-check` job checks every day that the ledger balances and matches the posts.
- Every staff action that changes money, a decision or a user writes to `audit_log` (`writeAudit`).
- Write the tests first for any change that touches money.

## 8. View tracking

`packages/tracking/src/view-check.ts`, run by the `view-checks` job every minute for posts that are due.
Each post has its own `next_check_at` from the interval table in settings (frequent at first, then
hourly). A check:

1. Reads the post from the provider (`packages/platforms`: Scrape Creators for TikTok, Instagram and X;
   the YouTube API; OAuth tokens when the account is linked that way).
2. Writes a `view_snapshots` row and updates `view_snapshot_days`.
3. Runs the fraud rules (`fraud.ts`): wrong author, engagement below the floor, view spikes and so on.
   A new flag pauses the post (`flagged`) for a reviewer.
4. Updates `latest_views` and `counted_views`, then calls `accrueEarnings`.
5. Removes a post that has been missing or private for the grace period, reversing unpaid earnings.

Staff can press "Refresh stats" on a campaign to check every post at once (same code path).
Scrape Creators charges per request: avoid needless refreshes and never loop over provider calls in tests
(the mock provider exists for that).

## 9. Background jobs

`apps/worker/src/jobs.ts`. Every job must be safe to run twice.

| Job | Every | Does |
| --- | --- | --- |
| `view-checks` | 1 min | Checks posts that are due, pays earnings |
| `email-send` | 1 min | Sends pending notification emails, with retries |
| `campaign-lifecycle` | 5 min | Closes campaigns past their end date or out of budget |
| `snapshot-watch` | 15 min | Logs an error when a live campaign has had no snapshot for 3 hours |
| `account-recheck` | 1 h | Rechecks each verified account once a day |
| `release-earnings` | 1 h | Releases earnings after the review window, returns unused budget |
| `appeal-deadlines` | 1 h | Warns staff about appeals due within 24 hours |
| `ledger-check` | 1 day | Checks the ledger's money properties |
| `strike-expiry` | 1 day | Expires old strikes |

The admin home warns when the worker has not reported for 10 minutes.

## 10. Staff admin (`/admin`)

Roles (`packages/config/src/roles.ts`): `reviewer` can open the admin and review; `finance` and `admin`
can do anything with money; only `admin` can change settings, roles and terms. `proxy.ts` blocks
`/admin` for non-staff, and every page and action checks again with `requireStaff(access)`.

Everything is organised by campaign. The admin home lists campaigns with what is waiting on each. A
campaign's workspace has tabs: Review, Verifications, Clips, Clippers, Payouts, Pages, Overview,
Reports, Settings. Other sections: clients, creators, appeals, payouts, credits, team, settings,
brand site content, featured campaigns, demo campaigns, notifications.

Staff tools added on owner request (details in `DECISIONS.md`): set a post's views from analytics or
ask the clipper to verify; edit caps on a live campaign; resume a closed campaign; client spend factor
and client budget per campaign; refresh stats; client report links; client reports.

## 11. Client reporting

Two kinds:

1. **Report link** (`/r/<token>`): a live dashboard of a campaign for the client. The token is signed
   with `AUTH_SECRET` and the campaign's report secret; revoking rotates the secret. Data comes from
   `campaignReport` in `packages/campaigns/src/report.ts`, shown at the client's spend factor and budget
   (`forClient`). Rejected and removed posts never show. Cached 60 seconds in Redis.
2. **Client reports** (`/reports/<artist>-week-<n>`, `/reports/<artist>-final`, add `.pdf` for the PDF):
   designed reports matching reports.maisondelites.com. Figures come from the app's data
   (`server/reports/data.ts`); the words, section switches and clip order are a JSON spec that Claude
   writes and edits (`server/reports/claude.ts`, structured output, never HTML). Every version is kept;
   writing rules (no dashes, no invented numbers) are checked in `reports/rules.ts` before saving. Weekly
   reports freeze their figures at publish; final reports read figures live and flag sentences a new
   number made wrong. PDFs are printed by headless Chromium (`server/reports/pdf.ts`).

## 11b. Partner API and developer docs

A read-only API for partners staff approve (owner decision, 2026-10-28). Code: `packages/partners`
(keys, the data shown, webhooks), routes in `apps/web/src/app/api/v1/`, docs in
`apps/web/src/app/developers/` and `apps/web/src/developers/` (the OpenAPI file `openapi.ts` builds the
reference). Admins make and revoke keys at `/admin/developers`. The worker's `partner-webhooks` job (every
minute) finds new events and delivers them. Public docs: `/developers`; OpenAPI: `/api/v1/openapi.json`.
The API never returns money amounts or clippers' personal details: keep it that way when adding fields.

## 12. Design rules

The screens in `docs/design/handoff/` are locked: build them pixel for pixel and never change layout,
copy, colours or spacing. Each designed screen has a Playwright visual test against
`docs/design/reference-screens/` (Git LFS). Never update a reference screenshot without the owner's
written approval. Screens the mockups do not show follow `docs/05_DESIGN_SYSTEM.md` in the mockups'
fonts and colours. No em dashes in interface copy. Full rules: `CLAUDE.md`.

## 13. Deployment

Railway, one Docker image (`apps/Dockerfile`) as two services: **web** (`apps/railway.web.json`, runs
`pnpm db:migrate` before each deploy, health check `/api/health`) and **worker**
(`apps/railway.worker.json`, `pnpm worker`). Postgres and Redis are Railway databases in the same
project. The image also installs Chromium for report PDFs. Every push to the deploy branch rebuilds
both services. Step-by-step setup: `docs/DEPLOY_PLATFORM.md`.

Checks after a deploy: `/api/health` returns `{"ok":true}` (it also reports the Google redirect check);
the worker logs `job done` lines; the admin home shows no red notices.

## 14. Working on the code

- Read `CLAUDE.md`, `DECISIONS.md` and the relevant brief file before changing a feature.
- When the docs do not answer a question, choose the simplest option and add a one-line entry to
  `DECISIONS.md`. Ask the owner before changing a money rule or anything in the locked design.
- One task per commit, with a plain message.
- Schema change: edit `schema.ts`, run `pnpm db:generate`, commit the migration. Data fixes go in a
  custom SQL migration so they run once on deploy.
- Tests: money and review logic have integration tests against a real Postgres in each package's
  `test/` folder; user flows are in `apps/web/e2e/`.
- Never run `pnpm db:seed` against production (it refuses), and never set the test-only variables there.
