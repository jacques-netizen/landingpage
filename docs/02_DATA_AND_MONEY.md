# 02 Data and money

## 1. Conventions

- Database: PostgreSQL. IDs are UUIDs (`uuid` default `gen_random_uuid()`).
- Every table has `created_at` and `updated_at` (timestamptz, UTC).
- Money is `bigint` whole cents in USD. Column names end in `_cents`. No floats for money anywhere, including in code.
- Rates are `integer` cents per 1,000 views (`rate_cents_per_1000`).
- Percentages are `integer` basis points (`_bps`). 100 bps = 1%.
- Soft delete only where stated. Money rows are never deleted or edited. Corrections are new rows.
- Enums are Postgres enums or check constraints. The values below are the allowed values.
- Anything a staff member does that changes data writes an `audit_log` row in the same database transaction.

## 2. Tables

### Identity

```sql
users (
  id uuid pk,
  email citext unique not null,
  display_name text,
  avatar_url text,
  is_private_profile boolean default false,
  is_adult_confirmed boolean not null default false,
  status text check (status in ('active','suspended','closed')) default 'active',
  created_at, updated_at
)

staff_roles (
  user_id uuid references users,
  role text check (role in ('reviewer','finance','admin')),
  primary key (user_id, role)
)

auth_identities (          -- one row per way of signing in
  id uuid pk,
  user_id uuid references users,
  provider text check (provider in ('email','google','discord')),
  provider_user_id text,
  unique (provider, provider_user_id)
)

creator_profiles (
  user_id uuid pk references users,
  payout_status text check (payout_status in ('none','pending','verified','restricted')) default 'none',
  payout_provider text,           -- 'stripe_connect' | 'paypal'
  payout_provider_ref text,
  tax_status text default 'not_collected',
  strikes_active integer default 0
)
```

### Accounts and clients

```sql
linked_accounts (
  id uuid pk,
  creator_id uuid references users,
  platform text check (platform in ('tiktok','instagram','youtube','x')),
  platform_user_id text,          -- stable id from the platform
  handle text not null,
  link_method text check (link_method in ('oauth','bio_code')),
  verified_at timestamptz,
  verification_code text,         -- for bio_code
  verification_expires_at timestamptz,
  followers integer,
  account_created_at timestamptz,
  token_ciphertext bytea,         -- OAuth tokens, encrypted. null for bio_code
  status text check (status in ('pending','verified','failed','removed')) default 'pending',
  last_checked_at timestamptz,
  unique (platform, platform_user_id)   -- one account belongs to one creator
)

clients (
  id uuid pk,
  name text not null,
  contact_name text,
  contact_email text,
  service_fee_bps integer not null default 0,   -- MDE fee on top of budget, per client
  notes text
)

client_report_links (
  id uuid pk,
  client_id uuid references clients,
  campaign_id uuid references campaigns,   -- null means all of the client's campaigns
  token_hash text unique not null,         -- store a hash, show the token once
  revoked_at timestamptz
)
```

### Campaigns

```sql
terms_versions (
  id uuid pk,
  campaign_id uuid references campaigns,
  body_markdown text not null,
  effective_at timestamptz not null
)

campaigns (
  id uuid pk,
  client_id uuid references clients,
  series_id uuid,                         -- groups monthly campaigns of one client
  type text check (type in ('clipping','logo','music','ugc')),
  title text not null,
  cover_image_url text,
  brief_markdown text,
  assets jsonb default '[]',              -- [{label,url}]
  example_posts jsonb default '[]',
  platforms text[] not null,
  budget_cents bigint not null check (budget_cents > 0),
  rate_cents_per_1000 integer not null check (rate_cents_per_1000 > 0),
  cap_per_post_cents bigint,
  cap_per_creator_cents bigint,
  min_views_to_earn integer default 0,
  min_engagement_bps integer,
  max_posts_per_account integer,
  min_followers integer,
  min_account_age_days integer,
  languages text[],
  allowed_regions text[],
  blocked_regions text[],
  required_hashtags text[],
  require_ad_disclosure boolean default true,
  min_duration_seconds integer,
  keep_live_days integer default 30,
  visibility text check (visibility in ('public','private')) default 'public',
  access_code text,
  start_at timestamptz,
  end_at timestamptz,
  status text check (status in ('draft','awaiting_funding','live','closing','closed','cancelled')) default 'draft',
  closed_at timestamptz,
  release_at timestamptz,                 -- when pending earnings may move to available
  current_terms_version_id uuid references terms_versions
)

campaign_members (
  campaign_id uuid references campaigns,
  creator_id uuid references users,
  joined_at timestamptz,
  primary key (campaign_id, creator_id)
)
```

