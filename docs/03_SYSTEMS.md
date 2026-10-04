# 03 Systems

## 1. Authentication and roles

- Sign in methods: email (magic link by default, password optional), Google, Discord. Passkeys later.
- Sign up needs a checkbox that the person is 18 or older and a checkbox for the terms and privacy policy. Store `is_adult_confirmed` and the time.
- Sessions use secure, HTTP-only cookies. Rotate on sign in. Expire after 30 days idle.
- Roles are checked on the server for every request. Hiding a button in the interface is never the only protection.
- Staff routes live under `/admin`. Require a staff role. Admin-only actions (settings, roles, terms versions) require `admin`. Money actions require `finance` or `admin`.
- Rate limit sign in, magic link requests and form posts per IP and per account.

## 2. Linking accounts

Platform rules and API access change often. Before building each provider, check the platform's current developer documentation and approval requirements. Treat the notes below as the plan, not as confirmed current rules.

### 2.1 Rules

- Platforms: TikTok, Instagram, YouTube, X.
- A creator may link up to 8 accounts (setting `max_linked_accounts`).
- A platform account (`platform` + `platform_user_id`) belongs to one creator only. Linking an account already linked to someone else fails with a clear message and creates a staff task.
- Accounts must be public. A private account cannot be verified.
- Store followers, account creation date where the platform exposes it, and `last_checked_at`.

### 2.2 Method A: official login (OAuth)

- YouTube: Google OAuth with the read-only YouTube scope. Gives channel id, subscriber count, video stats.
- Instagram: professional accounts only, through Meta's business login flow. Gives account id, followers, media insights.
- TikTok: TikTok Login Kit with the scopes for basic profile and video list and stats. Needs app approval.
- Encrypt tokens at rest with AES-256-GCM. The key comes from an environment secret (later a key service). Never log tokens. Refresh before expiry. If refresh fails, mark the account `failed` and notify the creator.
- Request the smallest scopes that give views.

### 2.3 Method B: bio code

Used for every platform without approved OAuth, and always for X.

1. Creator enters the handle and platform.
2. The server creates a code like `MDE-7K4Q` (prefix from config, 4 characters, no look-alike characters), sets `verification_expires_at` to 7 days.
3. The creator places the code in their public bio and presses Verify.
4. A job fetches the public profile through the view provider (see 3.1) and looks for the code. If found, set `verified_at` and `status = verified`, and remove the need for the code. If not found, show "We could not see the code yet. It can take a few minutes to show. Try again."
5. Ask the creator to remove the code afterwards. Do not require it to stay.
6. Limit verify attempts to 10 per hour per account.

### 2.4 Re-checks

A daily job re-checks each verified account for: still public, handle changed, follower drop of more than 50% in a day (flag), account deleted. Handle changes update the stored handle through `platform_user_id`.

## 3. View tracking

### 3.1 Provider interface

All platform data goes through one interface so providers can be swapped.

```ts
interface ViewProvider {
  name: string
  supports(platform: Platform, linkMethod: 'oauth' | 'bio_code'): boolean
  fetchProfile(input: { platform; handle?; platformUserId?; token? }): Promise<ProfileData>   // handle, followers, bio text, isPublic, createdAt?
  fetchPost(input: { platform; postUrl; platformPostId?; token? }): Promise<PostData>
}

type PostData = {
  exists: boolean
  isPublic: boolean
  views: number | null
  likes: number | null; comments: number | null; shares: number | null; saves: number | null
  publishedAt: Date | null
  durationSeconds: number | null
  caption: string | null
  authorPlatformUserId: string | null
  rawRef: unknown   // anything needed for debugging
}
```

Implementations to build, in this order:
1. `MockProvider` returns scripted data. Used for local development and tests.
2. `YouTubeApiProvider` using the YouTube Data API.
3. `InstagramGraphProvider` for OAuth-linked professional accounts.
4. `TikTokApiProvider` for OAuth-linked accounts once approved.
5. `ThirdPartyDataProvider` a paid data provider for bio-code accounts. The vendor is an open decision. Build behind the interface so the vendor can change.

A router picks the provider by platform and link method and falls back down the list. Every call has a timeout of 15 seconds, retries with backoff up to 3 times, and records failures. Respect each API's rate limits through a shared limiter.

### 3.2 Schedule

Defaults, all editable in settings:

