# QA and launch checklist

Status as of the build. "Done" means checked in this repo (automated test,
headless browser run or local run). "Needs" means it needs a real device,
real accounts or the owner.

## Automated

| Check | How | Status |
|---|---|---|
| Lint, typecheck | `npm run lint`, `npm run typecheck` (CI) | Done |
| Flow, qualification, answer validation | `tests/flow.test.ts` | Done |
| Content rules: no em dashes, retired claims, unapproved figures | `tests/content.test.ts`, `npm run check:dashes` | Done |
| CRM fields and tags, email, signed links, Cal signature, Discord has no email | `tests/server.test.ts` | Done |
| Six guide PDFs: 6 to 12 pages (owner asked for a fuller guide than the plan's 4 to 6), no em dashes, approved figures only, no blank pages | `npm run guides:sample` | Done (7 to 9 pages) |
| All three paths, plain arm, refresh mid way, gate errors | `node tests/e2e/walk.mjs <url> <clipper/creator/brand/lowbuyer> [--refresh] [--plain]` | Done (headless Chromium) |

## Devices and browsers

| Check | Status |
|---|---|
| Instagram in-app browser, iOS | Needs real device |
| Instagram in-app browser, Android | Needs real device |
| Safari iOS, Chrome Android, desktop Chrome and Safari | Needs real devices |
| Muted autoplay on the cold open, sound after the Start tap, captions visible | Needs real devices (headless Chromium cannot decode H.264) |
| No layout jump on load | Done (CLS 0 in Lighthouse) |
| Back and refresh at every scene | Done for the main scenes in the e2e walk; repeat by hand on a phone |
| Works with storage blocked | Built to (storage calls are guarded, token also in the URL hash); check in the IG browser |

## Gate

| Check | Status |
|---|---|
| Bad email, missing fields, consent unticked | Done (inline errors, focus moves to the first error) |
| Bot check failure | Needs Turnstile keys |
| Double submit, network drop | Done by design: one lead per session (unique index), resubmit returns the same lead |

## Integrations (need accounts, see SETUP.md)

| Check | Status |
|---|---|
| GHL contact with fields and tags | Needs `GHL_API_TOKEN` |
| GHL opportunity in DM Setting, New Lead for qualified leads | Needs `GHL_API_TOKEN` |
| No duplicate contact when the same email submits twice | Upsert by email; confirm with the token |
| Email arrives in Gmail, Outlook, Hotmail inboxes within a minute | Needs Resend and DNS |
| Unsubscribe link works and is honored in GHL | Done locally (app list); GHL part needs the token |
| PDF opens on a phone, fonts embedded, no clipped text | Fonts embedded (checked with pdffonts); open on a phone |
| Cal.com prefill works | Done with a public demo event; repeat on the real event type with the hidden fields |
| Cal.com webhook verified with the secret, rejected without | Done (401 without or with a wrong signature) |
| Booking moves the opportunity to Sales, tags the contact, lands on the pre-call page | Needs GHL token and the real event type |
| Events in the dashboard | Done |
| Meta Events Manager shows deduplicated Lead and Schedule | Needs pixel id and CAPI token |
| ManyChat tag after a test submission | Needs ManyChat token |
| Discord receives the three alert types | Needs the webhook URL (message format tested) |

## Performance (Lighthouse, mobile, slow 4G simulated, production build)

| Arm | Performance | LCP | TTI | CLS |
|---|---|---|---|---|
| full | 93 | 3.3 s (2.1 s with DevTools throttling) | 3.3 s | 0 |
| plain | 87 | 3.7 s | 3.7 s | 0 |

Accessibility score 100. Lighthouse's slow 4G profile (1.6 Mbps, 4x CPU
slowdown) is harsher than a typical 4G connection; the remaining time is
mostly the React and Next.js runtime. Confirm the 2.5 second target on a real
mid range Android phone over 4G before launch.

## Content (owner)

| Check | Status |
|---|---|
| Guide copy approved (see `docs/guide-samples/` and `content/guide/`) | Needs owner |
| Consent wording and email footer | Needs owner |
| Case study figures | Approved by the owner; taken from the live site case studies |
| Clipper routing | Confirmed: join link to app.maisondelites.com, no calendar |
| Plain arm | Confirmed: creators and brands get the calendar (budget is asked in the Cal.com form) |
| Real films swapped in (`content/media.json`) | Needs films |
| Re-hosting rights for the site campaign clips used in the placeholders | Approved by the owner |
| Search for em dashes in repo and generated PDFs | Done |
