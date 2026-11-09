# Maison d'Élites: System SOP

How the whole Maison d'Élites web operation is built, how it runs, and how to
carry it on from a different Claude Code account without anything stopping.

Companion files in this repo:
- `CLAUDE.md`: the short rules Claude Code loads automatically every session.
- `DEPLOY.md`: deep technical notes per feature (onboarding form, brand sheet, dashboards, Run It Bak).
- `SOP.md`: step-by-step for launching a client campaign dashboard.
- `tools/`: the scripts used to check pages, make PDFs and test the Worker locally.

---

## 1. The system in one picture

```
GitHub repo  jacques-netizen/landingpage
  branch claude/beautiful-franklin-kl5mvv  (default + production)
        │  every push
        ▼
Cloudflare Workers Builds  (runs `npx wrangler deploy`)
        │
        ▼
Cloudflare Worker "landingpage"  (worker.js runs first on every request)
  ├── static files: every folder in the repo (ASSETS binding)
  ├── R2 bucket "maison-delites-media" (MEDIA binding): videos, campaign data,
  │     onboarding records and uploads, brand sheets, invoices
  ├── cron every 15 minutes: campaign CSV sync, thumbnail repair,
  │     onboarding form reminders and weekly check-in alerts
  └── custom domains on maisondelites.com:
        hello.  proposals.  reports.  campaigns.  onboarding.  book.  (runitbak.)

Outside services the Worker talks to:
  Resend (email) · Discord webhooks (team pings) · Cal.com / Google booking pages
  RapidAPI / ScraperAPI (clip thumbnails) · Whop (campaign probe)

Separate systems NOT in this repo:
  maisondelites.com (main site, its own host) · app.maisondelites.com (content
  rewards platform, Next.js on Railway; its /r/<token> pages are the source data
  for client reports)
```

Nothing about the live system depends on a Claude account. Cloudflare deploys
from GitHub and keeps all secrets. A Claude Code account is only the "worker"
that edits the repo and pushes.

---

## 2. Moving to a different Claude Code account

Do these once. After that, the new account works exactly like the old one.

### 2.1 GitHub access (required)
1. The new Claude account must be able to read and push to
   `jacques-netizen/landingpage`.
   - Same GitHub user: on claude.ai, open Claude Code → connect GitHub and grant
     the Claude GitHub app access to `jacques-netizen/landingpage`.
   - Different GitHub user: on GitHub, repo → Settings → Collaborators → add that
     user with **Write** access, accept the invite, then connect the Claude GitHub
     app from the new account.
2. Start a Claude Code session on the repo. `CLAUDE.md` loads automatically and
   tells Claude the production branch, the house rules and the workflow.

### 2.2 The production branch (most common mistake)
- Cloudflare deploys **only** `claude/beautiful-franklin-kl5mvv`. A new Claude Code
  session usually starts on a branch with a new random name. Tell it at the start:
  "Push the finished work to `claude/beautiful-franklin-kl5mvv`" (CLAUDE.md says
  this too), or merge its branch in with a pull request on GitHub.
- Optional cleanup: rename the production branch to `main`. If you do, change it
  in Cloudflare too (Worker → Settings → Build → Branch control → production
  branch) and update `CLAUDE.md` and this file. Do both in the same hour.

### 2.3 Cloud environment for the new account
In the new account: claude.ai → Claude Code → environment settings.
- **Network**: unrestricted (what the old account uses), or at least these hosts:
  `hello.maisondelites.com`, `proposals.maisondelites.com`, `reports.maisondelites.com`,
  `campaigns.maisondelites.com`, `onboarding.maisondelites.com`, `app.maisondelites.com`,
  `maisondelites.com`, `www.tiktok.com`, `www.instagram.com`, `www.youtube.com`,
  `i.ytimg.com`, `audiomack.com`, `fonts.googleapis.com`, `fonts.gstatic.com`,
  plus the CDN hosts TikTok and Instagram serve covers from (these change; this is
  why unrestricted is easier).
- **Network secret (optional)**: "Onboarding admin password" for host
  `onboarding.maisondelites.com`, header `Authorization`, value `Bearer <ADMIN_PASSWORD>`.
  Only needed if Claude should call the onboarding admin API directly.
