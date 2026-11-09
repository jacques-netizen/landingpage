# Client Onboarding App: Handover SOP

This document is the starting point for anyone (person or Claude Code session)
taking over the Maison d'Élites client onboarding app. It covers what the app
does, how it's built, how to run, test and deploy it, and what's live today.
Read it fully before changing anything.

Last updated: 9 November 2026.

---

## 1. What it is

After a client pays, they get a private link to an onboarding form. The form
asks the questions for the offer they bought, then they book their onboarding
call. The team gets notified and reads the answers in an admin page, which also
runs the client email sequence.

| Address | Who | What |
|---|---|---|
| `https://onboarding.maisondelites.com/<token>` | Client | Their private form. No sign-in; the 43-character random token in the link is the key |
| `https://onboarding.maisondelites.com/admin` | Team | Admin page (password: the `ADMIN_PASSWORD` Worker secret) |
| `https://onboarding.maisondelites.com/` | Anyone | Redirects to maisondelites.com |

Three offers, each with its own question set, emails and booking link:

| Offer id | Shown as | Questions after the 8 shared ones |
|---|---|---|
| `clipping` | Clipping campaign | 10 (3 of them only when "A song" is picked) |
| `coaching` | 1-on-1 coaching | 10 |
| `consulting` | Consulting | 4 |

End-to-end flow:

1. Admin creates a link and picks the offer (only the offer is required).
2. If admin entered an email, the welcome email with the form link goes out
   automatically. Otherwise admin copies the ready-made WhatsApp message.
3. The client fills in the form, one question per screen. Progress saves on
   every Continue; reopening the link resumes where they stopped.
4. The client submits, then books the onboarding call on the last screen
   (a Cal.com calendar, Google Meet) or picks "Book later".
5. The client gets a confirmation email with the booking link; the team gets
   an "Onboarding submitted" email (and Discord, if set up) with a link to
   the submission in admin.
6. Admin reads the answers, exports them (copy as text, save as PDF), and for
   Clipping creates the campaign and runs the campaign emails.

---

## 2. Accounts and access the new owner needs

| What | Where | Why |
|---|---|---|
| GitHub repo `jacques-netizen/landingpage` | GitHub | All code. Push access to open and merge pull requests |
| Cloudflare account that owns `maisondelites.com` | dash.cloudflare.com | Worker `landingpage`, its variables and secrets, the R2 bucket, DNS |
| Resend | resend.com | Sends all email. Domain `maisondelites.com` is verified there |
| Cal.com | cal.com/maison-d-elites-tvxf8y | The "Onboarding call" event (Google Meet) |
| Admin password | Ask Jacques | The `ADMIN_PASSWORD` Worker secret. Never commit it |
| Team inbox | jacques@maisondelitesagency.com | Receives "Onboarding submitted" and alert emails |

The onboarding app is **not** part of the Railway platform (app.maisondelites.com).
It runs entirely on the Cloudflare Worker described below.

---

## 3. Stack

- **One Cloudflare Worker** named `landingpage`, entry `worker.js`, config
  `wrangler.toml`. The same Worker serves the rest of the site (landing pages,
  proposals, campaign dashboards); onboarding is one part of it.
- **No framework, no build step.** Pages are plain HTML files with inline CSS
  and JavaScript. Server code is plain JavaScript modules in `lib/`.
- **No database.** Each client is one JSON file in the R2 bucket
  `maison-delites-media` (binding `MEDIA`). Uploaded files sit beside it.
- **Email:** Resend's HTTP API, key in the `RESEND_API_KEY` secret.
- **Booking:** a Cal.com link per offer, embedded on the last screen (Calendly
  and Google Calendar booking pages also work).
- **Cron:** every 15 minutes (`wrangler.toml`), runs the automatic form
  reminder and the weekly check-in alerts.
- **Rate limit:** `ONBOARDING_LIMITER` binding, 300 requests a minute per IP
  on the public routes.

---

## 4. Files