### Submissions and views

```sql
submissions (
  id uuid pk,
  campaign_id uuid references campaigns,
  creator_id uuid references users,
  linked_account_id uuid references linked_accounts,
  platform text,
  post_url text not null,
  platform_post_id text not null,
  state text check (state in ('checking','rejected_auto','needs_review','needs_info','approved','earning','flagged','final','paid_out','rejected','removed','appealed')),
  reason_code text,
  reason_note text,
  terms_version_id uuid references terms_versions not null,   -- locked at submit time
  rate_cents_per_1000_locked integer not null,                -- locked at submit time
  published_at timestamptz,
  submitted_at timestamptz not null,
  baseline_views bigint default 0,        -- views at submission; never counted
  latest_views bigint default 0,
  counted_views bigint default 0,
  earned_cents bigint default 0,          -- what has been moved into pending for this post
  media_hash text,                        -- perceptual hash for duplicate checks
  unique (campaign_id, platform, platform_post_id)
)

view_snapshots (
  id bigserial pk,
  submission_id uuid references submissions,
  taken_at timestamptz not null,
  views bigint, likes bigint, comments bigint, shares bigint, saves bigint,
  is_public boolean,
  source text,                            -- 'youtube_api','instagram_api','tiktok_api','provider:<name>'
  raw jsonb
)
create index on view_snapshots (submission_id, taken_at desc);

review_decisions (
  id uuid pk,
  submission_id uuid references submissions,
  reviewer_id uuid references users,      -- null for automatic checks
  outcome text check (outcome in ('approve','reject','request_info','reverse','remove')),
  reason_code text,
  note text,
  created_at
)

fraud_flags (
  id uuid pk,
  submission_id uuid references submissions,
  kind text,                              -- see 03_SYSTEMS.md
  detail jsonb,
  status text check (status in ('open','cleared','confirmed')) default 'open',
  created_at, resolved_at, resolved_by uuid
)

appeals (
  id uuid pk,
  submission_id uuid unique references submissions,   -- one appeal per submission
  creator_id uuid references users,
  message text not null,
  status text check (status in ('open','upheld','overturned')) default 'open',
  reply text,
  reviewer_id uuid references users,
  due_at timestamptz not null,
  created_at, resolved_at
)

warnings (
  id uuid pk,
  creator_id uuid references users,
  reason_code text, note text,
  expires_at timestamptz,
  created_by uuid references users
)
```

### Money

```sql
ledger_accounts (
  id uuid pk,
  kind text check (kind in (
    'client_funds_holding',   -- money received from clients, not yet in a campaign
    'campaign_budget',        -- one per campaign
    'creator_pending',        -- one per creator
    'creator_available',      -- one per creator
    'payout_in_transit',      -- money sent to the payout partner, not yet confirmed
    'platform_revenue',       -- MDE fees
    'external'                -- the outside world: bank, partner
  )),
  owner_type text,            -- 'client' | 'campaign' | 'creator' | 'platform'
  owner_id uuid,
  unique (kind, owner_type, owner_id)
)

ledger_transactions (
  id uuid pk,
  kind text,                  -- see section 4
  idempotency_key text unique not null,
  campaign_id uuid, submission_id uuid, creator_id uuid, payout_id uuid,
  memo text,
  created_by uuid,            -- null for system jobs
  created_at
)

ledger_entries (
  id bigserial pk,
  transaction_id uuid references ledger_transactions,
  account_id uuid references ledger_accounts,
  amount_cents bigint not null            -- positive = debit to the account, negative = credit
)
-- Constraint enforced by a deferred trigger and by tests: for every transaction_id the entries sum to zero.

withdrawals (
  id uuid pk,
  creator_id uuid references users,
  method text check (method in ('stripe_connect','paypal')),
  amount_cents bigint not null,           -- amount taken from available
  fee_cents bigint not null,
  net_cents bigint not null,              -- amount - fee, what the creator receives
  status text check (status in ('requested','approved','in_batch','sent','paid','failed','cancelled')) default 'requested',
  batch_id uuid,
  partner_reference text,
  failure_reason text,
  created_at, updated_at
)

payout_batches (
  id uuid pk, created_by uuid, status text, sent_at timestamptz
)
```

### Support tables

