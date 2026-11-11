# Guide funnel: full technical handover

Everything needed to run, change and deploy the Maison d'Élites guide funnel
from any Claude Code account or by hand. Read this first, then `CLAUDE.md`
(working rules) and `docs/SETUP.md` (connecting each outside account).

Last updated 2026-11-11.

---

## 1. What this is

One Next.js app, in the `guide/` folder of the `jacques-netizen/landingpage`
repository, deployed on Vercel at **https://guide.maisondelites.com**.

| Address | What it is |
| --- | --- |
| `/` | The opt-in: two steps (first and last name, then email and WhatsApp number), then the thanks page in place |
| `/secrets` | The lead magnet: "The 7 secrets of the most-watched names online", an interactive page that ends on the booking calendar |
| `/dashboard` | The opt-in funnel step by step (visits, name step, sign-ups, guide email, thanks page, Book a call presses, guide opens, booked calls), by source, browser and day. Counts only, no personal data. The older film funnel is not on it |
| `/dashboard/leads?key=<DASHBOARD_PASSWORD>` | Every submission with name, email, phone; CSV download. 404 without the right key |
| `/api/dashboard/leads?key=<DASHBOARD_PASSWORD>` | The same list as a CSV file |
| `/film` | The older film-and-questions funnel. Still works, gets no traffic |
| `/g/<token>` | A personalised written guide (film funnel leads only) |
| `/u/<token>` | Unsubscribe page from emails |
| `/video-check`, `/design-check` | Internal test pages |

The thanks page, top to bottom: "Check your email" headline, the film (YouTube
id in `content/optin.json` at `pageB.youtube`), a Book a call button, the
Cal.com calendar, client reviews (the Kojo Blak video plus written reviews),
footer with privacy, brand terms and a results disclaimer.

Under the opt-in form: client logos, four campaign clips with their approved
figures, and the Kojo Blak testimonial (plays on the page).

**Related, but not in this app:** the "booked" page that people land on after
booking (`https://book.maisondelites.com/booked`, with the six FAQ answer videos)
is a static page in the repository root, `booked/index.html`, served by the
Cloudflare Worker described in section 8.

---

## 2. Where the code lives and how it ships

| Thing | Value |
| --- | --- |
| Repository | `https://github.com/jacques-netizen/landingpage` |
| App folder | `guide/` (Vercel Root Directory = `guide`) |
| Branch Vercel deploys to production | `claude/awesome-meitner-otpkia` |
| Vercel project | `guide-funnel` |
| Domain | `guide.maisondelites.com` (CNAME in Cloudflare DNS, grey cloud) |
| Repository default branch | `claude/beautiful-franklin-kl5mvv` (the main site, NOT this app) |