- **Setup script (optional, saves a minute per session)**: `bash landingpage/tools/setup.sh`
  (builds the Python venv with Pillow and ffmpeg). Chromium and Playwright are
  preinstalled in Claude Code cloud containers.

### 2.4 What does NOT move with the repo
| Thing | Lives in | What to do |
|-------|----------|------------|
| claude.ai Docs and Artifacts (proposal drafts, roadmaps, "Client Onboarding Sequence") | the old claude.ai account | Share them with the new account, or export and re-import. Links pasted into Claude Code only open for an account that can see them. |
| Connectors (Gmail, Google Drive, Calendar, Notion, Slack, Fathom, GHL, PandaDoc, Higgsfield, Adspirer, Cloudflare) | the claude.ai account | Reconnect each one in the new account (Settings → Connectors). |
| Account skills (e.g. "talking-head-reel-editor") | the claude.ai account | Re-upload them in the new account. |
| Routines / scheduled tasks | the claude.ai account | Recreate them. |
| Cloudflare, Resend, Discord, R2 data, secrets | Cloudflare and each service | Nothing to do. They keep running. |

### 2.5 First-session check in the new account
Ask the new Claude to do this and report back:
```
git log --oneline -3                                   # sees the latest work
bash tools/setup.sh                                    # tools install
bash tools/serve.sh & node tools/check-page.mjs http://localhost:8765/winnerman/
curl -s -o /dev/null -w "%{http_code}" https://proposals.maisondelites.com/winnerman/   # 200
```
Then make a one-line harmless change (for example a comment in `tools/serve.sh`),
push it to the production branch and confirm Cloudflare deploys it. That proves
the full loop: new account → GitHub → Cloudflare → live.

---

## 3. Accounts and services

| Service | Used for | Where it's managed |
|---------|----------|--------------------|
| GitHub `jacques-netizen/landingpage` | All code and pages | github.com |
| Cloudflare (account with maisondelites.com) | Worker `landingpage`, R2 `maison-delites-media`, DNS, custom domains, builds | dash.cloudflare.com → Workers & Pages |
| Resend | All outgoing email (onboarding, client sequence, brand sheet, team alerts) | resend.com; the sending domain must be verified |
| Discord | Team pings (bookings, onboarding submitted, weekly check-ins due) | webhook URLs stored as Worker secrets |
| Cal.com / Google booking pages | Discovery and onboarding call booking | booking links set in the onboarding admin panel |
| RapidAPI / ScraperAPI | Fetching clip thumbnails for dashboards | keys stored as Worker secrets |
| app.maisondelites.com | Content rewards platform; its report pages are the data source for client reports | separate repo, Railway |
| maisondelites.com | Main marketing site, `#case-studies` section | separate site, not in this repo |

---

## 4. Secrets and variables (Cloudflare → Worker → Settings → Variables and Secrets)

Values are never in the repo. Names the code reads:

| Name | Type | Used by |
|------|------|---------|
| `ADMIN_PASSWORD` | secret | every admin page and admin API (`/admin`, campaign editor, onboarding admin, brand sheet admin) |
| `RESEND_API_KEY` | secret | all email |
| `ONBOARDING_FROM` | var | sender for onboarding and client emails (domain verified in Resend); the admin panel setting wins |
| `ONBOARDING_REPLY_TO` | var | where client replies go (falls back to `ONBOARDING_NOTIFY_EMAIL`) |
| `ONBOARDING_NOTIFY_EMAIL` | var | team inbox(es) for submissions and weekly check-in alerts |
| `ONBOARDING_DISCORD_WEBHOOK` | secret | Discord pings for onboarding and the email sequence |
| `ONBOARDING_BASE_URL` | var | optional, defaults to `https://onboarding.maisondelites.com` |
| `BOOKING_CLIPPING_URL`, `BOOKING_COACHING_URL`, `BOOKING_CONSULTING_URL` | var | fallback booking links (admin panel wins) |
| `DISCORD_WEBHOOK_URL` | secret | `/api/notify` (booking and lead pings from the landing page) |
| `BRANDSHEET_FROM`, `BRANDSHEET_TO` | var | brand sheet emails |
| `RUNITBAK_PASSWORD` | secret | Run It Bak content bank gate |
| `CAMPAIGN_CSV_URL`, `CAMPAIGN_CSV_CLIENT` | var | optional cron CSV sync for a dashboard |
| `RAPIDAPI_KEY`, `RAPIDAPI_IG_HOST`, `RAPIDAPI_IG_PATH`, `SCRAPER_API_KEY`, `SCRAPERAPI_KEY` | secret / var | clip thumbnail resolving |
| `WHOP_API_KEY`, `WHOP_COMPANY_ID` | secret / var | Whop campaign probe |
| `RESEND_API_URL` | var | optional Resend endpoint override |