| Age of submission | Check every |
| --- | --- |
| 0 to 72 hours | 2 hours |
| 72 hours to campaign close | 12 hours |
| Campaign close to end of keep-live window | 24 hours |

Public reviews of the existing platforms complain about views that stop updating, so the first 72 hours are checked often. A "last updated" time is shown to creators on every submission.

### 3.3 The view check job

For each due submission:
1. Fetch the post through the provider.
2. Save a row in `view_snapshots` every time, whatever the result.
3. If `exists = false` or `isPublic = false`, start the grace period (3.4). Do not change earnings.
4. If the author id does not match the linked account, flag `wrong_author` and set the submission to `flagged`.
5. If this is the first successful check, set `baseline_views = views` and leave counted views at 0.
6. Update `latest_views`, `counted_views`.
7. Run fraud rules (section 6) on the new snapshot.
8. If the submission is `approved` or `earning`, run the earnings engine from `02_DATA_AND_MONEY.md` and move the state to `earning` if counted views pass the minimum.
9. Schedule the next check by the table in 3.2.

Run jobs in a queue with a concurrency limit. A job must be safe to run twice.

### 3.4 Deleted or private posts

If a post cannot be seen on a check, retry on the next two scheduled checks. If it is still missing or private after 48 hours, move to `removed` with reason `deleted_or_edited_post`, reverse pending earnings through `earning_reversed`, notify the creator, and let them appeal. If the post comes back during an appeal, staff can overturn.

## 4. Automatic checks on submission

Run in this order when a creator submits a link. Stop at the first failure and return its reason code. Show every result to the creator as it runs.

1. The creator has joined the campaign and the campaign is `live` and inside its window.
2. The URL parses as a post on an allowed platform. Extract `platform_post_id`.
3. The post's author is one of the creator's verified linked accounts for that platform.
4. The same post is not already submitted to this campaign (unique key).
5. The creator has not hit `max_posts_per_account` for that account.
6. The post exists and is public, and stats are visible.
7. The post was published after `start_at`, and no more than 24 hours before submission (setting `max_post_age_hours`).
8. The account meets `min_followers` and `min_account_age_days`.
9. Duration is at least `min_duration_seconds`.
10. The caption has every required hashtag and an ad disclosure if `require_ad_disclosure`.
11. Duplicate media check: compute a perceptual hash of the video thumbnail or frames where the provider allows it, and compare with other submissions in the campaign. A close match creates a `duplicate_media` flag, not a rejection.

Outcome: if checks 1 to 10 pass, the state becomes `needs_review`. Bulk-approvable submissions (no flags, creator with a clean history) may be set to auto approve by a setting, off by default. Any failed check sets `rejected_auto` with the reason code.

## 5. Reason codes

Stored in `reason_codes`. The creator message is shown with the rejection. Staff may add a note. Start with these and let admins edit the wording.

| Code | Creator message |
| --- | --- |
| `not_linked_account` | This post is not from one of your verified accounts. |
| `posted_before_start` | This post went up before the campaign opened. |
| `posted_too_early` | Posts must be submitted within 24 hours of publishing. |
| `posted_after_end` | The campaign had already closed. |
| `private_or_hidden_stats` | The post or its stats are not public. |
| `duplicate_post` | This post is already in the campaign. |
| `wrong_platform` | This platform is not allowed in this campaign. |
| `below_min_duration` | The video is shorter than the minimum. |
| `missing_hashtag` | A required hashtag is missing. |
| `missing_disclosure` | The post needs a clear ad disclosure. |
| `missing_logo` | The logo is not visible as the rules require. |
| `missing_audio` | The required sound is not used as the rules require. |
| `account_too_new` | The account is newer than the campaign allows. |
| `account_below_followers` | The account has fewer followers than the campaign requires. |
| `region_mismatch` | The audience is outside the allowed regions. |
| `low_engagement` | Engagement is below the campaign minimum. |
| `suspected_view_inflation` | The views look artificial. |
| `not_original` | The content is not original. |
| `brand_unsafe` | The content breaks the content rules. |
| `deleted_or_edited_post` | The post was removed or changed. |
| `other` | See the note from the reviewer. |

## 6. Fraud flags

A flag pauses a submission (`flagged`) until staff clear or confirm it. A flag never removes money by itself.