| File | What it does |
|---|---|
| `lib/questions.js` | **The config.** Every question for every offer, and the per-offer client email templates (welcome and confirmation). Edit wording and questions here |
| `lib/forms.js` | Reads the config: cleans answers, checks required fields and formats, turns answers into text, moves old records onto the new questions |
| `lib/onboarding.js` | All onboarding routes: client API (load, autosave, submit, uploads), admin API (links, settings, setup check, exports data), booking links, notification emails |
| `lib/sequence.js` | The client email sequence in admin: welcome, form reminder, and for Clipping campaign live / weekly check-in / campaign complete. Also the cron job |
| `onboarding/form.html` | The client's form, booking screen and thank-you screen. Builds itself from the questions the server sends |
| `onboarding/admin.html` | The admin page |
| `worker.js` | Routes `onboarding.maisondelites.com/*` and `/onboarding/*` to `lib/onboarding.js`; runs the cron |
| `campaign-admin/index.html` | Campaign editor; "Create campaign from this" prefills it from a Clipping submission |
| `DEPLOY.md` | Setup notes for the whole Worker, including onboarding |

`.assetsignore` keeps `lib/`, `worker.js`, `*.md` and config out of the public
site. Pages under `onboarding/` are only ever served through the Worker routes.

---

## 5. Routes

All onboarding routes live under `/onboarding`. On the `onboarding.` subdomain
the Worker maps the root onto them (`/<token>` = `/onboarding/<token>`,
`/admin` = `/onboarding/admin`), so both forms work.

Client (no auth, rate-limited, the token is the key):

| Method and path | Does |
|---|---|
| `GET /onboarding/api/s/<token>` | The client's state: offer, questions, answers, files, booking link (marks the link opened) |
| `POST /onboarding/api/s/<token>/save` | Autosave `{answers, last_question}` |
| `POST /onboarding/api/s/<token>/submit` | Final check and submit; sends the confirmation and team emails |
| `POST /onboarding/api/s/<token>/state` | `{action: 'booked' or 'book_later'}` |
| `POST /onboarding/api/s/<token>/upload?action=create,part,complete,abort` | Chunked upload into R2 |
| `DELETE /onboarding/api/s/<token>/file?id=` | Remove an upload before submitting |

Admin (header `Authorization: Bearer <ADMIN_PASSWORD>`):

| Method and path | Does |
|---|---|
| `GET /onboarding/api/admin/links` | All clients, newest first |
| `POST /onboarding/api/admin/links` | Create a link `{offer, client_name?, first_name?, email?, campaign_name?}`; sends the welcome when there's an email |
| `GET /onboarding/api/admin/link?token=` | One client: answers, files (signed download links), questions |
| `POST /onboarding/api/admin/link?token=` | `{action: 'reopen'}`, `{action: 'set_offer', offer}` (before submit), `{action: 'set_campaign', campaign_id}` |
| `DELETE /onboarding/api/admin/link?token=` | Delete the client, answers and files |
| `GET/POST /onboarding/api/admin/sequence?token=` | Client emails: state, preview, send, mark as sent |
| `GET /onboarding/api/admin/health` | The setup check shown at the top of admin |
| `POST /onboarding/api/admin/settings` | Save booking links per offer and the sender |
| `GET /onboarding/api/admin/prefill?token=` | Values for "Create campaign from this" |
| `GET /onboarding/api/file?k=&e=&s=` | Signed file download, expires after 15 minutes |

---

## 6. Data

R2 bucket `maison-delites-media`:

| Key | Contents |
|---|---|
| `onboarding/links/<token>.json` | One client: the record below |
| `onboarding/files/<token>/<question id>/<file>` | Their uploads (original name in custom metadata) |
| `onboarding/settings.json` | Booking links per offer and the sender, saved from admin |

A client record (`onboarding/links/<token>.json`):

