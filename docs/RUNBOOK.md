# Runbook: running the platform from a new Claude Code account

Written 2026-11-09. Read this to move the work to another Claude Code account (or person) and keep
everything running. Nothing lives inside a Claude account: the code, its rules and its history are in
this GitHub repository, the live data and secrets are in Railway, and a new account only needs access to
both. Read `docs/HANDOVER.md` for the full picture of the product, then come back here.

## 1. What lives where

| Thing | Where it lives | What the new account needs |
| --- | --- | --- |
| All code, migrations, tests, docs | GitHub `jacques-netizen/landingpage`, branch `claude/eager-curie-n4llvh` | Write access to the repository |
| Project rules for Claude | `CLAUDE.md` (read automatically at the start of every session) | Nothing: it comes with the repository |
| Every decision and owner rule | `DECISIONS.md` | Nothing: in the repository |
| Live app, worker, Postgres, Redis | Railway project (web and worker services) | A Railway invite to see deploys and logs |
| API keys and secrets | Railway variables on both services | Nothing to copy: they stay in Railway |
| Live data (campaigns, posts, money) | Railway Postgres | No direct access; see section 6 |
| Staff procedures | "Maison d'Élites Platform SOPs" doc | The owner shares it |

The old Claude account's chat history does not move, and it is not needed: everything that mattered in
it was written into `DECISIONS.md`, `docs/HANDOVER.md`, `docs/DEVELOPER.md` and this file.

## 2. Set up the new account (once, about 20 minutes)

1. **GitHub.** If the new account belongs to the same GitHub user (`jacques-netizen`), connect GitHub in
   the new Claude account (claude.ai, Settings, Connectors or the Claude Code GitHub prompt). If it is a
   different person, the owner adds their GitHub user as a collaborator with write access
   (repository Settings, Collaborators), and they connect their own GitHub. The Claude GitHub App must
   be installed on the repository (github.com/apps/claude) so cloud sessions can push.
2. **Railway.** The owner invites the person to the Railway project (Project settings, Members). Not
   needed for Claude itself, but needed to read deploy logs when a deploy does not go live.
3. **Platform admin.** The owner adds the person's email at app.maisondelites.com, Admin, Team, role
   Admin. Staff sign in at /staff/sign-in with an email link.
4. **Start a Claude Code session** on the repository (claude.ai/code, the desktop app, or `claude` in a
   local clone). Tell it to work on the deploy branch: Railway deploys `claude/eager-curie-n4llvh`, so a
   push anywhere else does not go live. Cloud sessions get their own branch name by default; say "work
   on and push to `claude/eager-curie-n4llvh`" in the first message, or change Railway to deploy `main`
   (section 7).
5. **Cloud environment set-up (recommended).** A fresh cloud machine has no installed packages and no
   local database, so tests cannot run until they are set up. Save this as the environment's setup
   script (Claude Code on the web: environment settings, Setup script), or ask Claude to run it at the
   start of a session. Every line was run and checked on 2026-11-06:

   ```bash
   if [ -d landingpage ]; then (cd landingpage && pnpm install --frozen-lockfile); fi
   mkdir -p /var/tmp/mde-pg && chown postgres /var/tmp/mde-pg
   [ -d /var/tmp/mde-pg/data ] || su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /var/tmp/mde-pg/data -U postgres --auth=trust"
   su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/mde-pg/data -l /var/tmp/mde-pg/log -o '-p 5432 -k /tmp' start"
   (cd /tmp && redis-server --daemonize yes)
   for d in mde mde_test mde_test_money mde_test_campaigns mde_test_platforms mde_test_submissions mde_test_tracking mde_test_review mde_test_notifications mde_test_partners; do psql -h /tmp -U postgres -c "create database $d" || true; done
   ```

   The local Postgres sometimes stops between commands in a cloud machine; if a command says
   "connection refused" on `/tmp/.s.PGSQL.5432`, run the `pg_ctl ... start` line again.
6. **First message to Claude** in the new account:

   ```
   You are taking over the Maison d'Élites content rewards platform in this repository.
   Work on and push to the branch claude/eager-curie-n4llvh (Railway deploys it).
   Read CLAUDE.md and follow its start-of-session reading order, then read docs/HANDOVER.md,
   docs/RUNBOOK.md, docs/DEVELOPER.md and DECISIONS.md in full. Do not change any code yet.
   Then tell me briefly: what the platform does, how it deploys, how live data is changed without
   database access, the rules you must never break, and the open items. Then wait for instructions.
   ```

