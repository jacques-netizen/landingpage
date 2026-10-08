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

## Docs

- [`docs/SETUP.md`](docs/SETUP.md): connecting Vercel, Postgres, R2, Resend, GoHighLevel, Cal.com, ManyChat, Meta, Discord, Turnstile and Mux, plus the rollback switch
- [`docs/QA.md`](docs/QA.md): launch checklist with what is checked and what still needs devices, accounts or the owner
- [`docs/video-scripts.md`](docs/video-scripts.md): draft scripts for the founder films
- [`docs/guide-samples/`](docs/guide-samples/): six sample PDFs for copy review

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run check:dashes   # no em dashes anywhere
npm run guides:sample  # builds six sample PDFs and checks them
node tests/e2e/walk.mjs http://localhost:3000 creator /tmp/walk --refresh   # phone sized walk through
```

## Where things live

| Path | What |
|---|---|
| `DESIGN_TOKENS.md` | Colors, type, shape and motion captured from maisondelites.com |
| `docs/reference/` | Screenshots and computed styles of the live site |
| `public/brand/` | Logo, imagery and client logos re-hosted from the site |
| `public/media/placeholder/` | Clearly marked placeholder films (built by `scripts/make-placeholders.sh`) |
| `content/` | Every question, branch, line of copy, result, proof item and media id |
| `content/guide/` | Guide blocks (markdown with front matter) and the outline |
| `src/components/funnel/` | The scene machine and scenes |
| `src/lib/server/` | Sessions, leads, jobs, GHL, email, guide PDF, Meta, Discord, ManyChat |
