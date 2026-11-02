# Handover: Maison d'Élites content rewards platform

Written 2026-11-02 for the engineer taking over the platform. This is the full picture: what the product
is, what has been built, how it runs, how the work is done with Claude, the rules the owner has set,
and what is still open. Read it once end to end, then keep `docs/DEVELOPER.md` (the technical
handbook) and `DECISIONS.md` (every decision and owner rule) open while you work.

## 1. What the platform is

Maison d'Élites runs paid clipping campaigns for music artists and brands.

1. A **client** pays a budget for a campaign (usually a song or a launch).
2. **Clippers** (creators) post short videos on their own TikTok, Instagram, YouTube or X accounts and
   submit the links in the app.
3. The platform **checks** each post automatically, then **tracks its views** on a schedule.
4. **Staff** review posts, handle appeals and verifications, and pay clippers from the budget at a set
   rate per 1,000 views.
5. The client watches results on a **live report link** and receives designed **weekly and final
   reports**.
6. Approved **partners** (e.g. Wyde) can read campaign stats through a read-only **partner API**.

Four audiences, one app:

| Who | Where |
| --- | --- |
| Clippers | app.maisondelites.com (Campaigns, My campaigns, Wallet, Submissions, Leaderboard...) |
| Staff | app.maisondelites.com/admin (sign in at /staff/sign-in) |
| Clients | report links /r/... and published reports /reports/...; brand site maisondelites.com |
| Partners | app.maisondelites.com/developers (docs) and /api/v1 (API) |

The repo also contains the **older static site** (repo root: `index.html`, client folders, `worker.js`)
served by a Cloudflare Worker at campaigns.maisondelites.com. It is separate from the platform. Anything
that must not be public there is listed in `.assetsignore`; keep it that way.

## 2. People and ownership

- **Owner:** Jacques (repo owner `jacques-netizen`). Decides product, money rules and design. Ask him
  before changing anything in section 6 marked as an owner rule.
- **Operations:** Kymen Carter (admin on the platform) sends feature requests and testing reports.
- **You:** AI engineering. You own the code, deploys, CI, the data providers and their costs, and
  keeping `DECISIONS.md` and the docs true.

## 3. Access you need (checklist)

| What | How you get it | Why |
| --- | --- | --- |
| GitHub repo `jacques-netizen/landingpage` | Owner adds you as a collaborator (write) | All code and docs |
| Railway project | Owner invites you (Project settings, Members) | Deploys, logs, environment variables, Postgres and Redis |
| Platform admin | Owner adds your email at Admin, Team, role Admin | Use the admin, test, issue partner keys |
| Claude account with Claude Code | Your own | How the code is written (section 5) |
| Scrape Creators | Owner shares the account | Data provider credits (paid per request) |
| Resend | Owner shares | Email sending |
| Google Cloud project | Owner shares | Google sign-in and YouTube API |
| Cloudflare | Owner shares | DNS for maisondelites.com and its subdomains, the static site |
| Anthropic API key | Already in Railway (`ANTHROPIC_API_KEY`) | Claude writes client reports |

Secrets live in Railway's variables. Never paste them into chat, commits or docs.

## 4. How it is built and runs

Full detail is in `docs/DEVELOPER.md`. The short version:

- **Monorepo** (pnpm 10, Node 22, TypeScript). `apps/web` is the Next.js 16 app (creator app, admin,
  brand site, reports, API). `apps/worker` runs background jobs on BullMQ/Redis. Domain logic lives in
  `packages/*`: `db` (Drizzle schema and migrations), `money` (the ledger), `campaigns`, `submissions`,
  `tracking`, `review`, `platforms`, `notifications`, `partners`, `config`, `ui`, `seed`.
- **Hosting:** Railway, one Docker image (`apps/Dockerfile`) run as two services, **web** and
  **worker**, plus Railway Postgres and Redis. The web service runs `pnpm db:migrate` before every
  deploy. Health check: `/api/health` (also shows the worker heartbeat, the data provider per platform
  and stale campaigns).
- **Deploys:** every push to the deploy branch rebuilds both services. Today that branch is
  `claude/eager-curie-n4llvh`. See section 9 for the recommended change.
- **CI:** `.github/workflows/platform-ci.yml` runs lint, format check, typecheck, unit and integration
  tests, a migrations check, the designed-screen visual tests, the build and the end-to-end tests.
- **Data providers:** Scrape Creators for TikTok, Instagram and X (costs money per request); the
  YouTube Data API for YouTube. A mock provider is used in tests and local development.
- **Background jobs** (worker): view checks (every minute, for posts that are due), emails, partner
  webhooks, campaign lifecycle, snapshot watch, account recheck, earnings release, appeal deadlines,
  daily ledger check, strike expiry. Table in `docs/DEVELOPER.md` section 9.

## 5. How the work is done with Claude

All of the platform was built with Claude Code working in this repository. The repo is the memory:
nothing from past chats carries over, so everything that matters is written down here.

