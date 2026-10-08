# Setup and launch

Everything the owner (or whoever deploys) needs to connect the guide funnel
to the real accounts. Each step says what to do, where, and how to check it.
The app runs without any of this (everything falls back to a local mode), so
steps can be done in any order.

## 1. Deploy on Vercel

1. Vercel, **Add New Project**, import `jacques-netizen/landingpage`.
2. **Root Directory: `guide`**. Framework: Next.js (detected).
3. Add the environment variables from `.env.example` (sections below say
   where each value comes from). At minimum for production:
   `SITE_URL`, `APP_SECRET`, `DATABASE_URL`, `CRON_SECRET`, `DASHBOARD_PASSWORD`.
4. Domain: add `guide.maisondelites.com` in the Vercel project, then add the
   CNAME record Vercel shows in Cloudflare DNS (DNS only, grey cloud).
5. The cron in `vercel.json` retries failed background jobs every 5 minutes.
   Vercel sends `CRON_SECRET` as a bearer token automatically when it is set.
   (Per minute schedules need a Vercel Pro plan; every 5 minutes works there too.)

`APP_SECRET` signs the guide and unsubscribe links. Generate it once
(`openssl rand -base64 48`) and never change it, or old links stop working.

## 2. Database (Neon or Supabase)

Create a Postgres database and put its connection string in `DATABASE_URL`.
Tables are created automatically on first request (migrations in `drizzle/`).
Use the pooled connection string on Neon.

## 3. Storage for PDFs (Cloudflare R2)

The account already has the R2 bucket `maison-delites-media`. Either reuse
it (PDFs go under `guides/`) or create a new bucket `mde-guides`.

1. Cloudflare, R2, **Manage R2 API Tokens**, create a token with Object Read
   and Write on that bucket.
2. Set `STORAGE_ENDPOINT` (`https://<account id>.r2.cloudflarestorage.com`),
   `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`,
   `STORAGE_REGION=auto`.

The bucket stays private. Guide links are signed and the app hands out
10 minute download URLs.

## 4. Email (Resend)

1. Resend, **Domains**, add `maisondelites.com` (or a subdomain such as
   `mail.maisondelites.com`). Add the SPF, DKIM and MX records it shows to
   Cloudflare DNS, and a DMARC record if there is none yet:
   `_dmarc  TXT  v=DMARC1; p=none; rua=mailto:<your inbox>`
2. Create an API key: `RESEND_API_KEY`.
3. `EMAIL_FROM` for example `Maison d'Élites <guide@maisondelites.com>`.
   `EMAIL_REPLY_TO` should be a real inbox that someone reads: the soft next
   step asks people to reply with a budget.
4. `EMAIL_FOOTER_LEGAL`: company name and postal address (owner to confirm).

Check: submit the gate with a Gmail, an Outlook and a Hotmail address. Each
should arrive in the inbox within a minute. Use mail-tester.com for a score.

## 5. GoHighLevel

Read from the live sub-account on 2026-10-08 (owner to confirm):

| Use | Pipeline | Stage |
|---|---|---|
| Qualified lead after the gate | DM Setting | New Lead |
| Booking from the guide | Sales | Call Booked |

1. GHL, Settings, **Private Integrations**, create a token for the
   "Maison d'Élites" sub-account with these scopes: contacts read and write,
   opportunities read and write, locations custom fields read and write.
2. `GHL_API_TOKEN` and `GHL_LOCATION_ID=HmYBmlkMf4bgk2CQpEUo`.
3. Pipeline and stage names are matched by name: `GHL_PIPELINE_DM_SETTING`,
   `GHL_PIPELINE_SALES`, `GHL_STAGE_MAP`. If a stage is renamed in GHL, change
   the config, not the code.

The first lead creates the contact custom fields if they do not exist:
`funnel_path, asset, platforms, goal, timing, budget_band, qualified,
human_priority, guide_url, source`. Tags: `guide-lead`, `path-<role>`,
`qualified` or `not-qualified`, `human-priority`, `booked-via-guide`,
`guide-unsubscribed`. Nurture emails belong in GHL workflows triggered by
these tags.

## 6. Cal.com