```json
{
  "token": "43 random characters",
  "offer": "clipping | coaching | consulting",
  "form": 2,
  "client_name": "optional, typed in admin",
  "campaign_name": "optional",
  "status": "sent | opened | in_progress | submitted",
  "created_at": "...", "opened_at": "...", "submitted_at": "...",
  "answers": { "<question id>": "<answer, shape depends on the question type>" },
  "last_question": "the screen to resume on",
  "booking_state": "'' | booked | book_later",
  "booking_error": "set when the client saw no calendar",
  "campaign_id": "campaign dashboard slug, when created",
  "notified_at": "submit notifications sent once",
  "seq": {
    "fields": { "first_name": "", "email": "", "campaign": "", "report_url": "" },
    "sent": { "welcome": "time", "reminder": "time", "live": "time", "complete": "time" },
    "weekly": [{ "n": 1, "at": "time", "views": "", "clips": "" }],
    "weekly_due": "time",
    "errors": { "<email>": { "at": "time", "reason": "Resend's message" } }
  }
}
```

Admin shows statuses as **Link sent** (`sent` or `opened`), **In progress**
and **Submitted**.

**Old records.** Records made before offers existed have no `offer` and no
`form: 2`. When loaded they're treated as Clipping. One that wasn't submitted
moves onto the new Clipping questions, keeping name, business, email,
WhatsApp, contact method, off-limits and key date. A submitted one keeps its
original answers (question ids `q1` to `q19`) and admin shows it in the old
layout. That logic is `normalize` in `lib/onboarding.js` and `migrateLegacy`
in `lib/forms.js`.

---

## 7. The question config (`lib/questions.js`)

Each question:

| Field | Meaning |
|---|---|
| `id` | Stable id. Answers are stored under it. **Never rename or reuse an id that has answers**; add a new question instead |
| `offer` | `shared`, `clipping`, `coaching` or `consulting` |
| `order` | Position within its group (shared first, then the offer) |
| `section` | Name shown at the top of the form while the question is on screen |
| `label` | The question as the client sees it |
| `help` | Optional line under it |
| `type` | `text`, `email`, `phone`, `url`, `number`, `long`, `country`, `timezone`, `single`, `multi`, `dates`, `links`, `numbers`, `file_or_link`, `text_or_file`, `text_and_link` |
| `required` | `true` or `false` |
| `options` | For `single` and `multi`: `[{ value, label }]` |
| `none` | For `multi`: the value that clears the others ("None yet") |
| `fields` | For `links` and `numbers`: the sub-fields |
| `atLeastOne` | For `links`: at least one must be filled |
| `showIf` | `{ id, equals }`: only shown, and only required, when that answer matches |
| `placeholder` | Hint inside the field |

The same file has `EMAILS.welcome` and `EMAILS.submitted`, one template per
offer. Template rules: `{first_name}`, `{business_name}`, `{campaign}`,
`{offer}` placeholders; a line that is exactly `{button}` becomes the button
(form link in the welcome, booking link in the confirmation);
`{has_booking}` and `{no_booking}` lines appear only with or without a
booking link. With no first name the email says "Hi there" and the subject
drops the name.

To add a question type, update `lib/forms.js` (`cleanOne`, `problemWith`,
`displayAnswer`), the `BUILD`, `check` and `display` functions in
`onboarding/form.html`, and `answerText` in `onboarding/admin.html`. The
client and server checks are deliberately the same; keep them in step.

House rule: **no em dashes in any client-facing text.**

---

## 8. Emails

All sent through Resend from the sender in the admin setup panel (currently
`jacques@maisondelites.com`). The domain `maisondelites.com` is verified in
Resend.

| Email | Offers | When | Code |
|---|---|---|---|
| Welcome (form link) | All | On link creation, if admin gave an email. Resend from the client's page | `lib/sequence.js` + template in `lib/questions.js` |
| Form reminder | All | Cron, 24 hours after the welcome, if not submitted | `lib/sequence.js` |
| Confirmation (booking link) | All | On submit | `notifyClient` in `lib/onboarding.js` + template |
| Onboarding submitted (to team) | All | On submit, to `ONBOARDING_NOTIFY_EMAIL` | `notifyTeamEmail` in `lib/onboarding.js` |
| Discord ping | All | On submit, if `ONBOARDING_DISCORD_WEBHOOK` is set | `notifyTeamDiscord` |
| Campaign live | Clipping | Admin sends; starts the weekly clock | `lib/sequence.js` |
| Weekly check-in | Clipping | Cron alerts the team every 7 days; admin sends | `lib/sequence.js` |
| Campaign complete | Clipping | Admin sends; stops the weekly emails | `lib/sequence.js` |

