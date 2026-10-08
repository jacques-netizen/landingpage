# Interactive Guide Funnel: Build Plan

For Claude Code. Read this whole file before writing any code. Work phase by phase (section 12). Do not start a phase until the previous one meets its acceptance criteria.

Kickoff: "Read guide-funnel-build-plan.md. Start with Phase 0, then continue phase by phase. Ask me only when a section 14 input blocks you."

## 1. What we are building

A mobile-first interactive experience that replaces the PDF every lead currently receives after commenting the keyword on an Instagram reel. It plays like a short film with questions in it. By the end the lead has:

1. watched the founder explain how clipping distribution works, with campaign clips and proof from other people,
2. answered 5 to 7 questions that change what they see next,
3. given name and email to receive a personalized guide,
4. received that guide by email within minutes,
5. been offered either a booking calendar (qualified buyers) or the next step for their path (everyone else).

The experience is a hidden video sales letter: the information and persuasion happen inside the film and the questions, not on a sales page.

Success means: more guide requests than the old PDF flow, a higher share of booked calls from qualified leads, and clean data in the CRM about what each lead wants.

## 2. Context

- Company: Maison d'Élites (MDE), a clipping and creator distribution agency. Public site: https://maisondelites.com (hosted on a site builder, do not touch it). This app is separate and lives on a subdomain, default `guide.maisondelites.com` (configurable).
- Traffic source: Instagram reels with a keyword comment ("distribution"). ManyChat handles the comment trigger, the follow ask and the DM. That stays in ManyChat. This app only receives the click, with optional query params (section 8.4).
- Existing tools to integrate: Cal.com (all bookings), GoHighLevel (CRM with pipelines "DM Setting" and "Sales"), ManyChat, Discord (team tracking), Whop (hosts the clipper community), Meta Ads (planned test month).
- Existing pre-call page after a booking: `book.maisondelites.com/booked`.
- The old PDF ("Clipping Secrets") is the content source for the clipper-facing education. Its claims are NOT all reusable. See section 10.
- Public pricing on the site: Starter $3K to $10K, Growth $10K to $50K, Scale custom. Campaigns start from $3K. The guide must not volunteer prices; it only uses budget bands in the questions.

Three audience paths

- clipper: wants to earn by clipping campaigns.
- creator: artist, creator or streamer promoting their own content.
- brand: brand, label, management or talent team buying campaigns.

creator and brand share most questions and the same booking logic. clipper never sees the sales calendar.

## 3. Decisions already made (do not reopen)

1. Separate app on a subdomain, not inside the site builder.
2. Follow gate and comment-to-DM stay in ManyChat.
3. Booking is Cal.com only. No Calendly.
4. CRM is GoHighLevel. Do not add another CRM.
5. The calendar is shown only to qualified creator and brand leads. Clippers get the network join step instead. (Owner to confirm, see section 14.)
6. Personalization in v1 is rule-based from the answers. No live LLM text generation in v1.
7. Everything is signed as Maison d'Élites. No personal names in on-page text, PDF or emails (the founder appears on video only).
8. No em dashes anywhere: copy, emails, PDF, code comments, commit messages.

## 4. Experience spec

Build as a full-screen scene state machine (one scene at a time, 100dvh), not a long scrolling page. Back button on every question scene. State survives refresh (section 7.3).

Scene order

S0 Cold open
- 15 to 30 seconds of muted looping montage of real campaign clips behind a short headline and one Start button.
- If a first name arrives in the URL, greet by name. Otherwise a neutral greeting.
- Tap Start unlocks sound for everything after.

S1 Who are you (Q1)
- Three large tappable options: clipper, creator, brand. Sets the path.

S2 Chapter 1 (founder film, 60 to 90 seconds)
- Founder speaks to camera: what clipping is, why it moves attention, why MDE does it.
- Cutaways to campaign clips. Burned-in captions. Skip is not offered, but a replay is.
- Questions unlock when the video ends or at 85 percent, whichever comes first.

S3 Questions block A (Q2, Q3)
- Asset or content type, then platforms. One question per screen, single tap to advance on single-select.

S4 Chapter 2 (proof)
- A wall of real clips plus other people on camera (client testimonial, creators). Between 45 and 60 seconds.
- Numbers shown only from the approved proof library (section 6.3).

S5 Questions block B (Q4, Q5, plus Q6 and Q7 for creator and brand)

