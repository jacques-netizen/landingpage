# Deploying the site + phone upload page on Cloudflare Pages

The landing page now has a password-protected upload page at **`/admin`** where
you can upload videos of any size straight from your phone. They're stored in
Cloudflare R2 and streamed to the site from `/v/<slot>`. This is the one-time
setup to switch hosting from GitHub Pages to Cloudflare Pages.

Everything here is done in the Cloudflare dashboard — no command line needed.

---

## 1. Create a Cloudflare account
Go to https://dash.cloudflare.com/sign-up (free). Verify your email.

## 2. Create the R2 storage bucket
1. In the dashboard sidebar: **R2** → **Create bucket**.
2. Name it exactly: **`maison-delites-media`**
3. Leave location/automatic. Create. (R2 has a generous free tier; beyond it,
   storage is ~$0.015/GB per month. A handful of clips costs pennies.)

> You do **not** need to make the bucket public — the site serves files through
> the `/v/...` function, not directly from R2.

## 3. Connect the repo to Cloudflare Pages
1. Sidebar: **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
2. Authorize GitHub and pick the **`jacques-netizen/landingpage`** repo.
3. Build settings:
   - **Production branch:** `main` (or whichever branch you publish from)
   - **Framework preset:** `None`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`  (just a single slash, or leave default)
4. Click **Save and Deploy**. First deploy takes ~1 minute.

## 4. Add the R2 binding to the Pages project
1. Open the new Pages project → **Settings** → **Bindings**
   (older UI: *Functions* → *R2 bucket bindings*).
2. **Add binding**:
   - **Variable name:** `MEDIA`   *(must be exactly this)*
   - **R2 bucket:** `maison-delites-media`
3. Save.

## 5. Set the admin password
1. Same project → **Settings** → **Variables and Secrets**
   (older UI: *Environment variables*).
2. Add a **Secret** (encrypted), not a plain text variable:
   - **Name:** `ADMIN_PASSWORD`
   - **Value:** a strong password you'll remember
3. Save. Apply it to the **Production** environment (and Preview if you want
   `/admin` to work on preview URLs too).

## 6. Redeploy so the binding + secret take effect
Project → **Deployments** → open the latest → **Retry deployment** (or just push
any commit). Bindings/secrets only attach on a fresh deployment.

## 7. Use it
1. Visit **`https://<your-project>.pages.dev/admin`** (or your custom domain
   + `/admin`) on your phone.
2. Enter the password.
3. Pick a slot, choose a video, tap **Upload**. Big files upload in chunks;
   when it finishes the player on the main site turns on automatically.

---

## Pointing your real domain here
Pages → **Custom domains** → add your domain and follow the DNS steps. After
that, turn off the old GitHub Pages site (repo **Settings → Pages → Source:
None**) so there's only one live version.

## The video slots
Defined in `lib/slots.js`. Current slots:

| Slot      | Where it appears |
|-----------|------------------|
| `faq-1`   | FAQ: "What is content distribution & how clipping works" |
| `faq-2`   | FAQ: "How is this different from paid ads" |
| `faq-3`   | FAQ: "How do you make sure the views are real" |
| `walmart` | Walmart case-study clip (falls back to the old Google Drive video until you upload here) |

To add another slot later: add an entry to `lib/slots.js` and point a player
in `index.html` at `/v/<new-key>`.

## Troubleshooting
- **`/admin` says "Network error"** → the site isn't on Cloudflare Pages yet,
  or you opened the GitHub Pages URL. Use the `*.pages.dev` URL.
- **"R2 bucket binding MEDIA is not configured"** → step 4 missing, or you
  didn't redeploy after adding it (step 6).
- **Wrong password loops** → the `ADMIN_PASSWORD` secret isn't set for that
  environment, or wasn't applied via a fresh deployment.
- **Video uploaded but won't play** → make sure it's an `.mp4` (H.264) or
  `.mov`; some exotic codecs won't play in browsers.