There are no invoice or payment emails: clients pay before they get the link.

A failed send keeps Resend's own error message: admin shows "… failed to
send" in red with the reason until a send succeeds. The submit notifications
go out once per link (a reopened form doesn't send them again).

---

## 9. Settings

Admin setup panel (top of `/admin`, "Booking links and email sender"), stored
in `onboarding/settings.json`. These win over the Worker variables.

| Setting | Current value |
|---|---|
| Clipping booking link | `https://cal.com/maison-d-elites-tvxf8y/onboarding-call` |
| Coaching booking link | same |
| Consulting booking link | same |
| Email sender | `jacques@maisondelites.com` |

Worker → Settings → Variables and Secrets:

| Name | Type | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | Secret | Admin pages and admin API |
| `RESEND_API_KEY` | Secret | Sending email |
| `ONBOARDING_NOTIFY_EMAIL` | Variable | Team inbox(es), comma-separated (set) |
| `ONBOARDING_DISCORD_WEBHOOK` | Variable | Optional Discord ping (not set) |
| `ONBOARDING_REPLY_TO` | Variable | Optional; where client replies go (falls back to the team inbox) |
| `ONBOARDING_FROM` | Variable | Optional fallback sender |
| `BOOKING_CLIPPING_URL`, `BOOKING_COACHING_URL`, `BOOKING_CONSULTING_URL` | Variable | Optional fallback booking links |
| `ONBOARDING_BASE_URL` | Variable | Optional; defaults to `https://onboarding.maisondelites.com` |
| `RESEND_API_URL` | Variable | Testing only: points email at a local stub. Never set in production |

The red **Setup problems** box in admin checks the key, the sender, the sender
domain and the three booking links. Empty box = configured.

The Cal.com event's location is Google Meet; that's a Cal.com setting, not
code.

---

## 10. Run and test locally

Requirements: Node 18 or newer, and wrangler (`npm i -g wrangler` or use
`npx wrangler`).

1. Create `.dev.vars` in the repo root (never commit it):

   ```
   ADMIN_PASSWORD = "test123"
   RESEND_API_KEY = "re_test"
   RESEND_API_URL = "http://localhost:8790"
   ONBOARDING_FROM = "jacques@maisondelites.com"
   ONBOARDING_NOTIFY_EMAIL = "team@example.com"
   ```

2. Start a stub that records emails instead of sending them (keep this script
   outside the repo):

   ```js
   // stub.js: node stub.js
   const http = require('http'), fs = require('fs');
   http.createServer((req, res) => { let b = ''; req.on('data', d => b += d).on('end', () => {
     res.setHeader('content-type', 'application/json');
     if (req.url === '/domains') return res.end(JSON.stringify({ data: [{ name: 'maisondelites.com', status: 'verified' }] }));
     if (req.url === '/emails') { const j = JSON.parse(b); fs.appendFileSync('emails.jsonl', JSON.stringify({ to: j.to, subject: j.subject, text: j.text }) + '\n'); return res.end('{"id":"x"}'); }
     res.statusCode = 404; res.end('{}');
   }); }).listen(8790);
   ```

3. Run the Worker with a local R2 bucket:

   ```
   npx wrangler dev --port 8787 --persist-to ./.wrangler-test
   ```

4. Open `http://localhost:8787/onboarding/admin` (password `test123`), set
   booking links in the setup panel, create a link per offer, and go through
   `http://localhost:8787/onboarding/<token>` on a phone-sized window.

5. Before deploying, check the config parses: `npx wrangler deploy --dry-run --outdir /tmp/dist`.

Afterwards delete `.dev.vars`, `.wrangler/` and `.wrangler-test/`; none of
them belong in git.

What to test after any change:

- Each offer shows only the shared questions plus its own.
- The song questions (Clipping) appear and are required only with "A song".
- Reloading mid-form resumes on the same question with answers kept.
- An empty required field blocks Continue and Submit with a message under it.
- The booking screen shows the calendar (or the 24-hour line with no link).
- Welcome, confirmation and team emails go out with the right offer's text.
- Admin: list, offer filter, client page grouped Shared then offer, file
  downloads, Copy as text, Save as PDF.
- An old record (no `offer`) still opens and shows as Clipping.

---

## 11. Deploy

- The repo's default branch is **`claude/beautiful-franklin-kl5mvv`** (unusual
  name, but it is the main branch). Cloudflare deploys the Worker
  automatically when something is merged into it, in about 30 seconds.