Bindings in `wrangler.toml`: `ASSETS` (the repo), `MEDIA` (R2), `ONBOARDING_LIMITER`
(rate limit, 300 a minute per IP), cron `*/15 * * * *`.

---

## 5. Routing (what each address does)

All of it is in `worker.js`, which runs before static files.

| Host / path | Behaviour |
|-------------|-----------|
| `/api/*`, `/v/*` | Worker handlers: uploads, media streaming, campaign data, notify, brand sheet, image proxy |
| `hello.maisondelites.com/` | `index.html` (landing page) |
| `proposals.maisondelites.com/<folder>/` | that folder's `index.html`. Any top-level folder is a page. |
| `reports.maisondelites.com/<name>/` | `reports/<name>/index.html`. `/` redirects to maisondelites.com; a missing trailing slash is added. |
| `campaigns.maisondelites.com/<slug>` | client dashboard (`dashboard/`), `/<slug>/admin` its editor, `/admin` the hub |
| `onboarding.maisondelites.com/<token>`, `/admin` | onboarding form and admin (`lib/onboarding.js`); `/` redirects to maisondelites.com |
| `book.maisondelites.com/` | redirects to `/book` (calendar); `/booked` is the confirmation |
| `/runitbak` (any host, or `runitbak.` root) | password-gated content bank |

A new subdomain needs: Cloudflare → Worker → Settings → Domains & Routes → Add →
Custom Domain, plus a branch in `worker.js` if it should map to a folder.

---

## 6. Runbooks

### 6.1 Build a client proposal page
Input is usually a brief (Claude Doc link, PDF, DOCX or pasted text).
1. Read the brief fully. Note every number, name, price and date. Notes marked
   "for you, not for the proposal" never go on the page.
2. Research what makes it real: the client's own site, socials and imagery; real
   reference clips with high view counts; the case studies in `index.html`
   (`caseStudies` array) for proof.
3. Copy the closest template (`CLAUDE.md` lists them) into a new folder named after
   the client (`/<client>/`), self-host every image in `<client>/img/`.
4. Structure: hero (client image, chips, badges) → numbered sections that follow
   the brief → interactive pieces (tabs, steppers, timelines, A/B toggles) →
   proof (case studies, clips) → calculator slider at the very end → sign-off.
5. Apply the house rules in `CLAUDE.md` line by line. Reword "X, not Y" lines,
   strip dashes, remove placeholders and anything you would be guessing.
6. `node tools/check-page.mjs http://localhost:8765/<client>/` and look at the screenshots.
7. Commit, push to the production branch, confirm
   `https://proposals.maisondelites.com/<client>/` returns 200.
8. Reply with the link, what's on the page, and every call you made (prices,
   ranges, wording changes, numbers updated from live sources).

### 6.2 Build a client report (weekly or final)
Input: the report text plus the app link `https://app.maisondelites.com/r/<token>`.
1. Fetch the app page with curl. Every clip card has views, comments, likes, spend,
   the page handle and the clip link, in that order, ending with the link:
   ```python
   import re, html
   h = open('r.html').read()
   for m in re.finditer(r'href="(https://(?:www\.)?(?:tiktok\.com/@[\w.]+/video/\d+|instagram\.com/(?:reel|p)/[\w-]+)[^"]*)"', h):
       block = html.unescape(re.sub(r'<[^>]+>', '|', h[max(0, m.start()-5000):m.start()]))
       print(m.group(1).split('?')[0], re.sub(r'\|+', '|', block)[-170:])
   ```
   Match the report's top clips by their view counts. The page also links the
   campaign poster (`/files/.../*.jpg`), which makes a strong hero image.
