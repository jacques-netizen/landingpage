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

## Custom domain

The funnel is served at **`book.maisondelites.com`** (a subdomain of
`maisondelites.com`, registered via Cloudflare Registrar in the same account as
the Worker). To connect it:

1. Register `maisondelites.com` — dashboard → **Domain Registration → Register
   Domains**. It auto-lands on Cloudflare DNS in this account.
2. Worker → **Settings → Domains & Routes** → **Add → Custom Domain** →
   `book.maisondelites.com`. Cloudflare creates the DNS record and SSL cert
   automatically (live in a few minutes).

The site is domain-agnostic — all internal links/API calls are relative, so no
code changes are needed when the domain changes. Email lives on a separate
domain (`maisondelitesagency.com` at Google Workspace) and is unaffected.

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
