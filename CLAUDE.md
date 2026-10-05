# CLAUDE.md

Rules for building the content rewards platform. Follow them for the whole project.

## Start of every session

Read `/docs` and this file again at the start of every new session, in this order: `docs/README.md`, `01_PRODUCT.md`, `02_DATA_AND_MONEY.md`, `03_SYSTEMS.md`, `04_BUILD_PLAN.md`, `05_DESIGN_SYSTEM.md`, then `docs/design/handoff/README.md`. Then read `DECISIONS.md`.

Where things live:
- Final design mockups: `docs/design/handoff/` ("Platform Mockups.dc.html" and "Creator Site v1.dc.html").
- Locked design screenshots: `docs/design/reference-screens/` at 1440 and 1024 px (from the mockups, rebuilt only with `docs/design/capture-reference-screens.mjs`) and at 390 px for approved phone layouts (from the product, `apps/web/scripts/capture-phone-references.mjs`). Stored in Git LFS. Never rewritten unless the owner says so in writing.
- Reference image: `docs/reference/home-reference.jpg`.

## Design rules

- The design is locked. The handoff mockups decide every visual and copy detail of every screen they show, with "Creator Site v1" winning on creator screens. Never change them for any reason. Build them pixel for pixel.
- That covers layout, fonts, colours, gradients, spacing, sizes, copy, labels, animations and the order of sections. Not to "improve" them, not to match another doc, not to fix something that looks wrong. If something in the design looks like a mistake, tell the owner and keep building it exactly as designed.
- Where `05_DESIGN_SYSTEM.md` or `home-reference.jpg` disagree with the mockups, the mockups win, every time, without asking. Do not list these as questions.
- `05_DESIGN_SYSTEM.md` is used only for screens and states the mockups do not show (for example admin screens not in the mockups, form errors, drawers). Even then, use the mockups' fonts, colours and components, so new screens look like they belong to the same design.
- If a feature in the docs needs something added to a screen the mockups show (a new button, filter or field), stop and ask the owner before adding it. Never fit it in by moving or restyling what is already designed.
- Every designed screen gets a Playwright visual test against `docs/design/reference-screens/`. CI fails if a screen drifts from the locked design. Never update a reference screenshot unless the owner says so in writing.
- `support.js` and `image-slot.js` in the handoff folder are the mockup's preview tool only. Never use them in the product.

## Phone layouts

- The mockups have no phone layout. The 390 px captures are not part of the locked design.
- When building each screen, propose a phone layout that uses only the mockups' fonts, colours, components and copy, nothing new. Show the owner screenshots.
- Once the owner approves a phone layout, add it to the reference set and lock it like the rest.
- Approved and locked: home and brand site phone layouts (`apps/web/src/designed/phone.css`).

## Approved content

- Everything in the mockups ships as designed, including the brand site, logo wall, case studies (Walmart, Wale, Kojo Blak, Jake & Logan Paul), the Kojo Blak testimonial, "1B+ views", pricing tiers, Book a call, the Dark and Glass themes, tiers, streak and leaderboard. This content is real and approved by the owner. It is not invented.
- This overrides the out of scope list in `01_PRODUCT.md` and `04_BUILD_PLAN.md` for tiers, streak, leaderboard and the Dark theme. Both themes ship, with the default exactly as the mockups have it.
- Store marketing content in settings so staff can edit the words and videos without code. The layout stays fixed.
- Numbers marked "Sample" in the mockups are seed data only. In production those same elements show real data.
- Where the rules behind an element are not defined yet (tiers, streak, leaderboard), ask the owner when you reach that phase. Never change the design to work around missing rules.
- Never invent numbers, user counts, claims or testimonials beyond the approved content above.

## Build rules

- Build in the order of `04_BUILD_PLAN.md`. Finish a phase and pass its acceptance checks before starting the next. Wait for the owner's go-ahead between phases.
- Write tests first for anything that touches money. Money is whole cents in USD. Never use floats for money.
- No default component library styling. No em dashes in interface copy.
- Every screen needs loading, empty, error and success states. Use the ones in the mockups where they exist. Where they do not, build them in the mockups' style.
- Every staff action that changes money, a decision or a user writes to the audit log.
- When the docs do not answer a question, choose the simplest option, record it in `DECISIONS.md` with a one line reason, and continue. Stop and ask only for the open decisions in `docs/README.md`, for anything that would change a money rule, or for anything that would touch the locked design.
- One task per commit, with a plain message.

## Repository notes

- Next.js 16 changed APIs and conventions. Its docs ship in `apps/web/node_modules/next/dist/docs/`; read the relevant guide before using a Next.js API.

- This repository also holds the existing Maison d'Élites static site, deployed as a Cloudflare Worker that serves the repo root. Anything that must not be public (docs, apps, packages, tooling) is listed in `.assetsignore`. Keep it that way.