2. Copy `reports/winnerman-week-1/` (weekly) or `reports/marrz-final/` (final)
   to `reports/<artist>-week-<n>/` or `reports/<artist>-final/`.
3. Covers: TikTok from the video page's `"cover"` URL, Instagram from the
   `/reel/<code>/embed/captioned/` page's `EmbeddedMediaImage` (see 7.1).
   Save 540×960 crops to `img/clips/<id>.jpg`.
4. Fill the data arrays (clip id, handle, views, likes, shares, date) and the text.
   Keep the client's numbers exactly; derived numbers (like rate, share of views)
   are fine.
5. Check, push, confirm `https://reports.maisondelites.com/<name>/`.
6. PDF when asked: `node tools/pdf.mjs http://localhost:8765/reports/<name>/ reports/<name>/<Name>.pdf --break "#s3,#s5"`,
   commit it, send it. It is also served at `reports.maisondelites.com/<name>/<Name>.pdf`.
7. Weekly reports are snapshots: never edit an old week's numbers. Final reports
   may be refreshed when the app's numbers move.

### 6.3 Build a roadmap or plan page
Same as 6.1, templates `eat-roadmap/` and `brand-roadmap/`. Use a drawn timeline
for phases and dates, tabs for weeks, checklists with due dates, a filterable
"who does what" list, expandable risks, and a slider at the end built only from
numbers in the brief (for example targets that scale with budget).

### 6.4 Onboarding form and the client email sequence
- Admin: `https://onboarding.maisondelites.com/admin` (password `ADMIN_PASSWORD`).
- Questions and client email templates: `lib/questions.js`. Never rename a question
  id that already has answers; add a new one.
- The seven-email sequence (welcome, invoice with PDF, form reminder, payment
  received, campaign live, weekly check-in, campaign complete) is in
  `lib/sequence.js`, run from each client's "Client emails" panel and the cron.
  Order rules are enforced on the server. Full detail: `DEPLOY.md` → "Client email sequence".
- Test changes locally with `node tools/dev-worker.mjs` (fake R2, fake email,
  `/__cron` and `/__time?shift=25` to fast-forward).

### 6.5 Campaign dashboards
Follow `SOP.md`. One slug per client at `campaigns.maisondelites.com/<slug>`,
data published from the editor (CSV upload) into R2.

### 6.6 Favicon
Files at the repo root: `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`.
Every page head carries:
```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

---

## 7. Media recipes

### 7.1 Clip covers and stats
- **TikTok**: `curl -A "Mozilla/5.0 …Chrome/124…" https://www.tiktok.com/@<handle>/video/<id>`;
  the page JSON has `"cover":"…"` (unescape `/`) and `"playCount":<n>`.
  oEmbed (`https://www.tiktok.com/oembed?url=…`) confirms the video exists but
  often has no thumbnail.
- **Instagram**: `https://www.instagram.com/reel/<code>/embed/captioned/` with an
  iPhone user agent; the `<img class="EmbeddedMediaImage" src="…">` is the cover.
  Use the `/reel/` path even for `/p/` posts. Stored CDN links expire (403), so
  always download and self-host.
- **YouTube**: `https://www.youtube.com/oembed?url=…&format=json` (title, channel,
  and proves embedding is allowed), cover `https://i.ytimg.com/vi/<id>/maxresdefault.jpg`
  (`maxres1/2/3.jpg` are extra frames). Search results: parse `"videoRenderer"`
  blocks from `youtube.com/results?search_query=…`.