## 3. How it is built

Full detail: `docs/DEVELOPER.md`. In one page:

- **Monorepo** (pnpm 10, Node 22, TypeScript). `apps/web` is one Next.js 16 app serving the brand site
  (maisondelites.com), the creator app and staff admin (app.maisondelites.com, /admin), client reports
  (/r/token, /reports/slug), the partner API (/api/v1) and its docs (/developers). `apps/worker` runs
  scheduled jobs on BullMQ/Redis. Domain logic is in `packages/*`.
- **Packages:** `db` (Drizzle schema, migrations, migrate step, audit log), `money` (the double-entry
  ledger; the only code that moves money), `campaigns` (campaign service, client report queries),
  `submissions` (automatic checks), `tracking` (view checks, fraud rules, releases), `review`
  (decisions, appeals, strikes, verifications), `platforms` (Scrape Creators, YouTube API, mock),
  `notifications`, `partners` (API keys, webhooks), `config` (env, roles, settings), `ui`, `seed`.
- **Hosting:** Railway runs one Docker image (`apps/Dockerfile`) as two services. Web:
  `apps/railway.web.json`, runs `pnpm db:migrate` before each deploy, health check `/api/health`.
  Worker: `apps/railway.worker.json`, `pnpm worker`. Every push to the deploy branch rebuilds both.
  A newer push cancels a build still in progress, so several quick pushes can delay going live.

### The main flows

1. **Campaign:** staff build it, press Go live (records the client's payment, funds the budget in the
   ledger, publishes). Clippers join.
2. **Post:** a clipper links and verifies an account (bio code), submits a post link; 11 automatic
   checks run; it waits in Review; a reviewer approves or denies.
3. **Views and earnings:** the worker reads views (Scrape Creators or YouTube) hourly for 72 hours, then
   every 6 hours; after each read `accrueEarnings` recomputes the post's earnings from its total views,
   capped per post, per creator, by the budget, and by the client budget divided by the spend factor.
4. **Close and release:** a campaign closes at its end date or when nothing more can be earned; 7 days
   later earnings move from pending to available and the unused budget returns to the client.
5. **Payout:** a clipper withdraws ($5 minimum) to a crypto wallet or bank; finance verifies, sends by
   hand, marks paid with the hash or bank reference.
6. **Client report:** `/r/<signed token>` shows totals, spend, budget and every approved post, refreshing
   every 2 minutes. Spend = ledger earnings plus pay made outside the platform, or the per-post fee plus
   the rate on views; shown at the client's spend factor; never above the client's budget.

## 4. Rules Claude must never break

From `CLAUDE.md` and the owner; Claude reads them every session.

1. The design in `docs/design/handoff/` is locked; visual tests guard it. New screens reuse its fonts,
   colours and components. No em dashes in interface copy.
2. Money is whole US cents, never floats, rounded down. Only `packages/money` moves money. Tests first
   for anything that touches money. Ask the owner before changing a money rule.
3. Every staff action that changes money, a decision or a user is written to the audit log.
4. Never invent numbers, claims or testimonials.
5. When the docs are silent, choose the simplest option and add one line to `DECISIONS.md`.
6. One task per commit, plain message. Never run the seed against production.
7. Every Scrape Creators call costs money: no needless refreshes, never provider calls in loops in tests.
8. Never weaken TLS checks or disable security settings to reach a site.

## 5. Day-to-day: making a change

1. Read the relevant code and `DECISIONS.md` entries first.
2. Change the code. For money, write the failing test first.
3. Run the checks before pushing (they are what CI runs):
   `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, the changed package's tests
   (`cd packages/<name> && DATABASE_URL=postgres://postgres@localhost:5432/mde_test_<name> npx vitest run`),
   and for screens an end-to-end test (section 8).
4. Add a line to `DECISIONS.md`. Commit with a `Requested-by:` trailer (who asked), run
   `pnpm changelog`, commit `CHANGELOG.md` as "Update the change log", then push to the deploy branch.
5. Check it is live (section 6), then tell the owner in plain words what changed.

## 6. Live data without database access

No Claude session can reach the live database. Three ways to change live data, in order of preference:

1. **The admin.** Most things are buttons: Go live, budget, Resume, Close, Deny, Set to pending,
   "Add posts from a CSV" and "Add clips that are no longer online" on a campaign's Clips tab,
   "Budget shown to the client" and "Show spend at twice what clippers earn" on its Settings tab,
   Credit a user, Payouts. Give the owner the steps, or a Claude Cowork prompt with exact clicks.
2. **The migrate step** for plain data: code called from `packages/db/src/migrate.ts` runs with
   `pnpm db:migrate` before every deploy. Example: `packages/db/src/archived-clips-import.ts` adds the
   Billboard videos and posts from files in `packages/db/data/archived-clips/`, sets the per-post fee
   and client budget, and checks first so it only adds what is missing. Wrap it in try/catch so it can
   never block a deploy.
3. **One-time worker tasks** for anything that needs the money, review or campaign code (approve posts,
   resume a campaign, recalculate earnings): add a function to `apps/worker/src/one-offs.ts`. It runs
   when the worker starts after a deploy and writes an audit-log mark (`oneoff.<name>`) so it never runs
   twice. Always test it twice on a copy of the local database (second run must do nothing).

**Checking that a change is live:** `curl https://app.maisondelites.com/api/health`; a client report's
data at `https://app.maisondelites.com/api/r/<token>/report` (JSON) and `/report.csv`. Report links are
signed by the server: get one from the owner or from Admin, campaign, Create report link. A change in a
public page (for example the leaderboard at /leaderboard) also shows when a deploy went live. If
nothing changes after 20 minutes, read the Railway deploy logs.

## 6b. The change log

Every change is recorded in three places, all readable in the admin at **Change log** (admin only):

- **Code changes:** `CHANGELOG.md`, one line per commit: what changed, who asked (`Requested-by:` trailer),
  who made it (the Claude Code session, or a `Made-by:` trailer for a person), and the commit. Built by
  `pnpm changelog` (`scripts/changelog.mjs`), which only adds missing lines, so hand corrections stay.
- **Deploys:** the `deploys` table, written by the migrate step before every deploy from what Railway
  reports (commit, branch, message, author). The page also shows the commit live right now.
- **Staff actions on live data:** the audit log (who changed money, a decision or a user, and when).

## 7. Recommended clean-up of the workflow

Work so far was pushed straight to `claude/eager-curie-n4llvh`, which Railway deploys. Better:
merge it into `main`, point both Railway services at `main`, and from then on work in branches with
pull requests, so nothing goes live without review and green CI. The CI step "Designed screens match
the locked mockups" fails before the build and end-to-end steps; get it green first (likely Git LFS).

## 8. Command cheat sheet

```bash
# Environment for local commands
export DATABASE_URL=postgres://postgres@localhost:5432/mde REDIS_URL=redis://localhost:6379
export AUTH_SECRET=local-only-secret-local-only-secret-0123 APP_URL=http://localhost:3100
export MOCK_PROVIDER=1 EMAIL_DEV_OUTBOX=1          # fake post data, emails to a local outbox

pnpm db:migrate && pnpm db:seed                    # local database with sample data
pnpm db:generate                                   # new migration after editing schema.ts
pnpm dev                                           # web app; pnpm worker in a second terminal
pnpm lint && pnpm format:check && pnpm typecheck   # what CI checks first

# End-to-end tests against a production build on port 3100
pnpm --filter @mde/web build
(cd apps/web && npx playwright test e2e/<file>.spec.ts --project=flows --no-deps --reporter=line)
```

Package tests each use their own database (`mde_test_<package>`); see `.github/workflows/platform-ci.yml`
for the full list of test databases and variables.

## 9. Lessons from the work so far

- Ask how a client was paid before changing report figures: Billboard was $10 per post plus $3 per
  1,000 views paid outside the platform; Marrz and Davido show spend at twice clipper earnings.
- Imported files: posts uploaded after a campaign ended were dated the upload day and fell outside the
  report's range; the CSV import now takes a "Posted date" column, and the report runs to the last post.
- Count before claiming: verify totals against the live report's JSON and CSV, not against assumptions.
- The client report loads 50 clips a page; "Show all" loads every clip.
- Never put the owner's email, keys or report tokens in commits or public docs.
- Deploys take several minutes and a new push cancels the one building; batch small changes.
