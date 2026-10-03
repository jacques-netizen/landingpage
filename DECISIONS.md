# Decisions

Choices made while building where the docs did not answer. One line of reason each.

| # | Decision | Reason |
| --- | --- | --- |
| 1 | The platform is added next to the existing static site in this repository, without touching the existing files. | The repository already serves a live Cloudflare Worker site; deleting it is not asked for. |
| 2 | `.assetsignore` is extended to exclude `apps`, `packages`, `docs`, `node_modules` and tooling files. | The Worker serves the repo root as static assets, so new source and dependencies must not be published. |
| 3 | pnpm workspaces for the monorepo, no Turborepo. | Simplest option that gives the layout in 04 section 2. |