```sql
notifications (id uuid pk, user_id uuid, kind text, title text, body text, link text, read_at timestamptz, created_at)
settings (key text pk, value jsonb, updated_by uuid, updated_at)
reason_codes (code text pk, label text, applies_to text[], creator_message text)
audit_log (id bigserial pk, actor_id uuid, action text, entity text, entity_id uuid, before jsonb, after jsonb, created_at)
api_keys (id uuid pk, user_id uuid, key_hash text, label text, last_used_at timestamptz, revoked_at timestamptz)   -- used in the later public API
```

## 3. Ledger design

Every money movement is a `ledger_transactions` row with two or more `ledger_entries` that sum to zero. Balances are always computed from entries. Do not store a balance column that can drift. A cached balance may exist as a view or materialised view that is rebuilt from entries.

Accounts: one `external` account, one `client_funds_holding` per client, one `campaign_budget` per campaign, one `creator_pending` and one `creator_available` per creator, one `payout_in_transit` for the platform, one `platform_revenue` for the platform.

Sign rule: an entry with a positive amount adds to that account, a negative amount takes from it. A transaction's entries sum to zero.

## 4. Transaction kinds

| Kind | What it does | Entries |
| --- | --- | --- |
| `client_funding_received` | Client money arrives (recorded by finance) | `external` -X, `client_funds_holding` +X |
| `campaign_funded` | Move budget into the campaign | `client_funds_holding` -B, `campaign_budget` +B |
| `service_fee_taken` | MDE fee on funding | `client_funds_holding` -F, `platform_revenue` +F |
| `earning_accrued` | Views counted, pay a post | `campaign_budget` -E, `creator_pending` +E |
| `earning_reversed` | Post rejected or removed, or views corrected down | `creator_pending` -E, `campaign_budget` +E |
| `earnings_released` | Review window passed | `creator_pending` -E, `creator_available` +E |
| `withdrawal_requested` | Creator asks to withdraw | `creator_available` -A, `payout_in_transit` +A |
| `withdrawal_paid` | Partner confirms. The fee is taken only now, in the same transaction | `payout_in_transit` -A, `external` +Net, `platform_revenue` +Fee (A = Net + Fee) |
| `withdrawal_failed` | Partner failed. No fee is taken | `payout_in_transit` -A, `creator_available` +A |
| `campaign_remainder_returned` | Unused budget goes back at close | `campaign_budget` -R, `client_funds_holding` +R |
| `manual_adjustment` | Finance correction with a memo | Any balanced pair. Needs `created_by` and a reason |

Service fee: when a campaign is funded, `F = round_half_up(B * clients.service_fee_bps / 10000)`. The client pays `B + F`. `client_funding_received` records `B + F`. `campaign_funded` moves `B` and `service_fee_taken` moves `F`.

Idempotency: every transaction needs a deterministic `idempotency_key`, for example `earning:{submission_id}:{counted_views}` or `release:{submission_id}`. A repeated key returns the existing transaction and changes nothing. All money writes happen inside one database transaction with row-level locks on the campaign budget account and on the creator accounts involved.

## 5. Earnings rules

### 5.1 Counted views

```
counted_views = max(0, latest_views - baseline_views)   -- only while the submission is approved or earning
if counted_views < campaign.min_views_to_earn then earnings = 0
```

`baseline_views` is the first successful view check at or after submission. Views before submission never count. If a post is deleted or made private, no new views are counted and the submission moves to `removed` after the grace period in 03 section 3.4.

### 5.2 Earnings for one post

```
raw_cents = floor(counted_views * rate_cents_per_1000_locked / 1000)
post_cents = min(
  raw_cents,
  campaign.cap_per_post_cents          (if set),
  campaign.cap_per_creator_cents - creator_earned_in_campaign_excluding_this_post   (if set),
  campaign_budget_balance + earned_cents_already_for_this_post
)
delta = post_cents - submissions.earned_cents
```

The engine recomputes `post_cents` from the total counted views each time. It does not add up small increments. If `delta > 0`, post `earning_accrued` for `delta`. If `delta < 0` (views were corrected down), post `earning_reversed` for `-delta`. Update `submissions.earned_cents` in the same database transaction.

Use `floor` for the division so no money is created by rounding. Rounding of fees uses half up.

### 5.3 Budget limits

The budget can never go below zero. If the budget is smaller than the sum owed, the posts are served in the order their view checks run, and the campaign moves to `closing` as soon as the budget account balance is 0 or less than the smallest possible new payment. When a campaign is `closing` or `closed`, counted views stop updating earnings except for corrections down.

