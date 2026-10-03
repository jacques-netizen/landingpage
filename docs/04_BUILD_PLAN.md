# 04 Build plan

## 1. Stack

Chosen to be common, well documented and easy to build with. Do not swap parts without writing the reason in `DECISIONS.md`.

| Part | Choice |
| --- | --- |
| Language | TypeScript, strict mode, everywhere |
| Web app | Next.js (App Router), React server components where useful |
| Styling | Tailwind CSS with the tokens in `05_DESIGN_SYSTEM.md`. No component library styling left at default. Radix UI primitives are allowed for behaviour (dialogs, menus, tabs) |
| Database | PostgreSQL |
| ORM and migrations | Drizzle ORM with SQL migrations committed to the repo |
| Validation | Zod |
| Auth | Auth.js with email magic link, Google and Discord, using the database adapter |
| Jobs | BullMQ on Redis (or a hosted job service with the same guarantees) |
| Files | S3 compatible object storage (Cloudflare R2) with signed URLs |
| Email | Resend (or equivalent) with React Email templates |
| Payments | Stripe Connect Express for creator payouts and identity, PayPal Payouts as a second method |
| Errors and logs | Sentry, structured logs |
| Tests | Vitest for unit and integration, Playwright for end to end |
| Hosting | Web on Vercel, database managed Postgres, Redis managed, workers on a small container host |
| CI | GitHub Actions: type check, lint, tests, migrations check on every pull request |

## 2. Repository layout

```
/apps
  /web                 Next.js app (public site, creator app, staff admin, report pages)
  /worker              Job runner (view checks, lifecycle, releases, notifications)
/packages
  /db                  Drizzle schema, migrations, seed scripts
  /money               The ledger and earnings engine. Pure functions plus the database layer. No UI imports
  /providers           ViewProvider interface and implementations
  /config              Settings keys, defaults, reason codes, env parsing
  /ui                  Design tokens and shared components
/docs                  This build pack
DECISIONS.md           Choices made while building
```

`/packages/money` must have no dependency on web code. It is the most tested code in the project.

## 3. Environment variables

`DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, `TOKEN_ENCRYPTION_KEY`, `STORAGE_*`, `EMAIL_API_KEY`, `EMAIL_FROM`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `YOUTUBE_API_KEY`, `META_APP_ID`, `META_APP_SECRET`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `DATA_PROVIDER_API_KEY`, `SENTRY_DSN`, `BRAND_NAME`, `LEGAL_ENTITY`, `CONTACT_EMAIL`, `SUPPORT_DISCORD_URL`, `APP_URL`.

Provide `.env.example` with every key and no values. The app must start in development with only `DATABASE_URL`, `REDIS_URL` and `AUTH_SECRET` set, using the mock provider and a mock payout adapter.

## 4. Phases

Each phase ends with its acceptance checks. Do not start the next phase until they pass. Each task is one commit.

### Phase 0: Foundation

Tasks
1. Create the monorepo, TypeScript config, lint, formatting, CI.
2. Add Tailwind and the design tokens from `05_DESIGN_SYSTEM.md` (colours, type, radii, shadows, spacing). Load the fonts.
3. Build the base layout components: top navigation pill, page container, footer, buttons (primary, secondary, quiet), inputs, select, checkbox, toggle, tabs, dialog, drawer, toast, table, badge, avatar stack, empty state.
4. Add the database package, all tables from `02_DATA_AND_MONEY.md`, migrations and the seed script.
5. Add Auth.js with email, Google and Discord, age confirmation and terms checkbox on sign up.
6. Add staff roles and route guards for `/admin`.
7. Add the settings table with defaults and the audit log helper.

Acceptance
- A new user can sign up, sign in and sign out with each method.
- A non-staff user gets a 403 on every `/admin` route and every `/api/v1/admin` route.
- Every component in the list exists on a `/styleguide` page in all its states.
- CI passes on a clean clone.

### Phase 1: Money engine first

Tasks
1. Write the test cases in `02_DATA_AND_MONEY.md` section 7 as failing tests.
2. Implement `/packages/money`: accounts, transactions, idempotency, earnings function, release, reversal, withdrawal quote.
3. Add the database trigger or constraint that rejects any unbalanced transaction.
4. Add the property tests.

Acceptance
- All 13 cases pass. All property tests pass with 10,000 random runs.
- Two concurrent earnings jobs on the same campaign never overspend the budget (test with parallel runs).

### Phase 2: Campaigns and the public site

Tasks
1. Staff campaign builder with every field and template, saved as `draft`.
2. Terms version creation and locking.
3. Client records, funding entry form (`client_funding_received`, `campaign_funded`, `service_fee_taken`), campaign goes `live` only when funded.
4. Public campaigns list and campaign page with every rule shown. Private campaigns need the code.
5. Join action.
6. Home, how it works, for clients (enquiry form), fees, help, legal pages (text placeholders marked clearly), sign in and sign up screens.
7. Campaign lifecycle job (open and close by date, close when budget is used).

Acceptance
- A staff user can create, fund and publish a campaign in under 5 minutes.
- A visitor sees every rule from section 6.3 of `01_PRODUCT.md` without signing in.
- A campaign cannot go live with partial funding.
- The fees page reads its numbers from settings.

### Phase 3: Accounts and submissions

Tasks
1. Accounts screen and the bio code flow with the mock provider.
2. `YouTubeApiProvider` and YouTube OAuth.
3. Submission form with live check results (checks 1 to 11 in `03_SYSTEMS.md` section 4).
4. Submissions table and detail drawer for creators.
5. Reason codes table with editable messages.

Acceptance
- A creator can link an account by bio code and by YouTube login.
- Each automatic check has a test and returns the right reason code.
- A rejected submission shows the creator message for its reason code.

### Phase 4: View tracking and earnings

Tasks
1. View check job, snapshot storage, scheduler by the interval table.
2. Earnings engine hooked to the view check.
3. Creator overview, my campaigns and wallet (pending, available, paid out, transactions).
4. Campaign monitor for staff.
5. Fraud rules `view_jump`, `engagement_below_floor`, `wrong_author`, `follower_drop`.

Acceptance
- With the mock provider scripted to rising views, pending earnings grow correctly and match a hand calculation.
- Running the same check twice changes nothing.
- A scripted view jump creates a flag and pauses earnings.
- The ledger check job reports zero errors.

### Phase 5: Review, appeals, warnings

Tasks
1. Review queue with filters, keyboard shortcuts and bulk approve for clean posts.
2. Post detail with view chart, checks, decision history and reason picker.
3. Duplicate media check and its flag.
4. Appeals (creator side and staff inbox) with due dates.
5. Warnings, strikes, suspension suggestion and suspend action.
6. Creator notifications in the app and by email for every event in `03_SYSTEMS.md` section 9.

Acceptance
- A reviewer can clear 50 clean posts in under 10 minutes with the keyboard.
- Rejecting an approved post reverses its earnings exactly.
- An overturned appeal restores the post and the next check pays it.
- Staff see appeals ordered by deadline and the dashboard flags any within 24 hours.

### Phase 6: Payouts

Tasks
1. Payout settings: Stripe Connect Express onboarding and PayPal address, with identity status shown.
2. Withdraw flow with quote (fee and net shown before confirming).
3. Finance approval, batches, sending, webhooks, status updates, retries.
4. Release earnings job.
5. Remainder return at campaign close.

Acceptance
- With partner test accounts, a withdrawal goes from request to paid with correct ledger entries.
- A failed payout returns the money to available in full.
- A creator without verified payout status cannot request a withdrawal.
- The withdraw quote shown in the browser equals the server's number in every test case.

### Phase 7: Client reports and polish

Tasks
1. Client report page and CSV, with report link creation and revoking.
2. Staff dashboard, clients and funding screens, creators screen, ledger screen, audit log screen, settings screen.
3. Remaining OAuth providers (Instagram, TikTok) as access is approved. Third-party data provider integration for bio-code accounts.
4. Help centre content, SEO basics (titles, descriptions, sitemap), social share images, cookie notice.
5. Accessibility pass and performance pass.

Acceptance
- A client opens a report link on a phone and finds spend, views, posts and the CSV without any guidance.
- A revoked link shows a plain message and no data.
- Lighthouse scores of 90 or more for accessibility and best practices on the public pages.
- Every screen has designed loading, empty and error states.

### Phase 8: Hardening and launch

See the launch checklist in section 7.

## 5. Test plan

- Unit tests for the money package, check functions, reason code mapping, URL parsing for each platform, fee quote.
- Integration tests against a real Postgres for ledger writes, concurrency and idempotency.
- Provider contract tests: the same suite runs against the mock provider and, with recorded fixtures, against each real provider.
- End to end tests (Playwright): sign up and link an account; join and submit; staff approve; views rise; wallet updates; withdraw to a partner test account; appeal flow; client report link.
- Security tests: route guard tests for every admin route, token encryption round trip, webhook signature rejection.
- Load check: 20,000 active submissions on the schedule in 3.2 must be checked without a queue backlog beyond 15 minutes.

## 6. Seed data

A seed script creates: three staff users (reviewer, finance, admin), 30 creators, 5 clients, 8 campaigns across all four types and states, 200 submissions in mixed states, view snapshots with a few scripted jumps, appeals, warnings, and a funded ledger that balances. Seed data is for development only and is clearly marked. The UI must never show invented data in production.

## 7. Launch checklist

- Terms, privacy policy and campaign rules from a lawyer, loaded as versions.
- Operating company name, address and contact set in config and shown in the footer.
- Payout partner accounts approved for live use. Test a real small withdrawal end to end.
- Identity and tax handling confirmed with an accountant for the countries creators live in.
- OAuth apps approved for each platform in use, or bio code only for the others.
- Data provider contract signed and tested for bio-code accounts.
- Backups on, restore tested once. Database point-in-time recovery enabled.
- Error tracking and alerts working. Ledger check job alerting works.
- Rate limits and security headers on. Staff 2FA on for finance and admin.
- Secrets rotated away from development values.
- A dry run: one real campaign with five creators and a small budget, paid out in full, before the first client campaign.
- A public status contact for creators and a support process with a named owner.

## 8. Later (not in version one)

- Client login, self-serve campaign creation, card funding by checkout
- Public submit API with keys and a Discord submit command
- Referrals, ranks, levels and leaderboards (with a private option)
- Paid-ad licensing of creator posts with a creator boost fee
- Mobile apps
- More payout methods (USDC)
- Machine-learning fraud scoring trained on staff decisions
- Dark mode
- Multi-currency and tax forms per country