- **Start of every session** Claude reads `CLAUDE.md`, which tells it to read `docs/` (the brief 01 to
  05, the design handoff) and `DECISIONS.md`. Add `docs/DEVELOPER.md` and this file.
- **Where:** claude.ai/code (cloud sessions on the GitHub repo), the Claude desktop app, or the `claude`
  command in a local clone. Connect your GitHub account so it can push.
- **Working style that has worked:** one change per request; ask Claude to research and plan first for
  anything that touches money or a designed screen; let it run the tests and check the result on the
  real app before pushing; one task per commit with a plain message.
- **When the docs are silent** Claude picks the simplest option and records it in `DECISIONS.md` with a
  one line reason. Read new entries; they are how you know what changed and why.
- **Claude Cowork** has been used for tasks in the browser (Railway dashboard, DNS, uploading files in
  the admin). Give it exact steps and tell it not to change settings beyond the task.

First message to paste into a new Claude Code session:

```
You are taking over the Maison d'Élites content rewards platform in this repository.
Read CLAUDE.md and follow its start-of-session reading order, then read docs/DEVELOPER.md,
docs/HANDOVER.md and DECISIONS.md in full. Do not change any code yet.
Then tell me, briefly: what the platform does, how it is deployed, the rules you must never break,
and the open items in docs/HANDOVER.md section 11. Wait for my instructions after that.
```

## 6. Rules that are never broken

From `CLAUDE.md` and the owner. Claude follows these; you should too.

1. **The design is locked.** The mockups in `docs/design/handoff/` decide every visual and copy detail
   of the screens they show. Visual tests compare against `docs/design/reference-screens/`. Never update
   a reference screenshot unless the owner says so in writing. New screens reuse the existing fonts,
   colours and components. No em dashes in interface copy.
2. **Money is whole cents in USD, never floats, rounded down.** Every money movement goes through
   `packages/money/src/engine.ts` as a balanced ledger transaction. Write the tests first for anything
   that touches money. Never change a money rule without the owner's written OK.
3. **Every staff action that changes money, a decision or a user writes to the audit log.**
4. **Never invent numbers, claims or testimonials.** Marketing copy is approved content only.
5. **Keep the repo's non-public files out of the static site** (`.assetsignore`).
6. **Never run the seed against production** (it refuses) and never set test-only variables there.

## 7. What has been built

Grouped by area. Every item has a matching entry in `DECISIONS.md` with its reason.

**Sites and access**
- Brand site (maisondelites.com): designed from the mockups, Dark and Glass themes (Glass default), case
  studies, logo wall, pricing, Book a call, legal pages (version 1 in force from 2026-10-10). Staff edit
  its words and videos at Admin, Brand site.
- Creator app with one menu on every screen; signed-in people land on Campaigns.
- Staff admin in a dark console, organised by campaign. Roles: reviewer, finance, admin.

**Accounts**
- Sign up with username, email, password, optional Discord name; signed in at once. Email code for new
  devices; sessions last 90 days. Email link and Google sign-in also work. No age requirement.
- Profile picture, username shown everywhere instead of the email.
- Account linking (bio code or YouTube login) is **on** (`apps/web/src/lib/features.ts`): clippers link
  and verify each account with a code in their bio, and submit posts only from a verified account. It
  was off from 2026-10-08 to 2026-11-02.