- **Audiomack**: embed `https://audiomack.com/embed/<artist>/song/<slug>`.
- **Profile pictures and follower counts** (TikTok): the profile page's
  `__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON → `webapp.user-detail.userInfo`.

### 7.2 Images and video
```bash
PY=~/.mde-venv/bin/python                       # after tools/setup.sh
FF=$($PY -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')
$FF -ss 8 -i in.mov -frames:v 1 -vf scale=540:-2 poster.jpg            # poster frame
$FF -i in.mov -c:v libx264 -crf 27 -vf scale=540:-2 -pix_fmt yuv420p \
    -c:a aac -b:a 96k -movflags +faststart out.mp4                      # HEVC/MOV → H.264 for every browser
$FF -i in.mp4 -c copy -movflags +faststart out.mp4                      # already H.264: just fast-start
```
Crops: `ImageOps.fit(img, (540, 960))` for 9:16 covers. Look at a contact sheet of
candidate images before choosing; image file names say little about content.

### 7.3 Reading claude.ai Docs links
A `claude.ai/artifact/…` link is usually a Claude Doc: read it with the Claude Docs
connector (`read` the project, then the tab's node with `{"kind":"view"}`), never
with a web fetch. It only opens for an account the doc is shared with.

---

## 8. Quality checklist (before every push)

- [ ] Every number traced to a source; nothing invented; no placeholders.
- [ ] No em or en dashes (`grep -c "—\|–" <file>` returns 0).
- [ ] No "X, not Y" lines, no disclaimers, no instructions to the reader.
- [ ] Slider calculator at the end (proposals); sign-off present.
- [ ] Clips play (TikTok player v1, Instagram embed, YouTube nocookie) and their covers are self-hosted.
- [ ] `tools/check-page.mjs` passes at 390, 820 and 1440, and the screenshots look right.
- [ ] Favicon links and `noindex` in the head.
- [ ] Pushed to `claude/beautiful-franklin-kl5mvv`; live URL returns 200.

---

## 9. Troubleshooting

| Problem | Fix |
|---------|-----|
| Push never goes live | Cloudflare → Workers & Pages → landingpage → Deployments: retry the failed or stuck build. Check that the push went to the production branch. |
| A box shows up empty or styled oddly | A CSS class name clash. Several pages reuse short names (`.ph`, `.gate`, `.out`, `.in`). Give new components distinct names. |
| Animated bars or rings stay empty | They start when scrolled into view (IntersectionObserver). Tests that jump past them see zero width; scroll to them first. |
| Instagram image 403 | The stored CDN link expired: download a fresh one from the embed page. |
| Video won't play in Chrome | It is HEVC/MOV: transcode to H.264 MP4 (7.2). |
| Wikimedia 429, some brand sites 403 | Blocked from the sandbox: use the brand's YouTube thumbnails or their own social media instead. |
| Your shell dies running `pkill -f` | The pattern matched your own command: kill by PID. |
| Emails only reach one inbox | The Resend sender domain isn't verified: verify it and set `ONBOARDING_FROM`. |

---

## 10. Page inventory

| Folder | What it is |
|--------|------------|
| `index.html` | Landing page (hello.), case studies, talent roster |
| `admin/` | Video upload admin (R2 slots for `/v/<slot>`) |
| `book/`, `booked/` | Discovery call booking and confirmation |
| `brand-sheet/`, `brand-sheet-admin/` | Client brand discovery form and its admin |
| `campaigns/`, `dashboard/`, `campaign-admin/`, `campaign-hub/` | Client campaign dashboards, editor, hub |
| `onboarding/` | Client onboarding form and admin (with the email sequence) |
| `runitbak/` | Run It Bak content bank (password gated) |
| `reports/winnerman-week-1/`, `reports/marrz-final/` | Client reports (web + PDF) |
| `winnerman/`, `chillblast/`, `jankal/`, `coinjuice/`, `owning-the-feed/`, `scott-sebastian/`, `fuzzbucket/`, `michael/`, `samer/`, `valuepilot*/`, `gordon-system/`, `candyrific/`, `steal-like-an-artist/` | Client proposals and plans |
| `eat-roadmap/`, `brand-roadmap/` | Roadmaps |
| `talent/`, `media/` | Shared images |
| `lib/` | Worker code (handlers, onboarding, questions, sequence, forms, csv, auth, runitbak) |
| `tools/` | check-page, pdf, dev-worker, serve, setup, fonts |