S6 Chapter 3 (how it works, 30 to 45 seconds)
- Animated in code, no filming. Four steps taken from the live site: brief and strategy, clippers activate, review before it counts, pay for counted views. For clippers, the same four steps told from the clipper side (join, pick a campaign, post, get paid for counted views).

S7 Gate
- Headline promises the personalized guide. Fields: first name, email, Instagram handle (optional). Company name appears only if Q7 = yes.
- Consent checkbox (section 8.7). Button copy names the benefit ("Build my guide"), never "Submit".
- No field beyond these.

S8 Building
- 4 to 6 second animation while the server stores the lead, builds the guide and sends the email. If it finishes early, still show at least 3 seconds. If it runs long, keep going and show the result page anyway with the web guide link; the email follows.

S9 Result
- Plain headline naming their plan, for example "Your plan for a music release". No invented framework names or profile labels.
- A 30 to 45 second personal video for their path (one of three).
- The guide preview with the download link.
- Then the path CTA:
  - qualified creator or brand: Cal.com booking embed, prefilled.
  - creator or brand without a qualifying budget: guide only plus a soft next step (reply to the email with a rough budget, or the optional budget number field, section 5).
  - clipper: join the network button (Whop link).
- Confirmation line that the email was sent, with a "check spam" note.

S10 After booking
- Redirect to `book.maisondelites.com/booked` (existing pre-call page).

## 5. Question set

Store all of this in `content/questions.json`. Ids are stable, they become CRM tags and fields.

Q1 role (single)
- clipper: "I want to earn by clipping"
- creator: "I'm a creator or artist"
- brand: "I run or represent a brand, label or talent"

Q2 asset (single)
- creator, brand: music release, podcast or stream, product or launch, sports or gaming content, personal brand, other
- clipper: music, sports, gaming, podcasts and streams, film and TV, anything that pays

Q3 platforms (multi-select)
- TikTok, Instagram Reels, YouTube Shorts, X
- Wording differs: where do you want to be seen (creator, brand) or where do you post (clipper).

Q4 goal (single)
- creator, brand: more views, more streams or listens, more sales or sign-ups, more awareness
- clipper: side income, full-time income, learn editing, grow my own audience

Q5 timing or experience (single)
- creator, brand: ready in the next 2 weeks, this month, next quarter, just exploring
- clipper: new to clipping, some experience, already clipping for pay

Q6 budget band (creator, brand only, single)
- under $3K, $3K to $10K, $10K to $50K, $50K or more, not sure yet
- If "not sure yet": show an optional number field "Roughly how much, in dollars?". A number at or above `BUDGET_QUALIFY_MIN` counts as qualified. No number means not qualified.

Q7 deciding (creator, brand only, single)
- "Are you deciding for a company, label or team?" yes or no.
- Yes sets `human_priority` and shows the company name field at the gate.

Question counts: clipper 5, creator and brand 7.

Qualification rules (config, not hard-coded)
- `qualified` = path is creator or brand AND budget band is $3K or above (or the number field is at or above `BUDGET_QUALIFY_MIN`, default 3000).
- `human_priority` = Q7 is yes OR budget band is $10K or above (or number at or above `BUDGET_PRIORITY_MIN`, default 10000). Mirrors the existing setter hand-off rules: company or label representatives and budgets above $10K go to a human immediately.

## 6. Content and personalization

### 6.1 Rule-based guide assembly

The guide is assembled from content blocks selected by path, asset, platforms and goal. Blocks live as markdown files in `content/guide/` with front matter declaring when they apply. Claude Code drafts all blocks (from the old deck and the live site, section 10 rules), the owner reviews before launch.

Creator and brand guide sections:
1. What clipping does for this asset (short, by asset).
2. How a campaign runs (the four steps).
3. Where to post first (deterministic platform priority from Q3 and Q4).
4. What counts and what does not (review before views count, link to the source post).
5. Proof matched to the asset (section 6.3).
6. Your next step (calendar if qualified, otherwise the soft step).