1. On the discovery event type, add three **booking questions** (Hidden, or
   Optional short text) with exactly these identifiers: `asset`,
   `budget_band`, `company`. The embed prefills them, plus name and email.
2. Event type, **Advanced**, **Redirect on booking**:
   `https://book.maisondelites.com/booked`. (The embed also redirects there
   itself after a booking.)
3. `CAL_BOOKING_URL`: the public link of that event type, for example
   `https://cal.com/maisondelites/discovery`.
4. Settings, **Developer**, **Webhooks**, new webhook:
   - Subscriber URL: `https://guide.maisondelites.com/api/webhooks/cal`
   - Event: Booking Created
   - Secret: a long random string, also set as `CAL_WEBHOOK_SECRET`

Check: book a test slot as a qualified lead. The opportunity moves to
Sales, Call Booked, the contact gets `booked-via-guide`, Discord gets the
booking alert, and the browser lands on the pre-call page.

## 7. ManyChat

The DM button link. Paste it into the ManyChat flow and replace the two
values in braces with ManyChat's own fields from its field picker: the
contact's first name, and the system field holding the subscriber id
(shown as User ID or Contact ID, depending on the ManyChat version):

```
https://guide.maisondelites.com/?fn={first name}&mc={subscriber id}&src=ig-distribution
```

- `fn` greets by first name on the cold open. It is never stored.
- `mc` is the ManyChat subscriber id. After the gate, the app adds the tag
  `guide-requested` (`MANYCHAT_TAG_NAME`) to that subscriber.
- `src` is stored on the session and sent to the CRM as `source`. Use a
  different value per reel or keyword to compare them in the dashboard.

Optional: create three Text custom fields in ManyChat named `guide_path`,
`guide_qualified` and `guide_url`; the app fills them when they exist.

`MANYCHAT_API_TOKEN`: ManyChat, Settings, API, generate the token.

## 8. Meta Pixel and Conversions API

1. `META_PIXEL_ID`: the pixel id from Events Manager.
2. `META_CAPI_TOKEN`: Events Manager, the pixel, Settings, Conversions API,
   **Generate access token**.
3. For testing set `META_TEST_EVENT_CODE` from the Test Events tab, run a
   lead and a booking, check both show as deduplicated (browser and server),
   then remove the test code.

The pixel loads only after the gate consent is given.

## 9. Discord

Discord channel, Edit Channel, Integrations, Webhooks, New Webhook, copy the
URL into `DISCORD_WEBHOOK_URL`. Alerts: every qualified lead, every human
priority lead (marked and with `@here`), every booking. No email addresses.

## 10. Cloudflare Turnstile

Cloudflare, Turnstile, add a widget for `guide.maisondelites.com` (Managed
mode). Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (and `TURNSTILE_SITE_KEY`) and
`TURNSTILE_SECRET`. Without them the bot check is skipped.

## 11. Video (Mux)

1. Upload each film to Mux with captions (`.vtt`) and copy the playback id.
2. In `content/media.json`, for that logical id set `"provider": "mux"`,
   `"id": "<playback id>"`, `"poster": null` (Mux thumbnail) or a custom
   image, `"captions": "/media/<file>.vtt"` (put the vtt in `public/media/`),
   and `"placeholder": false`.

No code changes. `VIDEO_PROVIDER` is informational; each item names its own
provider, so files and Mux can be mixed while filming is in progress.

## 12. Rollback

Set `FUNNEL_ENABLED=false` and `OLD_GUIDE_URL=<link to the old PDF>`, then
redeploy (or change the variables and redeploy). Every visit to the root
redirects to the old PDF. Guide links already sent keep working.

## 13. Experiments

`VARIANT_SPLIT` is the share of new visitors on the full experience (the rest
get the plain control). `PROGRESS_SPLIT` is the share with the progress
line. Force an arm for testing with `?_v=full`, `?_v=plain`,
`?_p=front_loaded` or `?_p=none` on a fresh browser.

## 14. Dashboard

`/dashboard` with `DASHBOARD_PASSWORD`. Compare the gate submit rate and the
bookings per qualified lead between arms, not only completion.
