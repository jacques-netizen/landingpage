# The School

Two-school membership platform (Founders / Artists). Custom build:
Next.js + Stripe + Clerk + Postgres/Prisma + Discord bot. No platform fees,
no dependency on anyone's marketplace.

## The one rule

**Content is data.** The entire curriculum lives in `content/curriculum.json`
and the database. Rename a module, reorder campuses, add a school, rewrite a
lesson — edit the JSON, run `npm run seed`, done. If a change seems to need
code, read `CLAUDE.md` first: it probably doesn't.

## Setup

1. `npm install`
2. Copy `.env.example` → `.env`, fill in keys (Postgres, Clerk, Stripe, Discord)
3. Create Stripe products/prices (membership monthly + annual, Vault bump,
   Launch Audit) — paste price IDs into `.env`. Set `metadata.kind` on the
   one-time prices (`bump`, `upsell_audit`) and `metadata.plan` on the
   recurring ones (`monthly`, `annual`).
4. `npm run migrate` — creates the schema
5. `npm run seed` — loads the curriculum from `content/curriculum.json`
6. `npm run dev` — the app
7. `npm run bot` — the Discord role-sync worker (separate process)

## The spine (test this before anything else)

Sign up → `/onboarding` (pick a school, optionally connect Discord) → `/join`
(pick plan, optional Vault bump) → Stripe Checkout → webhook fires →
`Member.accessStatus` flips to active → `access_changed` event → bot grants
the Discord role. If that path works end-to-end, the platform works.

## Pages

- `/` — public landing page (school list is pulled from the DB)
- `/join` — plan/bump/school picker → Stripe Checkout
- `/sign-in`, `/sign-up` — Clerk
- `/onboarding` — school choice + Discord account linking (member row is
  created lazily on first touch, from `/onboarding` or straight from `/join`)
- `/dashboard`, `/campus/[slug]`, `/lesson/[slug]` — the course player
- `/checkout/upsell` — the one-click post-checkout audit offer

## Build phases

See `CLAUDE.md`. Phases 1–3 are built: spine (auth, checkout, webhook, Discord
role grant), delivery (data-driven course player + progress), and the bot
(role sync, onboarding DM on `discord_linked`, campus-completed announcements,
optional rank roles via `DISCORD_RANK_ROLES`). Phase 4 (setter queue → Notion
sync) is intentionally not built yet — it needs the founder's actual setter
Notion database shape to design against.

This app is a standalone Next.js service — it doesn't run inside this repo's
Cloudflare static-asset Worker. Deploy it separately (Vercel + a Postgres host
like Neon/Supabase/Railway both work fine) and run the bot as its own
long-lived process (Railway/Fly/a VPS).

## Editing the curriculum

- Structure + copy: `content/curriculum.json` → `npm run seed`
- Lesson bodies/videos: fill `lessons[].body` (markdown) and `videoUrl`
  (Mux/Bunny embed) in the JSON as you record, or edit rows directly in the DB
- Never delete content that members have progress on — set `"archived": true`
