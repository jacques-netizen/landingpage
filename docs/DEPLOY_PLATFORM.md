# Deploying the content rewards platform

The platform (the creator app, staff admin and background jobs) is deployed on Railway, separately from
the Maison d'Élites static site, which stays on Cloudflare (see `DEPLOY.md`). One Docker image
(`apps/Dockerfile`) runs as two services: the **web** app and the **worker** that runs view checks,
releases, emails and the other scheduled jobs.

## What you need first

| What | Where | Used for |
| --- | --- | --- |
| Railway account | railway.com | Hosting the web app, worker, Postgres and Redis |
| A domain or subdomain | Your DNS provider | For example `app.maisondelites.com` |
| Resend account and API key, with your domain verified | resend.com | Sign-in links and notification emails |
| Scrape Creators API key | scrapecreators.com | View counts for TikTok, Instagram and X |
| Google Cloud project with the YouTube Data API v3 on, an API key, and an OAuth client | console.cloud.google.com | YouTube views and "Link with YouTube" |
| Your legal entity name | | Email footers and legal pages |

The platform runs without the Scrape Creators and Google keys, but then posts on those platforms
cannot be checked. Email is required: without it nobody can sign in.

## One-time setup

1. **Project.** In Railway, create a new project and add a **PostgreSQL** database and a **Redis**
   database to it.
2. **Web service.** Add a service from the GitHub repository `jacques-netizen/landingpage`
   (branch: the one you deploy from). In the service settings:
   - Config file path (Settings, Config-as-code): `apps/railway.web.json`.
     This builds `apps/Dockerfile`, runs the database migrations before each deploy, and checks
     `/api/health`.
   - Networking: generate a domain, then add your custom domain and create the DNS record Railway shows.
3. **Worker service.** Add a second service from the same repository and branch, with config file path
   `apps/railway.worker.json` (it starts with `pnpm worker`). It needs no domain. If your Railway plan
   does not offer a config file path, set the same values by hand: Dockerfile path `apps/Dockerfile`,
   and for the worker the start command `pnpm worker`; for the web service the pre-deploy command
   `pnpm db:migrate` and health check path `/api/health`.
4. **Variables.** Set these on **both** services (Railway's shared variables make this one step):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` |
   | `AUTH_SECRET` | A long random string: `openssl rand -base64 48` |
   | `APP_URL` | `https://app.yourdomain.com` (no trailing slash) |
   | `EMAIL_API_KEY` | Your Resend API key |
   | `EMAIL_FROM` | For example `Maison d'Élites <no-reply@yourdomain.com>` (a verified Resend domain) |
   | `LEGAL_ENTITY` | Your company's legal name |
   | `BRAND_NAME` | `Maison d'Élites` |
   | `CONTACT_EMAIL` | Where client enquiries go |
   | `DATA_PROVIDER_API_KEY` | Your Scrape Creators key |
   | `YOUTUBE_API_KEY` | Your YouTube Data API key |
   | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | The Google OAuth client. Authorised redirect URIs: `https://app.yourdomain.com/api/auth/callback/google` and `https://app.yourdomain.com/api/oauth/youtube/callback` |
   | `ADMIN_EMAIL` | Your email (several: separate with commas). That address becomes admin the first time it signs in |
   | `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32`. Never change it once set: linked YouTube accounts are encrypted with it |

   Never set `MOCK_PROVIDER`, `EMAIL_DEV_OUTBOX` or `DESIGN_STATES` in production. They are for tests only.
5. **Deploy.** Deploy the web service first (it applies the migrations), then the worker.
6. **First admin.** Easiest: set `ADMIN_EMAIL` (above) and sign in with that address. Or, in the web
   service, open a shell (or run a one-off command) and run:

   ```
   pnpm staff:grant you@yourdomain.com admin
   ```

   Then sign in at `https://app.yourdomain.com/sign-in` with that address. Repeat with `reviewer` or
   `finance` for the rest of the team.

## Checking it works

- `https://app.yourdomain.com/api/health` answers `{"ok":true}`.
- The worker logs a `job done` line for each job (view checks every minute).
- Sign in by magic link, create a client, record funding, build and publish a campaign, then open
  `/campaigns` signed out and see it listed.

## Updating

Every push to the deploy branch rebuilds both services. Migrations run before the new web version
starts. Never run `pnpm db:seed` against production: it refuses to, because the product must never show
sample data.

## Two addresses: brand site and app

One web service answers on both domains:

- `maisondelites.com` shows the brand site (and its legal pages and `/for-clients`). Anything else asked
  for there is sent to the app; `www.maisondelites.com` goes to `maisondelites.com`.
- `app.maisondelites.com` is the creator app and staff admin (`/staff/sign-in`, `/admin`).

Set on both services: `APP_URL=https://app.maisondelites.com` and `BRAND_HOST=maisondelites.com`.
In Railway add three custom domains to the web service: `maisondelites.com`, `www.maisondelites.com`
and `app.maisondelites.com`, and create the DNS records Railway shows in Cloudflare (leave
`campaigns.maisondelites.com` as it is). Add `https://app.maisondelites.com/api/auth/callback/google`
and `https://app.maisondelites.com/api/oauth/youtube/callback` to the Google OAuth client.