**Campaigns**
- Builder (essentials first, "More rules" for caps and requirements), uploads for the cover and assets,
  one-step **Go live** (records the client's payment, funds and publishes).
- Live changes allowed: rate (existing posts keep theirs), budget up or down, caps. Close, resume (until
  earnings release), cancel (never funded), delete.
- Campaign workspace tabs: Review, Verifications, Clips, Clippers, Payouts, Pages, Overview, Reports,
  Settings. Refresh stats now. Featured campaign chosen by admins. Demo campaigns for showcases.

**Submissions and tracking**
- 11 automatic checks at submission; a post is never refused because the platform could not be reached
  (it goes to a reviewer instead). Short share links are followed.
- Views read hourly for 72 hours, then every 6 hours until close (settings). Every view counts,
  including those at submission (baseline 0). Fraud flags pause a post for a reviewer.
- View verifications: clippers record their insights for picture posts or stuck counts; staff can also
  set views from analytics a clipper sent them.
- Staff can add posts from **any CSV** that holds post links, and add **clips that are no longer online**
  from their video files (shown on the report, never checked, never paid).

**Review**
- Review queue with keyboard shortcuts, reasons and notes; full post page; appeals with business-day
  deadlines; warnings, strikes and suspension (admin only, never automatic); notifications in-app and by
  email.

**Money and payouts**
- Double-entry ledger, earnings recomputed from views after every check, held pending until the campaign
  closes and the 7-day review window passes, then available.
- Withdrawals: minimum $5, no fee by default. Methods: USDC on Solana or BEP-20; USDT on Solana, BEP-20
  or TRC-20; bank transfer (UK sort code; address for tier 1 countries). Staff verify, send by hand,
  then mark paid with the transaction hash or bank reference.
- Admin credits to any user (admin only, audited). Daily ledger check.

**Client reporting**
- Live report link per campaign (/r/token), revocable, refreshing every 2 minutes, CSV export.
- Per campaign: "show spend at twice what clippers earn" (client spend factor) and a separate budget
  shown to the client. Used on Marrz-Audio and Davido X Winnerman-Audio.
- Designed weekly and final reports (/reports/slug and .pdf), drafted from data and rewritten by Claude
  through a JSON spec, with writing rules checked in code, versions, and stale-sentence detection.

**Partner API and developer site**
- Read-only API (/api/v1) with keys issued by admins at Admin, Developers (sandbox and live), webhooks
  signed with HMAC, 600 requests a minute per key, OpenAPI file, public docs at /developers. Never
  exposes money amounts or clippers' personal details.

## 8. Owner rules worth knowing by heart

All in `DECISIONS.md`; these come up most.

- Every view counts toward payout, including views at submission (2026-10-26).
- Minimum withdrawal $5. Payout methods as in section 7.
- Checks run every 6 hours after a post's first 72 hours, to keep Scrape Creators costs down. Do not
  add needless refreshes or provider calls in loops; tests use the mock provider.
- No ad disclosure rule; only the hashtags a campaign lists are required.
- Every clipper must link and verify their accounts before submitting (back on 2026-11-02).
- Client report: rejected and removed posts never appear; clippers appear by public handle only.
- Marrz-Audio and Davido X Winnerman-Audio report spend at twice clipper earnings.
- One Billion Dollar Billboard: each post was paid $10 plus $3 per 1,000 views **outside the platform**.
  Those posts never earn here; the report counts that outside pay as spend.
- The leaderboard ranks by counted views on approved posts; staff-added posts are left off it.

## 9. Day-to-day operations

- **Is it healthy?** `/api/health` returns `ok`, a recent worker heartbeat, a provider per platform and
  no stale campaigns. The admin home shows red notices for the same things.
- **Deploying:** push to the deploy branch; Railway rebuilds both services and runs migrations first.
  If a deploy does not go live, read the deploy and pre-deploy logs in Railway (web service,
  Deployments). Nothing else shows why.
- **Recommended change:** work has been pushed straight to `claude/eager-curie-n4llvh`. Merge it into
  `main`, point Railway at `main`, and from then on work in branches with pull requests, so nothing goes
  live without a review and green CI.
- **Database changes:** edit `packages/db/src/schema.ts`, run `pnpm db:generate`, commit the migration.
  One-off data fixes go in a SQL migration (or the migrate step) so they run once on deploy.
- **Costs to watch:** Scrape Creators credits (every view check and refresh), Anthropic (report
  writing), Resend, Railway.
- **Production data:** there is no direct database access from Claude sessions. Changes to live data
  go through the admin, a migration, or the Railway console.

## 10. Where to find things

| Need | Look in |
| --- | --- |
| Product brief | `docs/01_PRODUCT.md` to `docs/05_DESIGN_SYSTEM.md` |
| Technical handbook | `docs/DEVELOPER.md` |
| Every decision and owner rule | `DECISIONS.md` |
| Project rules for Claude | `CLAUDE.md` |
| Deploy setup | `docs/DEPLOY_PLATFORM.md` |
| Locked design | `docs/design/handoff/`, `docs/design/reference-screens/` (Git LFS) |
| Staff procedures | The "Maison d'Élites Platform SOPs" doc the owner shares |
| Partner API docs | `/developers` on the app; source in `apps/web/src/app/developers/` |

## 11. Open items

- **Payouts upgrade** (Payouts tab per campaign, payout minimum, reminders, 48-hour hold, CSV export,
  Marrz check): a plan was given; it waits on the owner's answers to five questions (mark paid vs wallet
  withdrawals, ready at close or after release, legacy crypto networks, how the minimum is compared,
  how to verify Marrz). Do not build without his OK.
- **Recent deploys** are not reaching the live site; start with the Railway deploy logs (section 9).
- **developers.maisondelites.com** needs its DNS record (Cloudflare) and a custom domain in Railway.
- **CI** fails at the designed-screen visual test step; everything before it passes. Find out why
  (likely the Git LFS screenshots not being fetched) and get CI fully green.
- **Imported stand-in clippers:** posts added from a CSV or video files for people without an account
  go to stand-in clippers. There is no tool yet to move them to the real clipper once they sign up.
- **On hold by the owner:** visible review queue filters and bulk approve; a designed leaderboard.
- **Owner to confirm:** the legal entity name used in the legal documents; destinations for the brand
  site's Careers link; remaining case study videos.

## 12. Suggested first week

1. Get access (section 3). Read this file, `docs/DEVELOPER.md` and `DECISIONS.md`.
2. Run the platform locally (`docs/DEVELOPER.md` section 4) and the tests.
3. Sign in to the live admin, walk through one campaign's tabs and a client report.
4. Fix the deploy pipeline: Railway logs, branch setup (section 9), CI to green.
5. Agree with the owner on the open items and their order, then take them one at a time.