- Workflow: create a branch, commit, push, open a pull request into
  `claude/beautiful-franklin-kl5mvv`, merge.
- Check it's live: Cloudflare → Workers & Pages → landingpage → Deployments,
  or `GET /onboarding/api/admin/health` with the admin password.
- Settings saved in admin and R2 data survive deploys; nothing to migrate.

---

## 12. Common tasks

**Change a question's wording.** Edit its `label` (or `help`) in
`lib/questions.js`. Keep the `id`.

**Add a question.** Add an object with a new unique `id`, the offer, `order`,
`section`, `label`, `type` and `required`. Bump the `order` of the ones after
it if needed. No other file changes unless it's a new type (section 7).

**Remove a question.** Delete it from `lib/questions.js`. Its old answers stay
in the records but are no longer shown or asked.

**Add an offer.** Add it to `OFFERS`, its questions, and an entry in
`EMAILS.welcome` and `EMAILS.submitted` in `lib/questions.js`; add it to the
`OFFERS` map at the top of the script in `onboarding/admin.html`. Then set its
booking link in the admin setup panel.

**Change an email.** Edit the template in `EMAILS` in `lib/questions.js`
(welcome and confirmation) or the text in `lib/sequence.js` (reminder, live,
weekly, complete).

**Change a booking link or the sender.** Admin → Booking links and email
sender → Save. No deploy needed.

**A client needs to change answers after submitting.** Admin → their page →
Reopen.

**Delete test data.** Admin → Delete on the row (removes the record and its
files).

---

## 13. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Client sees "We'll be in touch within 24 hours" instead of a calendar | No booking link for that offer | Admin setup panel → paste the link → Save |
| No welcome email | Link created without an email | Add the email on the client's page and send the welcome, or send the link on WhatsApp |
| "… failed to send" in red | Resend refused; the reason is shown | Usually sender or domain. Fix in Resend or the setup panel, then resend from the client's page |
| Emails only reach Jacques | Sender is Resend's test address | Set a sender on the verified domain in the setup panel |
| Client: "Link not found" | Link deleted or mistyped | Copy it again from admin |
| Client can't edit after submitting | Expected | Admin → Reopen |
| Download link says expired | Signed links last 15 minutes | Reload the client's page in admin |
| `onboarding.maisondelites.com` shows another site | DNS points elsewhere | It must be a Custom Domain on the `landingpage` Worker |
| 429 Too many requests | Rate limit (300 a minute per IP) | Wait a minute |

---

## 14. Current state (9 November 2026)

- Live and tested end to end on the real site: one test client per offer,
  all emails delivered, test data deleted afterwards.
- Booking for all three offers: the Cal.com "Onboarding call" (Google Meet).
- Existing clients in admin: Rob, Juanita (submitted), Test, Chocolate City
  (in progress) and Dalu, all Clipping. Rob, Dalu and Test were created
  without an email, so no welcome went out; Chocolate City has an email but
  never got a welcome. Juanita submitted on 5 November.
- Discord notifications are not set up.

## 15. Not built yet

- Syncing submissions to GoHighLevel. The submit steps are in `afterSubmit`
  in `lib/onboarding.js`; a sync would be one more step there.
- Marking a call as booked from Cal.com automatically (a Cal.com webhook).
  Today the client's own "booked" event inside the embed sets it.
- Different booking links per offer: all three currently use the same event.