| Kind | Rule (all numbers are settings) |
| --- | --- |
| `view_jump` | Views grow more than X times the median of the last N checks in one interval, or more than Y views in one hour for an account under Z followers |
| `engagement_below_floor` | (likes + comments + shares) / views is below the campaign's `min_engagement_bps`, or below 20 bps when none is set, once views pass 10,000 |
| `duplicate_media` | Perceptual hash is a close match to another submission in the campaign |
| `wrong_author` | The post's author id differs from the linked account |
| `shared_payout_account` | Two creators have the same payout partner reference |
| `linked_cluster` | Several creators share the same sign-in IP range and device hash in a short period (store hashes, not raw values) |
| `follower_drop` | Account lost more than 50% of followers in a day |
| `velocity_new_account` | New creator submits more than N posts in the first hour |

Staff see flags on the post detail and the review queue. Resolving a flag needs a note. Confirming a `view_jump` or `duplicate_media` flag rejects the submission with `suspected_view_inflation` or `duplicate_post` and creates a warning.

## 7. Appeals

- The appeal button shows on `rejected`, `rejected_auto` and `removed` submissions. One appeal per submission.
- The creator writes a message (up to 1,000 characters) and may add links.
- `due_at` is set to `created_at + settings.appeal_reply_business_days` (default 5 business days). The staff dashboard shows appeals nearing the deadline in order.
- Staff pick Uphold or Overturn and must write a reply. The creator is notified by email and in the app.
- Overturn restores the submission as described in `02_DATA_AND_MONEY.md` section 5.5 and clears the related strike if there was one.
- An appeal never reverses a ban by itself. Account suspension decisions have their own review by an admin.

## 8. Warnings, strikes and suspension

- Staff can issue a warning with a reason. Warnings count as strikes for 60 days (setting `strike_days`).
- At 3 active strikes, the system suggests suspension to staff. It does not suspend automatically.
- Suspension blocks new submissions and withdrawals. It does not delete pending earnings. Releasing or voiding earnings for a suspended creator is a finance decision with a written reason in the audit log.
- Every warning and suspension needs a reason and is visible to the creator in their notifications with the reason code.

## 9. Notifications

Channels: in-app (always), email (default on), Discord direct message (later).

| Event | Who | Content |
| --- | --- | --- |
| Submission approved | Creator | Post approved and being counted |
| Submission rejected or removed | Creator | The reason message and an Appeal link |
| Needs info | Creator | What staff asked, and a reply box |
| Earnings released | Creator | Amount and the date |
| Withdrawal sent, paid, failed | Creator | Status and reference |
| Appeal reply | Creator | Outcome and reply |
| New campaign matching the creator's platforms | Creator | Link (users can switch this off) |
| Warning issued | Creator | Reason code and message |
| Appeal opened | Staff | Link and deadline |
| Funding recorded, campaign went live, campaign closing | Staff | Link |
| Payout failed | Staff finance | Link |

Send through a provider (Resend or similar). Every email has a plain text version, a one-click way to change preferences, and the legal entity name in the footer. Never put money amounts or reasons in an email subject line.

## 10. API (internal, REST)

Base path `/api/v1`. JSON. Validate every body and query with a schema (Zod). Return `{ error: { code, message } }` on failures. Paginate lists with a cursor.

Creator routes (signed in):
- `GET /campaigns`, `GET /campaigns/:id`
- `POST /campaigns/:id/join`
- `GET /me`, `PATCH /me`
- `GET /accounts`, `POST /accounts` (start link), `POST /accounts/:id/verify`, `DELETE /accounts/:id`
- `GET /oauth/:platform/start`, `GET /oauth/:platform/callback`
- `POST /submissions`, `GET /submissions`, `GET /submissions/:id`
- `GET /wallet`, `GET /wallet/transactions`
- `POST /withdrawals/quote` (returns fee and net), `POST /withdrawals`
- `POST /appeals`, `GET /appeals`
- `GET /notifications`, `POST /notifications/read`

