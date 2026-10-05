# One image for both services of the content rewards platform (web app and worker). The host picks
# the start command per service: see docs/DEPLOY_PLATFORM.md. Build from the repository root:
#   docker build -f apps/Dockerfile .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# Next inlines nothing secret at build time; runtime settings come from the environment.
RUN NODE_ENV=production pnpm --filter @mde/web build

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
# Default: the web app. The worker service overrides this with `pnpm worker`.
CMD ["sh", "-c", "pnpm --filter @mde/web exec next start -p ${PORT:-3000}"]
