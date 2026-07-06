# SOP — Launch a client campaign dashboard

A repeatable, no-code runbook for spinning up a live campaign dashboard for a new
client. Each client gets its own private URL and its own data on the **same**
Worker — **no new repo, Worker, or bucket per client.**

- **Client dashboard:** `https://campaigns.maisondelites.com/<slug>`
- **Your editor:** `https://campaigns.maisondelites.com/<slug>/admin`

`<slug>` is a short lowercase name (letters, numbers, dashes), e.g. `acme` or
`acme-records`. It's the whole "account" — pick it once and reuse it.

---

## One-time setup (do this once, ever)

1. **Point the domain at the Worker.** Cloudflare dashboard → **Workers & Pages**
   → the **`landingpage`** Worker → **Settings → Domains & Routes** → **Add →
   Custom Domain** → `campaigns.maisondelites.com`. Cloudflare creates the DNS
   record + SSL automatically (live in a few minutes).
2. That's it. `ADMIN_PASSWORD` and the R2 bucket are already configured from the
   main deploy; every client reuses them.

> **Do I need a new repo?** No. One repo, one Worker, one R2 bucket serve every
> client. A "new client" is just a new URL slug + its own JSON object in R2,
> created automatically the first time you publish to it.

---

## Launch a new client (~2 minutes, repeat per client)

1. **Pick the slug** — e.g. `acme`.
2. Open **`https://campaigns.maisondelites.com/acme/admin`**.
3. **Unlock** with the `ADMIN_PASSWORD`.
4. Under **Campaign settings** set the **Artist / client** name (prefilled from
   the slug), optionally a campaign title, and the **Budget**.
5. **Export the CSV** from your Content Rewards tracker (the submissions view →
   export/download CSV).
6. **Drop the CSV** on the upload box → review the preview (clip count, views,
   how many have links, spend if present) → **Save & publish**.
7. **Share the link:** `https://campaigns.maisondelites.com/acme` with the client.

The dashboard is live and auto-refreshes. Re-publish a fresh CSV anytime to
update it.

---

## What the dashboard shows

- Headline **total views, clips, creators, avg CPM**.
- **Budget deployed** — only if the CSV has a reward/earnings column with real
  amounts; spend is **never estimated**. No column → the spend/CPM tiles hide.
- **Platform split** (TikTok / Instagram / YouTube) by views.
- **Content cards** — one per clip: a gold monogram of the creator's initials,
  view count, and a **status tag** (Accepted / Pending / Rejected) read from the
  CSV Status column. Rejected clips are dimmed and don't count toward the totals.
  Each card links to the real post.
- **Top creators** leaderboard.

## CSV expectations

The parser is tolerant of column names. It looks for (any reasonable synonym of):
`url` / submission link, `views`, `creator`, `platform`, `status`, and an
earnings/`amount paid` column. Views may be written `980K` / `1.2M` /
`1,200,000`. Platform is inferred from the link if there's no platform column.

---

## Notes & troubleshooting

- **Wrong password loop** → `ADMIN_PASSWORD` secret not set/deployed on the Worker.
- **Spend shows nothing** → the export has no paid/earnings amounts (all $0 or no
  such column). This is intentional — spend is only ever shown from real data.
- **A clip has no status tag** → that row's Status cell was blank / the export has
  no Status column.
- **Bare `campaigns.maisondelites.com`** shows a neutral placeholder on purpose —
  there is no public list of clients.
- **Optional auto-sync:** set a plaintext Worker var `CAMPAIGN_CSV_URL` (a
  published-to-web CSV) and `CAMPAIGN_CSV_CLIENT=<slug>`; the 15-min cron refreshes
  that client from the sheet. Leave unset for manual publishing.