Clipper guide sections:
1. How clipping pays (per counted view, rates are set per campaign, no income promises).
2. Getting set up (new accounts, what to prepare).
3. What makes a clip travel (strong hook, trending audio, clear ending, editing for emotion, quality and originality).
4. Rules (never impersonate official pages, follow each platform's rules, disclose paid content where required).
5. Picking campaigns in your niche (by Q2).
6. Your next step: join the network.

Length target: 4 to 6 pages. Type-led, editorial layout (section 9).

### 6.2 Result page text

Chosen from `content/results.json` by path and asset. Plain sentence, no labels. Example: "Your plan for a music release". One short paragraph, then the video and CTA.

### 6.3 Proof library

`content/proof.json`. Only facts in this file may appear anywhere in the app, PDF or emails.

Approved (currently on the live site):
- 1B+ views delivered.
- Campaigns delivered for: Walmart, Nintendo, WYDE, Sony, DEF JAM (logos exist on the site).
- Walmart beauty box campaign: 3M total views, $2.30 effective CPM.
- Client testimonial video from Kojo Blak (YouTube https://youtu.be/j4dHabFOMJw, poster on site).
- Jake and Logan Paul case study (the owner must confirm the figures before they are shown).

Available but not yet on the site (owner must confirm before use): Wale and Mannywellz, 2.2M views; Kojo Blak with Fantana, 1.6M views at $1.30 CPM.

Match by asset: music uses the artist cases, product or launch uses Walmart, entertainment and sports uses the Paul case study once confirmed.

## 7. Architecture

### 7.1 Stack (defaults, change only with a reason)

- Next.js (App Router), TypeScript, Tailwind, Framer Motion for scene transitions.
- Postgres (Neon or Supabase) with Drizzle.
- Video: Mux or Cloudflare Stream (HLS, adaptive, posters, captions as WebVTT). Pick one and abstract it behind `lib/video`.
- PDF: render an HTML template to PDF with Playwright (Chromium) in a server job, store in object storage (Cloudflare R2 or Supabase Storage), serve via signed URL.
- Email: Resend, sending domain with SPF, DKIM and DMARC set up.
- Hosting: Vercel. Background work (PDF, email, CRM sync) in a queue or Vercel background functions with retries.
- Bot protection: Cloudflare Turnstile on the gate, rate limits on all POST routes.

### 7.2 Everything content-driven

No copy, question, branch or media id hard-coded in components. All in `content/*.json` and `content/guide/*.md`. Swapping a placeholder video for the real one must be a manifest edit only (`content/media.json` maps logical ids like `chapter1`, `result_clipper` to provider asset ids). Ship with clearly marked placeholder videos so the build is never blocked on filming.

### 7.3 Sessions and resume

- `POST /api/session` on first load creates a session (random token), stores source params, variant assignment and user agent class. Token kept in localStorage (wrapped in try/catch, it can fail in in-app browsers) and mirrored in the URL hash so a refresh resumes.
- Each answer is saved immediately: `POST /api/answer`. No personal data before the gate.
- Resume returns to the last unanswered scene with prior answers intact.

### 7.4 Data model

- `sessions`: id, token, created_at, source (query params), variant, device class, last_scene.
- `answers`: session_id, question_id, value (json), answered_at.
- `leads`: id, session_id, first_name, email, ig_handle, company, consent_text_version, consent_at, qualified, human_priority, path, ghl_contact_id, ghl_opportunity_id, created_at.
- `guides`: lead_id, status, storage_key, generated_at, emailed_at, content_manifest_version.
- `events`: session_id, name, props (json, no email or name), at.

### 7.5 API routes

- `POST /api/session`, `POST /api/answer`, `POST /api/event`
- `POST /api/lead` (validates, Turnstile, stores, enqueues jobs, returns web guide token)
- `GET /api/guide/[token]` (signed, redirects to the PDF)
- `POST /api/webhooks/cal` (Cal.com booking events, verify signature)
- `POST /api/webhooks/manychat` (optional, section 8.4)

Jobs after `/api/lead`, each idempotent with retries: generate PDF, upsert GHL contact and opportunity, send email, fire Meta CAPI, send Discord alert.

## 8. Integrations

### 8.1 GoHighLevel

- Use the GHL API with a private integration token scoped to the single sub-account. Read the pipelines through the API and map by name from config (`GHL_PIPELINE_DM_SETTING`, `GHL_PIPELINE_SALES`, stage names in config). Do not guess ids.
- On lead: upsert contact by email. Set custom fields (create if missing): funnel_path, asset, platforms, goal, timing, budget_band, qualified, human_priority, guide_url, source. Add tags: `guide-lead`, `path-<role>`, `qualified` or `not-qualified`, `human-priority` when set.
- Qualified leads: create an opportunity in the DM Setting pipeline at the first stage. Others: contact only.
- Do not build nurture sequences in code. Email sequences after the guide live in GHL workflows triggered by the tags (separate task, out of scope).

### 8.2 Cal.com

- Embed with `@calcom/embed-react` in S9, prefilled with name and email.
- Add hidden or optional booking fields on the event type for asset, budget band and company, and prefill them. Verify the exact prefill mechanism in current Cal.com docs.
- Webhook `BOOKING_CREATED`: match the lead by email, move the opportunity to the Sales pipeline, add tag `booked-via-guide`, fire Meta `Schedule`, send Discord alert. After booking, redirect to `book.maisondelites.com/booked`.

### 8.3 Email

- Single delivery email, plain and short, HTML plus text version. Guide link (signed, long-lived) rather than an attachment. For qualified leads, one booking link. Unsubscribe link and company footer from config (`EMAIL_FOOTER_LEGAL`). Signature is a config string, default "Maison d'Élites".
- From address in config (`EMAIL_FROM`). Test deliverability to Gmail, Outlook and Hotmail before launch.

### 8.4 ManyChat (link params and optional callback)

- Inbound: the DM link carries optional params: `fn` (first name), `mc` (ManyChat subscriber id), `src` (for example `ig-distribution`). Sanitize and length-limit all of them. Store `mc` and `src` on the session.
- Outbound (phase 6): after the gate, call the ManyChat API to set a tag and custom fields on the subscriber so the DM thread knows the guide was requested. Skip silently if `mc` is missing.
- Document the exact link format for the owner to paste into the ManyChat flow.

### 8.5 Meta Pixel and Conversions API

- Browser pixel loads only after the gate consent is given. Before that, first-party analytics only, without personal data.
- Server-side CAPI events with hashed email: `Lead` on gate submit, `Schedule` on booking. Deduplicate with a shared event id. Include fbp and fbc when present.

### 8.6 Discord

- Webhook message to the team channel for: every qualified lead, every human_priority lead (marked clearly), every booking. Content: path, asset, budget band, company if given, IG handle, GHL contact link. No email address in Discord.

### 8.7 Consent and privacy

- One checkbox at the gate, unticked by default, covering: receiving the guide and follow-up emails, and analytics and ad measurement. Link to the existing Privacy Policy on the site. Store the exact consent text version and timestamp.
- Unsubscribe in every email, honor it in GHL and in the app's own list.
- Wording to be confirmed by the owner.

## 9. Design and motion direction

### 9.1 Phase 0 design capture (required)

The planning environment could not reach maisondelites.com directly, so design tokens were not captured. In Phase 0:

- Load the live site at 390px and 1440px widths, take full screenshots, and extract computed colors, font families and weights, type scale, spacing, button and link styles, border radii, and motion feel.
- Write `DESIGN_TOKENS.md` and the Tailwind theme from it.
- Download and re-host (do not hotlink) the assets the site already uses. Known paths on the live site:
  - logo: `/designed/logo-nav-clear.png`
  - hero and story imagery: `/designed/bh-3.png`, `/designed/story-1-s.png` through `story-4-s.png`, `/designed/concert-s.png`, `/designed/bb-b.png`, `/designed/sky-b.png`
  - client logos: `/designed/logos/walmart.png`, `nintendo-t.png`, `wyde.svg`, `sony.png`, `defjam.png`
  - testimonial poster: `/designed/proof/poster-kojo-blak.png`
  - site-hosted campaign videos under `/files/...` (Walmart campaign, Wale video, other creator clips). Re-host the ones used and note their licenses with the owner.

### 9.2 Look

- Take color, type, logo, imagery and the overall tone from the live site so this feels like the same brand.
- The owner does not want the default AI look. Do not use: rounded grey cards, numbered accent circles, rows of stat boxes, small-caps kicker labels above titles, zebra-striped tables, italic caveat lines, bullets on every screen. Build type-led, editorial, minimal layouts: large type, generous space, full-bleed video and imagery.
- This applies to the PDF as well. It should read like a designed editorial document, not a slide dump.

### 9.3 Motion

- Transitions between scenes feel like cuts and dissolves in a film: fast, with purposeful easing. Questions animate in with the type, not as popups.
- Background video loops are muted, short and compressed. Founder chapters are the only places with sound by default after Start.
- Respect `prefers-reduced-motion`: replace motion with fades.
- Progress indication: default is a thin front-loaded indicator (moves quickly in the first questions, slows later). Controlled by a flag so it can be turned off for testing (section 11).

### 9.4 Mobile and Instagram in-app browser

- Design for 390px first, then scale up. Most traffic arrives inside the Instagram in-app browser.
- Use `100dvh`, handle the browser chrome resize, avoid fixed elements that jump.
- Autoplay only muted and inline (`playsinline`). Sound starts only after a user tap. Always burn in or overlay captions.
- Never depend on cookies or localStorage. Everything must work when they fail.
- Preload the next chapter while the viewer answers questions. Lazy-load later scenes.

### 9.5 Performance and accessibility

- First scene interactive in under 2.5 seconds on a mid-range Android phone over 4G. Poster images for every video. HLS adaptive streaming. Total JS for S0 kept small.
- Keyboard and screen reader basics on all forms: labels, focus order, error messages, contrast. Captions on every video.

## 10. Copy and claims rules

- Plain words. A 13-year-old should follow every sentence. No jargon, no invented framework names.
- No em dashes. No personal names in on-page text, PDF or emails. Client and campaign names are allowed where the live site already uses them.
- Use only claims in the proof library (6.3). Do NOT carry over these statements from the old PDF: "100% campaign success", "official clipping coaches for ClickFunnels", "45k+ editors", "300M+ views", "$2M+ sponsorship", the Dennis Gyamfi case study, "saves up to 90% versus Meta ads". They conflict with current positioning or cannot be verified. The owner may re-approve any of them explicitly.
- No income promises for clippers. Say that rates are set per campaign and pay is for counted views.
- Do not present MDE's distribution as an owned network of a fixed size. Describe it as a network of clippers who choose campaigns.
- Every statement about how campaigns work must match the live site's "How it works" section.

## 11. Tracking and experiments

### 11.1 Events

`scene_view`, `video_play`, `video_progress` (25, 50, 75, 100), `video_pause`, `question_answered`, `back_pressed`, `gate_view`, `gate_error`, `gate_submit`, `build_complete`, `result_view`, `guide_download`, `booking_view`, `booking_created`, `join_click`. Properties never contain email or name.

### 11.2 Funnel dashboard

A simple internal page (password protected) showing, by day, path and variant: starts, Q1 completion, gate views, gate submits, guide emails sent, result views, booking embed views, bookings, drop-off by scene, video watch time per chapter.

### 11.3 Variants

Built into session assignment from day one, with a config split:

- `full`: the experience in section 4.
- `plain`: control. One founder video, then the gate with a role dropdown, then the guide by role and the same booking logic. No questions, no chapters, no animation.
- `progress`: `front_loaded` or `none`, assigned independently.

Default split 50/50 between `full` and `plain` for the first few hundred starts per arm, then the owner decides. Compare gate submit rate and booked calls per qualified lead, not just completion.

## 12. Build phases and acceptance criteria

Phase 0: capture and setup
- Repo, tooling, CI lint and typecheck, env var template (`.env.example` with every variable in section 13).
- Design capture (9.1): `DESIGN_TOKENS.md`, Tailwind theme, re-hosted assets.
- Done when: screenshots of the live site sit in `/docs/reference`, tokens file exists, one test page renders in the site's type and colors.

Phase 1: experience shell
- Scene state machine, all scenes with placeholder videos and real question content, content JSON, resume, back navigation, reduced motion, mobile layout.
- Done when: a tester can complete all three paths on a phone from S0 to a stubbed result, refresh mid-way without losing place, and nothing in components contains hard-coded copy.

Phase 2: backend, CRM and email
- Database, session and answer routes, gate with Turnstile and consent, `/api/lead`, GHL upsert with fields, tags and opportunity, delivery email (with a placeholder guide link).
- Done when: submitting the gate creates a contact in the GHL sub-account with correct fields and tags, a qualified lead creates an opportunity in the right pipeline, and an email arrives in Gmail, Outlook and Hotmail inboxes (not spam) within one minute.

Phase 3: personalized guide
- Content blocks, selection logic, HTML to PDF render, storage, signed links, result page preview.
- Done when: six different answer combinations produce six visibly different PDFs, each 4 to 6 pages, no em dashes, only proof-library facts, and the signed link works from the email and from the result page.

Phase 4: booking and routing
- Cal.com embed with prefill, qualification and human_priority logic, clipper join path, webhook, pipeline move, post-booking redirect.
- Done when: a test booking from a qualified lead moves the opportunity to Sales, tags the contact, and lands the person on the pre-call page; a clipper never sees the calendar; a not-qualified creator sees no calendar.

Phase 5: tracking, ads and experiments
- Events, dashboard, Meta pixel after consent, CAPI with dedupe, variant assignment, plain control, progress flag.
- Done when: every event in 11.1 appears in the dashboard from a real run, Meta Events Manager shows deduplicated `Lead` and `Schedule`, and the plain variant works end to end.

Phase 6: ManyChat and alerts
- Query param intake (`fn`, `mc`, `src`), outbound tag and field update, Discord alerts, human_priority alert formatting.
- Done when: clicking a link with params greets by name and stores the source, ManyChat shows the tag after a test submission, and Discord receives the three alert types without any email address in them.

Phase 7: polish and launch
- Real videos swapped in, copy review by owner, performance pass, QA checklist, rollback switch (`FUNNEL_ENABLED` flag that redirects to the old PDF).
- Done when: section 13 checklist is complete and the owner approves the guide copy.

## 13. QA, launch checklist and config

Environment variables

`SITE_URL`, `DATABASE_URL`, `GHL_API_TOKEN`, `GHL_LOCATION_ID`, `GHL_PIPELINE_DM_SETTING`, `GHL_PIPELINE_SALES`, `GHL_STAGE_MAP` (json), `CAL_BOOKING_URL`, `CAL_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FOOTER_LEGAL`, `EMAIL_SIGNATURE`, `VIDEO_PROVIDER` and its keys, `STORAGE_*`, `META_PIXEL_ID`, `META_CAPI_TOKEN`, `DISCORD_WEBHOOK_URL`, `MANYCHAT_API_TOKEN`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `WHOP_JOIN_URL`, `BUDGET_QUALIFY_MIN` (3000), `BUDGET_PRIORITY_MIN` (10000), `VARIANT_SPLIT`, `FUNNEL_ENABLED`, `OLD_GUIDE_URL`.

QA

- Instagram in-app browser on iOS and Android, Safari iOS, Chrome Android, desktop Chrome and Safari.
- Video: autoplay muted works, sound after tap, captions visible, no layout jump on load.
- All three paths, all branches, back and refresh at every scene.
- Gate errors: bad email, bot check failure, double submit, network drop (the lead must not be created twice).
- GHL: contact fields, tags, opportunity, no duplicates when the same email submits twice.
- Email: Gmail, Outlook, Hotmail, spam check, links work, unsubscribe works.
- PDF: opens on phone, no clipped text, fonts embedded.
- Cal.com: prefill works, webhook verified with the signing secret, rejected without it.
- Events appear in the dashboard and in Meta Events Manager.
- Lighthouse performance on S0 on a throttled mobile profile.
- Search for em dashes across the repo and the generated PDFs.

## 14. Inputs needed from the owner

Blocking for launch (not for building):

1. Confirm the routing decision: clippers do not get the calendar, they get the Whop join link. Provide the join URL.
2. Real founder videos (appendix A). Placeholders are used until then.
3. Approval of the guide copy once drafted.
4. Confirmation of the Jake and Logan Paul figures and which of the "available" proof items may be used.
5. Consent wording and company footer details for emails.

Needed during build:

6. GHL pipeline and stage names (Claude Code reads them via the API, the owner confirms the mapping).
7. Access: Cal.com event type and webhook secret, Resend domain, Mux or Cloudflare Stream account, Meta Pixel and CAPI token, Discord webhook, ManyChat API token.
8. Permission to re-host site-hosted campaign videos in this app.

## 15. Out of scope for v1

Live LLM-written plan paragraphs, AI avatar video, multiple languages, user accounts, payments, nurture email sequences (GHL owns those), changes to the public website, changes to the ManyChat follow gate.

## Appendix A: video shot list

All vertical 9:16, 1080 x 1920, H.264 mp4, under 60 MB each before upload, with a separate .vtt caption file. Founder segments filmed to camera in good light with clean audio.

- V0 Cold open: montage of campaign clips, no speaking, 15 to 30 seconds, loopable.
- V1 Chapter 1 (founder): what clipping is, why it moves attention, why MDE, 60 to 90 seconds.
- V2 Chapter 2 (proof): campaign clips, testimonial cutaways, other people talking about it, 45 to 60 seconds.
- V3 Chapter 3: built in code, no filming.
- V4a Result for clipper: what to do next, 30 to 45 seconds.
- V4b Result for creator: 30 to 45 seconds.
- V4c Result for brand: 30 to 45 seconds.
- Plain variant: reuse V1 as the single founder video.

Total filming for the owner: one session producing V1 and V4a to V4c as separate takes, plus edited cutaways for V0 and V2 from existing campaign footage.
