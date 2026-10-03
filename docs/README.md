# Build pack: content rewards platform

This folder is the full brief for building the platform from scratch. Copy it into the repository as `/docs`. The design reference image is in `reference/home-reference.jpg`. Read the files in this order.

1. `01_PRODUCT.md` what we are building, for whom, and every screen
2. `02_DATA_AND_MONEY.md` database tables, the ledger and the earnings rules
3. `03_SYSTEMS.md` account linking, view tracking, checks, fraud flags, appeals, notifications, API, security
4. `04_BUILD_PLAN.md` stack, phases, tasks, acceptance checks, tests and the launch checklist
5. `05_DESIGN_SYSTEM.md` the look, tokens, components, page layouts and what to avoid

## What this is

A web platform where clients fund a budget for a campaign, creators post short videos on their own TikTok, Instagram, YouTube or X accounts, and the platform counts the views and pays creators from the budget at a set rate per 1,000 views. MDE staff run every campaign at launch. Clients get a read-only report link. Self-serve client accounts come later.

The product is modelled on three existing platforms (Clipster, MonsterLab, Promote.fun). The goal is the same working features with clearer money rules, published fees, a reason for every rejection and a real appeal process.

## Working rules for Claude Code

1. Build in the order of `04_BUILD_PLAN.md`. Finish a phase and pass its checks before starting the next one.
2. Write the tests first for anything that touches money (see `02_DATA_AND_MONEY.md`). Money code does not merge without passing tests.
3. Money is stored as whole cents in USD. Never use floating point for money.
4. Never invent numbers, claims, testimonials or user counts in the interface. Show real data or leave the element out.
5. When these files do not answer a question, choose the simplest option, write the choice and a one line reason in `DECISIONS.md`, and keep going. Stop and ask only for the items under "Open decisions" below, or when a change would alter a money rule.
6. Commit small. One task per commit, with a plain message.
7. No lorem ipsum in anything shipped. Use the copy in `05_DESIGN_SYSTEM.md` or neutral working copy.
8. Every state needs a design: empty, loading, error and success. A screen is not done until all four exist.
9. Every staff action that changes money, a decision or a user writes a row to the audit log.
10. Follow `05_DESIGN_SYSTEM.md` exactly. Do not fall back to default component library styling.

## Placeholders

- `BRAND_NAME` the platform name. Read it from config. Do not hard code it.
- `CONTACT_EMAIL`, `SUPPORT_DISCORD_URL` read from config.
- `LEGAL_ENTITY` the operating company, read from config and shown in the footer and terms.

## Open decisions (the owner answers these; defaults are given so work is not blocked)

| Decision | Default until answered |
| --- | --- |
| Platform name and domain | `BRAND_NAME` placeholder |
| Fee charged to creators on withdrawal | 0% (set in settings) |
| Minimum withdrawal | $20 (set in settings) |
| Review window after a campaign closes before earnings are released | 7 days (set in settings) |
| How MDE earns from clients | Service fee as a percent on top of the client's budget, set per client |
| Which view data provider to use for accounts linked by bio code | Build the provider interface, ship with a mock provider |
| TikTok and Instagram API access | Build with bio code first; add OAuth when each app review is approved |
| Operating company, governing law, final terms text | Draft terms provided by a lawyer replace the working text |
| Tax form handling per country | Collect through the payout provider's onboarding where supported |

## First message to give Claude Code

> Read every file in `/docs`, starting with `README.md`, and look at `reference/home-reference.jpg`. Then start Phase 0 in `04_BUILD_PLAN.md`. Work phase by phase. After each phase, run its acceptance checks and tell me what passed and what did not before moving on. Record any choice you had to make in `DECISIONS.md`.
