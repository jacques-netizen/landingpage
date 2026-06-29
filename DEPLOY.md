# Deploying the site + phone upload page on Cloudflare

The site deploys as a **Cloudflare Worker with static assets**. The Worker
serves the upload API (`/api/*`) and streams videos (`/v/*`); everything else
(the landing page, `/admin`, images) is served as static files. Uploaded videos
are stored in Cloudflare R2, so there is no file-size limit.

## One-time setup

1. **R2 bucket** — dashboard → **R2** → **Create bucket** → name it exactly
   **`maison-delites-media`**. (R2 requires a payment card to enable, but the
   free tier — 10 GB stored, free egress — covers normal use at $0.)

2. **Worker project** — dashboard → **Workers & Pages** → **Create** →
   **Import a repository** → select **`jacques-netizen/landingpage`**.
   Leave the build command empty; deploy command `npx wrangler deploy` is
   correct for this Worker. Deploy.

3. **R2 binding** — Worker → **Settings → Bindings** → add R2 bucket:
   - Variable name: **`MEDIA`** (exactly, all caps)
   - Bucket: `maison-delites-media`
   (Also declared in `wrangler.toml`, so a fresh deploy wires it up too.)

4. **Admin password** — Worker → **Settings → Variables and Secrets** →
   add a **Secret**:
   - Name: **`ADMIN_PASSWORD`**
   - Value: a strong password you choose

5. **Enable a URL** — if the Worker overview says "No URLs enabled," enable the
   **workers.dev** subdomain (Settings → Domains & Routes), or add your custom
   domain. That gives you the public address.

6. **Redeploy** so bindings/secret attach: push any commit, or Deployments →
   latest → Retry. The repo is Git-connected, so pushes auto-deploy.

## Custom domains

One Worker serves the whole funnel across two subdomains of `maisondelites.com`
(registered via Cloudflare Registrar in the same account as the Worker):

| URL | Serves |
|-----|--------|
| `hello.maisondelites.com/` | Clean **landing page** (`index.html`) |
| `book.maisondelites.com/`  | **Booking calendar** — the Worker rewrites `/` → `/book` on any `book.*` host (see `worker.js`) |
| `book.maisondelites.com/booked` | "You're booked" **confirmation** (where the calendar redirects after a booking) |

To connect a subdomain: Worker → **Settings → Domains & Routes** → **Add →
Custom Domain** → e.g. `hello.maisondelites.com`. Cloudflare creates the DNS
record and SSL cert automatically (live in a few minutes).

Routing notes: paths are otherwise host-agnostic (`/book` and `/booked` work on
any host). The landing page's "Book a discovery call" buttons link to
`https://book.maisondelites.com`. Email lives on a separate domain
(`maisondelitesagency.com` at Google Workspace) and is unaffected.

## Using it

Open **`https://<your-worker-url>/admin`**, enter the password, pick a slot,
choose a video, tap Upload. Big files upload in chunks; when it finishes the
player on the main site turns on automatically.

## Video slots

Defined in `lib/slots.js`:

| Slot      | Where it appears |
|-----------|------------------|
| `faq-1`   | FAQ: "What is content distribution & how clipping works" |
| `faq-2`   | FAQ: "How is this different from paid ads" |
| `faq-3`   | FAQ: "How do you make sure the views are real" |
| `walmart` | Walmart case-study clip (falls back to Google Drive until uploaded) |

To add a slot: add it to `lib/slots.js` and point a player at `/v/<key>` in
`index.html`.

## Client campaign dashboard

A live, client-facing campaign report with content tiles. Two pages plus a feed:

| URL | Who | What |
|-----|-----|------|
| `/dashboard` | The client (share the link) | Live report — headline views/clips/creators/CPM, guarantee + budget progress, platform split, content tiles (the actual clips), creator leaderboard. Auto-refreshes every ~20s, no reload needed. |
| `/campaign-admin` | You (password-gated) | Editor to update the numbers and clips. Same `ADMIN_PASSWORD` as `/admin`. |
| `/api/campaign` | — | JSON feed. Public `GET`; authed `POST` writes it. Data is one JSON object in the same R2 bucket (`campaign-data.json`). |

How to run it: open `/campaign-admin`, unlock, fill in the client name, budget
and guarantee, then add a row per clip (paste the post link — YouTube
thumbnails are automatic; for TikTok/Instagram add a thumbnail image URL). Hit
**Recalculate from clips** to auto-fill total views, clip count, platform split
and the creator leaderboard, then **Save**. Any open client dashboard updates
within seconds. Before any data is saved the dashboard shows a tasteful empty
state, so the link is always safe to share.

## Notes
- The code also works unchanged as a Cloudflare **Pages** project (via the
  `functions/` folder) if you ever switch — same handlers power both.
- Keep videos as `.mp4` (H.264) or `.mov` for universal browser playback.

## Troubleshooting
- **"R2 bucket binding MEDIA is not configured"** → step 3 missing, or no
  redeploy after adding it (step 6).
- **Wrong-password loop** → `ADMIN_PASSWORD` secret not set / not deployed.
- **`/admin` unreachable** → no URL enabled yet (step 5), or build failed
  (check the deployment logs).
