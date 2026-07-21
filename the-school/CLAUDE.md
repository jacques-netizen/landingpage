# THE SCHOOL — Build Constitution

This file governs how Claude Code (and any developer) works on this repo.
Read it before writing any code. These rules override convenience.

## Rule 0 — Content is DATA, never code

The single most important architectural rule of this project:

- **No curriculum content is ever hardcoded** into components, pages, or logic.
  No module titles in JSX. No lesson text in components. No campus lists in code.
- All curriculum (schools, campuses, modules, lessons, assignments, shelf items)
  lives in the **database**, seeded from `content/curriculum.json`.
- Components render whatever the data says. If the founder rewrites a module,
  reorders campuses, adds a school, or deletes half a curriculum, **zero code
  changes** should be required.
- If you find yourself typing curriculum text inside `src/`, stop. It belongs
  in `content/curriculum.json` or the DB.

The founder will iterate on curriculum constantly. The platform must never
fight him for it.

## Rule 1 — The spine is sacred

The payment → access → Discord-role pipeline is the one path that must never
be sloppy:

  Stripe webhook → Member.accessStatus updated in DB → Event emitted →
  Discord bot grants/revokes role.

- Webhooks are verified (signature check) and idempotent (event id dedupe).
- Access checks always read from the DB (`lib/access.ts`), never from Stripe
  directly at request time.
- If this pipeline and any feature conflict, the pipeline wins.

## Rule 2 — Buy the commodity, build the edge

- Payments: **Stripe** (Billing + hosted Checkout + Customer Portal). Never
  hand-roll billing logic, dunning, or proration.
- Auth: **Clerk** (or Supabase Auth if swapped — keep it behind `lib/` so the
  swap is one file).
- Video: **Mux / Bunny Stream** embeds via `videoUrl` on Lesson. Never serve
  video from this app.
- Everything else (course player, gating, onboarding, dashboards, bot) is
  custom and lives here.

## Rule 3 — Schema flexibility over schema perfection

- Content models carry a `meta Json` field. New per-item properties (badges,
  vault flags, lens variants, experiment flags) go in `meta` first. Promote to
  a real column only when a feature depends on querying it.
- Ordering is explicit (`order Int`) everywhere — the founder reorders things.
- Deletions are soft where member progress references content
  (`archived Boolean`), so restructuring never orphans progress rows.

## Rule 4 — The vault line

This platform teaches craft and strategy. It must never contain:
- MDE's proprietary automation engine details
- Client campaign data or client names
- The scaled clipping-army infrastructure

If curriculum content arrives that crosses this line, flag it — do not seed it.

## Rule 5 — Events feed the setter, not just analytics

Meaningful member actions emit an `Event` row (joined, discord_linked,
module_started, module_completed, went_quiet, ceiling_signal). The setter
queue (Notion sync, Phase 4) is built on these. When adding features, ask
"what event should this emit?" — silence is a bug.

## Build phases (do them in order)

1. **Spine** — auth, Stripe checkout (with $67 bump as add-on), post-checkout
   upsell page ($297 one-click), webhook → access → Discord role. Nothing else
   until a test payment flows end-to-end to a role grant.
2. **Delivery** — data-driven course player: school → campus → module → lesson,
   progress tracking, "Foundation gates everything" logic, lens filtering.
3. **Bot** — role sync (from Phase 1), onboarding DM, announcements, ranks by
   shipped assignments.
4. **Setter feed** — Event stream → Notion sync for the trigger queue.

Reserved for later (schema slots exist, do not build yet): clipper submissions
pool (`Submission` model), payouts.

## Working style

- Small commits per phase step.
- Seed is idempotent (`upsert` by slug) — safe to run after every curriculum
  edit: `npm run seed`.
- When the founder asks for a change, prefer changing **data** over code. If a
  request seems to require hardcoding content, propose the data-driven version
  instead.
