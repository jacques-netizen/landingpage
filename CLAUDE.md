# Repository map

Two separate things live in this repository and deploy differently:

| Folder | What | Deploys |
| --- | --- | --- |
| `guide/` | The guide funnel app (opt-in, thanks page, /secrets lead magnet, dashboards) at guide.maisondelites.com | Vercel, from branch `claude/awesome-meitner-otpkia`. Read `guide/HANDOVER.md` and `guide/CLAUDE.md` first |
| everything else | The main site and its static pages (booking, booked, proposals, client dashboards, onboarding) | Cloudflare Worker (`worker.js`, `wrangler.toml`) from the default branch `claude/beautiful-franklin-kl5mvv`. See `DEPLOY.md` and `SOP.md` |

Never write, print or commit a secret. No em dashes in content or code.
