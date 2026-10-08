# Interactive guide funnel

The app behind `guide.maisondelites.com`: a short film with questions in it
that ends in a personalized guide, a booking calendar for qualified buyers and
a join link for clippers. The full brief is in
[`docs/guide-funnel-build-plan.md`](docs/guide-funnel-build-plan.md).

This folder is a standalone Next.js app. It is not part of the Cloudflare
Worker at the repo root (the root `.assetsignore` excludes it) and deploys to
Vercel with `guide` as the project root directory.

## Run it locally

```bash
cd guide
npm install
cp .env.example .env.local   # every value can stay empty for local work
npm run dev
```

With no credentials set, the app uses an embedded database (PGlite under
`.data/`), stores PDFs on local disk and logs CRM, email, Discord, Meta and
ManyChat calls instead of sending them.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run check:dashes   # no em dashes anywhere
```

## Where things live

| Path | What |
|---|---|
| `DESIGN_TOKENS.md` | Colors, type, shape and motion captured from maisondelites.com |
| `docs/reference/` | Screenshots and computed styles of the live site |
| `public/brand/` | Logo, imagery and client logos re-hosted from the site |
| `public/media/placeholder/` | Clearly marked placeholder films (built by `scripts/make-placeholders.sh`) |
