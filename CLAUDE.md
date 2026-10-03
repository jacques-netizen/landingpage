# Rules for this project

The brief is in `/docs`. Read `docs/README.md` first. The design reference is `docs/reference/home-reference.jpg`.

1. Build in the order of `docs/04_BUILD_PLAN.md`. Finish a phase and pass its acceptance checks before starting the next. After each phase, report what passed and what did not, then wait for the owner's go-ahead.
2. Write tests first for anything that touches money. Money is whole cents in USD. Never use floats for money, including in code and in the UI formatting path.
3. Never invent numbers, user counts, claims or testimonials in the interface. Show real data or leave the element out.
4. Follow `docs/05_DESIGN_SYSTEM.md` exactly. No default component library styling. No em dashes in interface copy, emails or generated documents.
5. Every screen needs designed loading, empty, error and success states.
6. Every staff action that changes money, a decision or a user writes to the audit log, in the same database transaction.
7. When the docs do not answer a question, choose the simplest option, record it in `DECISIONS.md` with a one line reason, and continue. Stop and ask only for the open decisions listed in `docs/README.md` or for anything that would change a money rule.
8. One task per commit, with a plain message.

## Repository notes

- The repository root also holds an older static site (Cloudflare Worker, `worker.js`, `wrangler.toml`). Do not edit it. The platform lives in `/apps` and `/packages`. See `DECISIONS.md`.
- Brand name, contact email, Discord URL and legal entity come from config (`packages/config`). Never hard code them.