A push to `claude/awesome-meitner-otpkia` deploys in 2 to 4 minutes. Work on a
short-lived branch and merge it into `claude/awesome-meitner-otpkia` with a pull
request, as `fix/optin-funnel` (pull request #33) did.

Rollback: Vercel, Deployments, pick the last good one, Promote to Production.
Whole funnel off: set `FUNNEL_ENABLED=false` and `OLD_GUIDE_URL` in Vercel, redeploy.

---

## 3. Taking over from a new Claude Code account

Nothing lives in a Claude account: the code is in GitHub, the secrets in Vercel,
the data in Postgres. A new account needs:

1. **GitHub access** to `jacques-netizen/landingpage`: connect the same GitHub
   account in the new Claude account, or add the new GitHub user as a
   collaborator. Install the Claude GitHub App on the repository if asked.
2. **Start a session on the repository** and tell Claude to read
   `guide/HANDOVER.md` and `guide/CLAUDE.md` first.
3. **Vercel and Cloudflare stay with the owner.** Claude edits code and pushes;
   Vercel deploys. Environment variables are changed by a person in the Vercel
   dashboard. Claude never needs, and must never be pasted, a secret value.
4. **Things that do NOT move with the code** (they live in the old Claude account):
   the claude.ai Docs SOPs and the published recording boards. The board
   source files are copied into `guide/docs/boards/` (open the HTML files in a
   browser; section 11).

A session can build and test the whole app with no accounts at all: every
outside service falls back to a local mode (emails are written to
`.data/outbox/`, the database is an embedded PGlite in `.data/pglite`).

---

## 4. Stack

- Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript, Tailwind v4.
  **Read `guide/AGENTS.md`**: this Next.js differs from older versions; check
  `node_modules/next/dist/docs/` before writing framework code.
- Drizzle ORM. Production: Postgres via `DATABASE_URL` (postgres.js driver).
  Local and tests: PGlite. Migrations in `drizzle/` run automatically on the
  first request.
- Framer Motion (film funnel scenes), hls.js (film funnel video), `@calcom/embed-react`.
- Resend (email), GoHighLevel API v2 (CRM), Meta Pixel and Conversions API,
  Discord webhook, ManyChat API, Cloudflare Turnstile (optional bot check).
- Anthropic SDK: writes personalised guides for film funnel leads only.
- Playwright core + `@sparticuz/chromium`: PDF guides (film funnel only) and
  the browser tests.
- Vitest for unit tests.

---

## 5. Repository map (inside `guide/`)

```
content/            every word, number, link and video id the pages show (edit here, not in code)
  optin.json        opt-in page, thanks page, reviews, legal links, delivery email for opt-in leads
  secrets.json      the /secrets lead magnet: every section, number, clip slot
  proof.json        approved campaign figures and logos; only status "approved" is ever shown
  media.json        video ids for the film funnel (Mux playback ids or files)
  questions.json    questions for the film funnel; promo..heard belong to the older 3-step opt-in
  copy.json, flow.json, results.json, strategy.json, email.json, guide/   film funnel and written guide
src/app/
  page.tsx          the opt-in (server part)
  optin/Optin.tsx   the opt-in and thanks page (client part); optin.css; MuxPlayer.tsx (unused fallback)
  secrets/          the lead magnet page: Secrets.tsx, secrets.css, CalInline.tsx
  dashboard/        funnel numbers; leads/ = private submissions list
  film/, g/, u/     film funnel, written guide, unsubscribe
  api/              lead, session, answer, event, guide PDF, dashboard (+ leads CSV), cron, cal webhook, unsubscribe
src/lib/
  flow.ts           shared rules: paths, qualification, opt-in stage, phone cleaning
  content.ts        typed access to content/*.json
  server/           config (all env vars), leads, sessions, jobs + jobs/, email, ghl, discord, meta,
                    leadview (CRM fields), leadlist (submissions + CSV), guide/ (AI and rules writer, PDF)
  video/            film funnel player
drizzle/            SQL migrations 0000 to 0004
public/
  media/films/      vsl.mp4 (older hosted thanks page film), cold_open.mp4
  media/faq/        six portrait FAQ MP4s (no longer on the thanks page; kept)
  media/secrets/    14 campaign loops used by /secrets and the opt-in proof
  brand/            logos, proof posters, guide-fan.png (opt-in hero)
tests/              unit tests; tests/e2e/ browser walks (optin.mjs, secrets.mjs, walk.mjs)
docs/               SETUP.md (accounts), QA.md, build plan, video scripts, boards/
```

---

## 6. How a sign-up flows

1. Browser opens a session (`POST /api/session`, token kept in localStorage).
2. The form posts `POST /api/lead` with `funnel: "optin"`, first and last name,
   email, phone (country code plus number, cleaned to digits with a leading +),
   consent version, and `answers: { role: "creator" }`.
3. The server saves the lead in `leads` **first**, then queues background jobs in
   `jobs` and runs them right after the response. Opt-in leads skip the
   `write` and `pdf` jobs (no written guide).
4. Jobs: `email` (Resend delivery email linking `/secrets` and the calendar),
   `crm` (GoHighLevel contact tagged `guide-lead`), `capi` (Meta Lead),
   `discord` (alert, qualified leads only), `manychat` (tag, when the link carried
   a ManyChat subscriber id as `?mc=`).
   The guide link in that email carries a signed lead reference (`?l=`), so
   an open of `/secrets` from the email is counted for that lead
   (`secrets_view`, `secrets_end`). The Book a call button on the thanks page
   sends `book_click`.
5. Failed jobs retry with backoff; `vercel.json` runs `/api/cron/jobs` daily at
   03:00 UTC to sweep anything left (Vercel sends `CRON_SECRET` as a bearer token).
6. A booking in Cal.com calls `/api/webhooks/cal`; the lead is matched by the
   `metadata[lead]` field or by email, `booked_at` is set and booking jobs run.

Opt-in leads are never "qualified" (no budget question), so they get no Discord
alert and no CRM opportunity, only a contact. The submissions page is the
reliable list.

Database tables: `sessions`, `answers`, `leads` (first_name, last_name, email,
phone, answers JSON, qualified, path, ghl ids, booked_at...), `guides`,
`events`, `jobs`, `unsubscribes`, `rate_limits`. See `src/db/schema.ts`.

---

## 7. Environment variables (Vercel, project guide-funnel)

Values are set by a person in Vercel, never in the repository. `.env.example`
lists them all with comments.

| Variable | Purpose | State on 2026-11-09 |
| --- | --- | --- |
| `DATABASE_URL` | Postgres for every lead | set |
| `APP_SECRET` | Signs guide and unsubscribe links. Never change it | set |
| `SITE_URL` | `https://guide.maisondelites.com` | check |
| `DASHBOARD_PASSWORD` | Key for the submissions page and CSV | set |
| `CRON_SECRET` | Protects the job sweep | set |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Delivery email | set |
| `CAL_BOOKING_URL`, `CAL_WEBHOOK_SECRET`, `CAL_BOOKED_REDIRECT_URL` | Calendar, booked signal, after-booking page | set |
| `META_PIXEL_ID`, `META_CAPI_TOKEN` | Ad tracking | set |
| `DISCORD_WEBHOOK_URL` | Alerts | set |
| `MANYCHAT_API_TOKEN` | DM tagging | set |
| `GHL_API_TOKEN` | GoHighLevel private integration token | **missing** |
| `GHL_LOCATION_ID` | `HmYBmlkMf4bgk2CQpEUo` | **missing** |
| `ANTHROPIC_API_KEY`, `GUIDE_WRITER`, `GUIDE_WRITER_MODEL` | Written guides, film funnel only | set |
| `OPTIN_QUALIFY_MIN` | Budget line for opt-in leads, default 10000 | default |
| `FUNNEL_ENABLED`, `OLD_GUIDE_URL` | Kill switch | true |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | Optional bot check | optional |

"set" means the live site behaves as if it is set; confirm in Vercel. GoHighLevel
was verified empty: a live test sign-up never reached it. Until both GHL values
are added, leads live only in the database and the submissions page.

---

## 8. The rest of the repository (not this app)

The repository root is a separate site: static pages (main site, booking,
booked, proposals, client dashboards, onboarding) served by one Cloudflare
Worker (`worker.js`, `wrangler.toml`), deployed from the default branch
`claude/beautiful-franklin-kl5mvv`. See `DEPLOY.md` and `SOP.md` at the root.
Changes there do not touch the guide app, and the reverse.

The privacy policy and terms the opt-in links to live on the main site:
`https://maisondelites.com/legal/privacy` and `.../legal/brand-terms`. The short
addresses `/privacy` and `/terms` redirect to the app and show "not found".

---

## 9. Changing things

Most changes are an edit to one content file:

| Change | File and key |
| --- | --- |
| Opt-in headline, labels, trust lines, consent text | `content/optin.json`: hero, steps, trust, legal |
| Thanks page film | `content/optin.json`: `pageB.youtube` (first match wins: youtube, then file, then video) |
| Written reviews | `content/optin.json`: `pageB.reviews.items` (name, who, text, stars) |
| Featured video review | `content/optin.json`: `pageB.reviews.featured` |
| Proof under the form | `content/optin.json`: clients; figures from `content/proof.json` |
| Delivery email for opt-in leads | `content/optin.json`: guide (subject, intro, button, preheader) |
| The lead magnet | `content/secrets.json` (spots counter odds at `next.spotsOdds`) |

Video options for any slot, best first:

1. **YouTube** (unlisted is fine): put the 11-character id in the content file.
2. **Hosted MP4**: encode with ffmpeg, put it in `public/media/...`, point the
   `file` field at it. Settings that play on every phone:
   `-c:v libx264 -profile:v high -level:v 4.1 -r 30 -pix_fmt yuv420p -crf 19..21 -maxrate 3.5M..6M -c:a aac -b:a 128k..160k -movflags +faststart`.
   Keep each file under about 80 MB (GitHub's limit is 100 MB per file).
   Encode from the original export, never from a copy pulled out of Mux.
3. **Mux**: avoid. Its streams failed on some Android phones, and this account's
   assets lack the MP4 rendition. `MuxPlayer.tsx` remains as a fallback only.

---

## 10. Checks before every push

From `guide/`:

```
npm ci
npm run lint
npm run typecheck
npm test                 # unit tests, including content rules
npm run check:dashes     # fails on any em dash in content or code
npm run build
```

Browser walks (Chromium is at `/opt/pw-browsers` in Claude cloud sessions):

```
GUIDE_WRITER=rules npx next start -p 3200 &
node tests/e2e/optin.mjs http://localhost:3200 B /tmp/optin     # opt-in to thanks page
node tests/e2e/secrets.mjs http://localhost:3200 /tmp/secrets   # every /secrets interaction
node tests/e2e/walk.mjs http://localhost:3200 creator /tmp/walk # film funnel at /film
```

The cloud test browser cannot decode H.264, so a walk proves a video loads,
never that it plays. Check video on a real Android phone and iPhone.

After the push: wait for Vercel Ready, make one test sign-up on a phone, check
it on the submissions page.

---

## 11. Recording boards

Three Miro-style boards for Loom and YouTube recordings, as standalone HTML in
`docs/boards/` with their images and clips beside them:

| File | Talk | Live copy in the original account |
| --- | --- | --- |
| `clipping-board.html` | Running a clipping campaign (YouTube, 15 frames) | https://claude.ai/artifact/F1ELydQaYXsebpV4dn5PLq |
| `distribution-board-budget.html` | The distribution problem, for budget holders | https://claude.ai/artifact/WWHrz2WtnBM3vZbmbS52dZ |
| `distribution-board.html` | The distribution problem, for artists | https://claude.ai/artifact/7kotkvL6xbQncmgoswWi5G |

Open one in Chrome. N shows the script notes, H is record mode (hides all
controls), O shows the whole board, space or the arrows move between frames.
To publish one as a claude.ai artifact again, publish the HTML with the
`img/`, `logos/` and `clips/` folders as its supporting files.

---

## 12. Rules that are never broken

- Only approved proof: campaign figures come from `content/proof.json` with
  status approved (Walmart 3M at $2.30 CPM, Mannywellz ft. Wale 4.6M at $0.48,
  Paul American 11.2M at $1.78, Kojo Blak 1.9M, 1B+ views delivered). The
  content test enforces it.
- No invented reviews. Every review names a real person who agreed in writing.
- No hosted outside footage: outside creators only as stat cards or the
  platform's own embed, with a source link.
- No em dashes anywhere (the dash check fails the build).
- Lead data stays private: never share the submissions link or CSV.
- Secrets only in Vercel or Cloudflare settings: never in the repository, a
  chat, a doc or a commit. The Anthropic key that was once pasted into a chat
  should be rotated if that has not happened.
- No personal names on pages beyond approved proof and real reviews.

---

## 13. Open items

- [ ] Add `GHL_API_TOKEN` and `GHL_LOCATION_ID` in Vercel, redeploy, confirm a test sign-up appears in GoHighLevel tagged `guide-lead`.
- [ ] Sources (who, url) for the three outside stat cards in `/secrets`, secret 04.
- [ ] Seven per-secret explainer videos and a dashboard walkthrough for `/secrets` (slots empty and hidden; `?slots=1` shows them).
- [ ] Optional: attach `secrets.maisondelites.com` in Vercel (the app already routes it to `/secrets`).
- [ ] Optional: a dedicated Discord or WhatsApp alert for every opt-in lead (today only qualified leads alert).