### 5.4 Closing and release

1. A campaign closes when the budget is used, when `end_at` passes, or when staff close it.
2. At close, `closed_at` is set and `release_at = closed_at + review_window_days`.
3. Unused budget stays in `campaign_budget` until `release_at`, then `campaign_remainder_returned` moves it back to the client's holding account. Staff then refund or credit the client outside the system and record it with a `manual_adjustment`.
4. At `release_at`, for each submission in `final` with no open fraud flag and no open appeal, post `earnings_released` for the submission's `earned_cents` and move it to `paid_out`. Flagged or appealed submissions wait until resolved.
5. The post must stay public for `keep_live_days` after the campaign closes. Checks continue during that time. A removed post after payout creates a staff task and a warning. The system does not claw back money automatically. Staff decide.

### 5.5 Reversals

- A reviewer rejects an approved post: post `earning_reversed` for the full `earned_cents`, set `earned_cents = 0`, state `rejected`.
- An appeal is overturned on a post that was rejected: set state `approved`, reset to `earning`, and let the next view check accrue earnings from `counted_views`.

### 5.6 Rate lock

`rate_cents_per_1000_locked` is copied from the campaign when the submission is created. If staff change a campaign rate later, existing submissions keep their locked rate.

## 6. Withdrawals

```
fee_cents = max(settings.withdrawal_fee_min_cents, round_half_up(amount_cents * settings.withdrawal_fee_bps / 10000))
   -- when settings.withdrawal_fee_bps = 0 and the minimum is 0, fee_cents = 0
net_cents = amount_cents - fee_cents
```

Rules:
- Minimum amount is `settings.withdrawal_min_cents`.
- A creator needs `payout_status = verified` before a withdrawal can be requested.
- The withdraw form shows amount, fee and net before the creator confirms. The same function that calculates the fee in the UI is the one the server uses.
- Requests need finance approval in version one. Approved requests go into a batch. Sending a batch calls the partner API, sets `in_batch` then `sent`, and the partner's webhook sets `paid` or `failed`.
- Webhooks are verified by signature and handled idempotently.
- A creator cannot have two requests in `requested` at the same time.

## 7. Required test cases (write these before the money code)

Use these numbers. All are cents.

Setup A: budget 100,000, rate 200 per 1,000, cap per post 30,000, cap per creator 50,000, min views 1,000.

| # | Case | Expected |
| --- | --- | --- |
| 1 | Post with 800 counted views | earned 0 (below minimum) |
| 2 | Post with 2,500 counted views | raw = floor(2500 * 200 / 1000) = 500, earned 500 |
| 3 | Post with 250,000 counted views | raw 50,000, capped at 30,000 |
| 4 | Same creator, second post with 200,000 counted views after the first earned 30,000 | raw 40,000, cap per post 30,000, cap per creator leaves 20,000, earned 20,000 |
| 5 | Views drop from 10,000 to 9,000 counted | delta is -200, `earning_reversed` 200 |
| 6 | Budget has 5,000 left and a post is owed 8,000 | earned 5,000, campaign moves to `closing` |
| 7 | Same view check runs twice | one transaction only (idempotency) |
| 8 | Reviewer rejects an approved post that had earned 12,000 | creator pending drops by 12,000, budget rises by 12,000 |
| 9 | Rate changed from 200 to 300 after a post was submitted | post still pays at 200 |
| 10 | Client service fee 1,000 bps on budget 100,000 | fee 10,000, client pays 110,000 |
| 11 | Withdrawal 10,000 with fee 500 bps and minimum fee 300 | fee 500, net 9,500 |
| 12 | Withdrawal 3,000 with fee 500 bps and minimum fee 300 | fee 300, net 2,700 |
| 13 | Withdrawal fails after being sent | creator available restored in full |

Property tests that must always hold:
- For every ledger transaction, the entries sum to zero.
- The sum of all ledger entries across all accounts is zero.
- `campaign_budget` for a campaign never goes below zero.
- `creator_available` never goes below zero.
- A creator's pending balance equals the sum of `earned_cents` of their approved or earning submissions that are not yet released.
- Replaying the same set of transactions with the same idempotency keys changes nothing.

## 8. Reports and exports

- Client report: totals and posts for one campaign or all of a client's campaigns. CSV columns: campaign, post URL, platform, creator display name or masked name, submitted date, total views, counted views, earned (dollars), state.
- Staff ledger export: transactions with entries, filterable by date, campaign, creator and kind.
- Payout batch export: one row per withdrawal with partner reference.
