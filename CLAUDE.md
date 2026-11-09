# Maison d'Élites: landingpage repo

This repo is the whole Maison d'Élites web operation: the landing site, client
proposals, client reports, campaign dashboards, the onboarding form with its
client email sequence, and a few private tools. One Cloudflare Worker serves all
of it. Read `SYSTEM-SOP.md` for the full manual; this file is the short version
Claude Code loads at the start of every session.

Owner: Jacques, Founder (Maison d'Élites, MDE). Contact on pages:
contact@maisondelitesagency.com. Main site: https://maisondelites.com.

## Deploying: the one rule that matters

- **Production branch: `claude/beautiful-franklin-kl5mvv`.** It is the repo's
  default branch. Cloudflare builds and deploys every push to it, usually live
  in 1 to 5 minutes. Nothing else deploys.
- Work on that branch, or on your own branch and merge into it (pull request
  or fast-forward). Work left on any other branch never goes live.
- Before pushing: `git fetch origin claude/beautiful-franklin-kl5mvv && git rebase origin/claude/beautiful-franklin-kl5mvv`
  (other sessions push to it too), then `git push -u origin claude/beautiful-franklin-kl5mvv`.
- Confirm it is live with curl (poll every 20 s for up to 8 minutes). If a push
  never shows up, the Cloudflare build is stuck: Cloudflare dashboard → Workers
  & Pages → `landingpage` → Deployments → Retry. Say so plainly; do not keep
  pushing empty commits.
- Secrets live in Cloudflare (Worker → Settings → Variables and Secrets), never
  in the repo. See `SYSTEM-SOP.md` → Secrets.

## Where things live (URL → folder)

| URL | Folder / code |
|-----|---------------|
| `proposals.maisondelites.com/<name>/` | `<name>/index.html` (any top-level folder) |
| `reports.maisondelites.com/<name>/` | `reports/<name>/index.html` (worker maps it) |
| `hello.maisondelites.com` | `index.html` (landing page, case studies in its `caseStudies` array) |
| `campaigns.maisondelites.com/<slug>` | `dashboard/` + data in R2 via `/api/campaign` |
| `onboarding.maisondelites.com/<token>` and `/admin` | `onboarding/`, `lib/onboarding.js`, `lib/questions.js`, `lib/sequence.js` |
| `book.` / `booked` | `book/`, `booked/` |
| `/runitbak` | `runitbak/`, `lib/runitbak.js` (password gated) |
| `/v/<slot>` | R2 media streaming (`lib/handlers.js`) |

Routing for every host is in `worker.js` (runs before static files).
`.assetsignore` keeps `lib/`, `tools/`, `worker.js` and all `*.md` off the public site.

## House rules for anything a client reads (non-negotiable)

These come straight from Jacques' feedback. Breaking them gets the work redone.

1. **No em dashes or en dashes.** Use commas, full stops, colons, "to" for ranges.
2. **No corny lines, no AI catchphrases, no "X, not Y" antithesis**, no italic flourish headings.
3. **No instructional microcopy** ("tap to…", "use the filters…").
4. **No hedging, caveats or disclaimers you add yourself.** Never add a note like
   "X is not endorsing this". Only what the client's own text says.
5. **No bracket placeholders** ([X], TBD). Fill real values, or leave the item out.
6. **Never invent numbers.** Every figure comes from the brief, the client's data,
   the app's report page, the main site's case studies, or a source you opened.
   Derived numbers (sums, rates) are fine; say so in the reply.
7. **Every proposal ends with a budget slider calculator** (budget → views,
   default $2 per 1,000 verified views, USD unless told otherwise). Put it at the
   very end, before the sign-off. No fee-tier sliders, no start-date sliders.
8. **Clips shown must come from high-view clip or creator accounts**, never news
   outlets, never off-brand examples.
9. **Never mention**: a retainer, the originating or partner agency
   (Breadcrumbs, Convrt), a hard cap on the pool, internal notes meant for Jacques.
10. **Currency**: dollars unless the client is told otherwise.
11. **Case-study link**: https://maisondelites.com/#case-studies
12. Sign-off on every page: "Maison d'Élites" + "Jacques · Founder" + maisondelites.com.
13. Don't use the AskUserQuestion picker. Make the reasonable call, build it, and
    list the calls you made in the reply.
14. When Jacques points out a mistake: fix it, say what was wrong in one line, move on.
15. Weekly reports are locked snapshots; final reports stay current.

## Building pages (proposals, reports, roadmaps)

Copy the closest existing page and change the content. Canonical templates:

- Proposal: `winnerman/index.html`, `chillblast/index.html`, `jankal/index.html`
- Report: `reports/winnerman-week-1/`, `reports/marrz-final/`
- Roadmap / plan: `eat-roadmap/`, `brand-roadmap/`

House style: dark `#15120D`, panels `#1F1911`, gold `#B8944F / #D4B26A / #EBD69E`,
Archivo 800 headings, EB Garamond body, film grain, scroll reveals (`.rv`),
count-ups (`.cu[data-target][data-dec]`), section dots, progress bar, interactive
pieces (tabs, steppers, timelines, sortable tables, sliders). Images are
self-hosted in the page's `img/` folder. Every page head carries the favicon links
and `<meta name="robots" content="noindex, nofollow">`.

Clips: TikTok tiles load `https://www.tiktok.com/player/v1/<id>` on tap (works on
iOS); Instagram tiles load `https://www.instagram.com/p/<code>/embed/`; YouTube
uses `youtube-nocookie.com/embed/<id>?autoplay=1&playsinline=1`. Covers are
downloaded and self-hosted (how: `SYSTEM-SOP.md` → Media).

Before pushing any page:
```
bash tools/setup.sh                       # once per session (Pillow + ffmpeg venv)
bash tools/serve.sh &                     # static server on :8765
node tools/check-page.mjs http://localhost:8765/<folder>/   # 390/820/1440, errors, overflow
node tools/pdf.mjs http://localhost:8765/<folder>/ <folder>/<Name>.pdf   # when a PDF is wanted
node tools/dev-worker.mjs                 # local worker with fake R2 + email, for worker changes
```
Look at the screenshots yourself before calling it done. Then push and confirm the
live URL returns 200.

## Sandbox gotchas

- `pkill -f <pattern>` kills your own shell if the pattern is in the command line.
  Kill by PID: `kill $(ps aux | grep "[n]ode tools/dev-worker" | awk '{print $2}')`.
- System Pillow can be broken: use `~/.mde-venv/bin/python` after `tools/setup.sh`.
- Playwright: block external requests in tests; Chromium here cannot play H.264,
  so video playback is checked by file type, not in the test browser.