Staff routes (staff role):
- Campaigns: `GET/POST /admin/campaigns`, `GET/PATCH /admin/campaigns/:id`, `POST /admin/campaigns/:id/copy`, `POST /admin/campaigns/:id/close`
- Funding: `POST /admin/clients/:id/funding`, `POST /admin/campaigns/:id/fund`
- Review: `GET /admin/review-queue`, `POST /admin/submissions/:id/decision`
- Flags: `POST /admin/flags/:id/resolve`
- Creators: `GET /admin/creators`, `POST /admin/creators/:id/warn`, `POST /admin/creators/:id/suspend`
- Appeals: `GET /admin/appeals`, `POST /admin/appeals/:id/resolve`
- Money: `GET /admin/ledger`, `POST /admin/adjustments`, `GET/POST /admin/payout-batches`, `POST /admin/payout-batches/:id/send`
- Settings: `GET/PATCH /admin/settings`, `GET/PATCH /admin/reason-codes`, `POST /admin/terms-versions`
- Audit: `GET /admin/audit-log`

Client report: `GET /report/:token` and `GET /report/:token.csv`. The token is stored hashed.

Webhooks in: Stripe (`/webhooks/stripe`), PayPal (`/webhooks/paypal`). Verify signatures, handle events idempotently, and store each event id.

Later, a public submit API with API keys (`POST /api/v1/submissions` with a bearer key), per-key rate limits and a usage count.

## 11. Background jobs

| Job | When | Does |
| --- | --- | --- |
| `view-check` | Per submission by schedule | Section 3.3 |
| `account-recheck` | Daily | Section 2.4 |
| `bio-code-verify` | On demand | Section 2.3 |
| `campaign-lifecycle` | Every 5 minutes | Open campaigns at `start_at`, close at `end_at` or when budget is spent, set `release_at` |
| `release-earnings` | Hourly | Release earnings after `release_at` |
| `appeal-deadlines` | Hourly | Notify staff about appeals nearing `due_at` |
| `strike-expiry` | Daily | Expire old warnings |
| `payout-status` | Every 15 minutes | Poll partners for withdrawal status when webhooks are missed |
| `email-send` | Queue | Send email with retries |
| `ledger-check` | Daily | Run the money property checks from `02_DATA_AND_MONEY.md` section 7 on live data and alert staff if any fail |

Use a queue with retries and dead letter handling (BullMQ on Redis, or a hosted job service). Jobs must be idempotent.

## 12. Payments

- Client funding in version one: staff record it after the client pays by invoice or bank transfer (`client_funding_received`). A card checkout page comes later.
- Creator payouts: Stripe Connect Express (bank accounts, includes identity checks) and PayPal Payouts. Each creator picks one method. The partner's onboarding handles identity and, where supported, tax information.
- Never store card numbers, bank account numbers or ID documents. Store only partner references.
- All partner calls use idempotency keys and are logged.

## 13. Security and privacy

- Encrypt tokens and any partner secrets at rest. Keep secrets in environment variables or a secrets manager, never in the repository.
- Hash client report tokens and API keys. Show them once.
- Validate all uploads (type, size) and serve them from object storage with signed URLs.
- Add standard protections: CSRF protection on forms, secure cookies, Content Security Policy, rate limits and input escaping on all user text (post notes, appeal messages).
- Staff pages need a second factor (setting, on by default for finance and admin).
- Log staff actions to `audit_log`. Audit rows cannot be edited or deleted by the application.
- Privacy: collect the least data needed. Offer a data export and an account deletion request. Money and fraud records are kept for the period the law requires even after deletion. Say so in the privacy policy.
- Creator profile privacy: a private profile hides the avatar and masks the name in any public list.
- Cookie notice and analytics consent as the law requires where the audience is.
- Minimum age 18. Block sign up if the confirmation is not ticked.

## 14. Observability

- Error tracking (Sentry or similar) on server and browser.
- Structured logs with a request id. No tokens or personal data in logs.
- Metrics: view-check success rate by provider, queue depth, job failures, withdrawal failure rate, time to review.
- An alert when the `ledger-check` job fails, when a provider's success rate drops under 90% over an hour, or when the queue backs up.

## 15. Settings keys

All in the `settings` table, editable by admins, each change audited.

`max_linked_accounts` (8), `max_post_age_hours` (24), `view_check_intervals` (see 3.2), `deleted_post_grace_hours` (48), `review_window_days` (7), `withdrawal_min_cents` (2000), `withdrawal_fee_bps` (0), `withdrawal_fee_min_cents` (0), `appeal_reply_business_days` (5), `strike_days` (60), `auto_approve_clean_creators` (false), fraud thresholds from section 6, `bio_code_prefix`, `require_staff_2fa` (true).
