# 01 Product

## 1. Summary

Clients pay for views. Creators earn by getting views on posts they publish on their own accounts. The platform checks each post, counts its views on a schedule, and pays creators from the client's funded budget at a fixed rate per 1,000 views.

Version one is run by MDE staff. Staff create campaigns, review posts and release payouts. Clients see a read-only report. Creators use the full creator app.

## 2. Users and roles

| Role | Who | Can do in version one |
| --- | --- | --- |
| Visitor | Anyone | Browse public campaigns, read rules and fees, read help, sign up |
| Creator | Signed-in person, 18 or older | Link accounts, join campaigns, submit posts, see earnings, withdraw, appeal |
| Staff: reviewer | MDE team | Review posts, give reasons, handle appeals, warn creators |
| Staff: finance | MDE team | Everything a reviewer does, plus funding, ledger, adjustments, payout batches |
| Staff: admin | MDE owner | Everything, plus settings, roles, terms versions, reason codes |
| Client | Company buying views | Opens a read-only report from a private link. No login in version one |

Staff roles are set by an admin. A person can be a creator and staff with the same login.

## 3. Words used in this product

- Campaign: one funded job with a budget, a rate, rules and a time window.
- Rate: dollars paid per 1,000 counted views. Stored as cents per 1,000 views.
- Budget: the money the client funded for the campaign. Creators are paid from it and it can never be overspent.
- Post: one video a creator published on their own account.
- Submission: a post a creator has sent to a campaign by pasting its link.
- Linked account: a creator's social account that has been verified as theirs.
- Counted views: views on an approved post that count toward earnings (defined in `02_DATA_AND_MONEY.md`).
- Pending: earned but not yet released to the creator's balance.
- Available: released and ready to withdraw.
- Terms version: a saved copy of the campaign rules. Each submission is paid under the terms version in force when it was submitted.

## 4. Scope of version one

In scope:
- Public site: home, campaign browse, campaign page, how it works, for clients, fees, help, legal pages, sign in and sign up
- Creator app: overview, campaigns, my campaigns, submissions, accounts, wallet, withdraw, appeals, notifications, settings
- Client report link
- Staff admin: dashboard, campaign builder and monitor, review queue, creators, appeals inbox, ledger, client funding, payout batches, clients, settings, audit log
- Email notifications and in-app notifications
- Account linking by bio code for every platform, and by OAuth for platforms where access is approved
- View tracking on a schedule with every snapshot stored
- Withdrawals to bank or PayPal through payout partners

Out of scope for version one (list is in `04_BUILD_PLAN.md` under "Later"):
- Client login and self-serve campaign creation
- Card payment by clients through a checkout page (staff record funding by invoice or bank transfer first)
- Mobile apps
- Public submit API
- Referrals, ranks, levels and public leaderboards
- Paid-ad licensing of creator posts
- Crypto payouts
- Dark mode

## 5. User journeys

### 5.1 Creator

1. Finds a campaign on the public list, reads every rule on its page, and decides to join.
2. Signs up with email, Google or Discord and confirms they are 18 or older.
3. Links an account. For TikTok, Instagram or YouTube, uses official login when available. Otherwise places a short code in their profile bio and presses Verify.
4. Opens a campaign and presses Join. Private campaigns ask for an access code.
5. Posts the video on their own account, copies the link, and pastes it into Submit. Automatic checks run at once and the creator sees the result with a reason if anything fails.
6. Watches the submission move through its states. Counted views and pending earnings update after each view check.
7. When the campaign closes and the review window ends, earnings become available.
8. Sets up a payout method, completes the identity check once, and withdraws. The fee and total are shown before confirming.
9. If a post is rejected or removed, opens an appeal from that submission.

### 5.2 Client

1. Agrees a campaign with MDE and pays the budget by invoice or bank transfer.
2. Receives a private report link.
3. Opens it to see spend, views, posts, effective cost per 1,000 views, and a list of posts with links. Downloads a CSV.

### 5.3 Staff

1. Creates the campaign from a template, or copies last month's campaign for a standing client. Records the client's funding. The campaign goes live only when fully funded.
2. Works the review queue: approves or rejects posts with a reason from a fixed list. Looks at flagged posts first.
3. Watches the campaign monitor: budget used, posts by state, flags.
4. Answers appeals within the deadline.
5. Closes campaigns, releases earnings after the review window, and sends payout batches.

## 6. Campaign model

### 6.1 Fields

| Field | Notes |
| --- | --- |
| title | Required |
| type | `clipping`, `logo`, `music`, `ugc` |
| client | Required |
| cover image | Poster used on cards |
| brief | Rich text. Plain description of the job |
| assets | Files and links creators may use (footage, logo, audio) |
| example posts | Optional links |
| platforms | Any of TikTok, Instagram, YouTube, X |
| budget_cents | Total funded amount available to creators |
| rate_cents_per_1000 | Whole cents per 1,000 counted views |
| cap_per_post_cents | Maximum a single post can earn |
| cap_per_creator_cents | Maximum one creator can earn in this campaign |
| min_views_to_earn | Posts below this earn nothing until they pass it |
| min_engagement_bps | Minimum engagement rate in basis points (100 bps = 1%). Optional |
| max_posts_per_account | Per linked account. Optional |
| min_followers | Optional |
| min_account_age_days | Optional |
| languages | Optional list |
| allowed_regions / blocked_regions | Optional, used only where audience data is available |
| required_hashtags | Optional |
| require_ad_disclosure | Boolean |
| min_duration_seconds | Optional |
| keep_live_days | Days a post must stay public after the campaign closes (default 30) |
| visibility | `public` or `private`. Private needs an access code |
| access_code | For private campaigns |
| start_at | When submissions open |
| end_at | Optional. If empty, the campaign runs until the budget is used |
| status | `draft`, `awaiting_funding`, `live`, `closing`, `closed`, `cancelled` |
| terms_version_id | Points to the saved rules text |
| series_id | Optional. Links monthly campaigns of one standing client |

### 6.2 Templates

A template pre-fills the rule fields and adds type-specific checks. Staff can change any field after choosing it.

- clipping: footage provided by the client. Checks: required hashtags, minimum duration, no re-uploads of the same clip by the same creator.
- logo: the creator places the client's logo on their own content. Fields: logo file, safe zone image, minimum seconds visible, maximum cover by the app interface. Check is manual review with a checklist.
- music: the creator uses the client's sound. Fields: audio link, minimum audio level, minimum duration, no stacking with another sound campaign. Check is manual review with a checklist.
- ugc: original content on a brief. Check is manual review.

### 6.3 Rules every campaign page must show before a creator joins

Rate, budget, dollars paid, dollars left, platforms, every cap, minimum views, engagement rule, account rules, content rules, how long the post must stay up, the date window, and the terms version date. No rule is hidden until after joining.

## 7. Submission lifecycle

Internal states, and the label the creator sees.

| Internal state | Creator label | Meaning |
| --- | --- | --- |
| `checking` | Checking | Automatic checks are running |
| `rejected_auto` | Rejected | An automatic check failed. A reason code is shown |
| `needs_review` | In review | Waiting for a reviewer |
| `needs_info` | Needs info | Reviewer asked the creator for something |
| `approved` | Approved | Passed review. Views are being counted |
| `earning` | Earning | Approved and has counted views above the minimum |
| `flagged` | In review | A fraud flag paused earnings for a check |
| `final` | Final | Campaign closed and the review window is running |
| `paid_out` | Paid out | Earnings were released to the creator |
| `rejected` | Rejected | Reviewer rejected it. A reason code is shown |
| `removed` | Removed | The post was deleted, made private, or edited against the rules |
| `appealed` | Appeal open | The creator appealed the decision |

Rules:
- Every rejection and removal stores a reason code and an optional note.
- A creator can appeal a `rejected`, `rejected_auto` or `removed` submission once.
- A reviewer can reverse any decision. A reversal is logged.

## 8. Screens

Every screen listed needs the four states: loading, empty, error and success.

### 8.1 Public site

| Screen | Contents and behaviour |
| --- | --- |
| Home | Hero with serif headline, two buttons, floating frosted cards and a row of live campaigns. Real counts only. Link to fees |
| Campaigns | Search, filters (type, platform), sort (newest, highest rate, most budget left). Card grid. Active section, then Closed section |
| Campaign page | Cover, title, status, rate, budget, dollars paid and left, platforms, every rule, assets list, recent submissions (names masked if the creator chose private), join button |
| How it works | Five short steps from sign-up to payout, with the review and appeal steps included |
| For clients | What clients get, how a campaign runs, a booking or enquiry form that sends an email to staff |
| Fees | Plain table of every fee a creator or client can pay. Same numbers that the settings hold |
| Help | Questions and answers. Search. Link to contact |
| Legal | Terms of use, privacy policy, campaign rules, cookie notice. Text comes from the lawyer; keep versions |
| Sign in and sign up | Email magic link or password, Google, Discord. Age confirmation and terms checkbox on sign up |

### 8.2 Creator app

| Screen | Contents and behaviour |
| --- | --- |
| Overview | Large available balance, pending beneath, Withdraw button. List of recent activity. Active campaigns the creator joined. Prompt to link an account if none |
| Campaigns | Same list as public, with a Joined tag. Filters |
| Campaign page | Public content plus Join or Submit. Submit opens a form: pick linked account, paste link, optional note. Shows live check results |
| My campaigns | Campaigns joined, with posts, counted views and earnings per campaign. Filters: active, closed |
| Submissions | Table of every post: campaign, link, state, reason if any, total views, counted views, earnings, submitted date. Filters by state. Row opens a detail drawer with a view chart and the decision history |
| Accounts | Linked accounts with platform, handle, status, followers, last checked. Add account flow with OAuth or bio code. Remove |
| Wallet | Available, pending, paid out. Tabs: Transactions, Withdrawals. Withdraw flow with method choice, amount, fee and total shown before confirming |
| Payout settings | Chosen method, identity check status, tax information status |
| Appeals | List of the creator's appeals with status and the staff reply |
| Notifications | List with read state. Preferences live in Settings |
| Settings | Profile (display name, avatar), private profile toggle, login methods, notification preferences |

### 8.3 Client report (private link, no login)

Spend against budget in dollars, total views, posts approved, effective cost per 1,000 views, a chart of views over time, a list of posts with links, and a CSV download. Link can be revoked by staff. No creator payout details or personal data are shown.

### 8.4 Staff admin

| Screen | Contents and behaviour |
| --- | --- |
| Dashboard | Posts waiting for review, appeals near deadline, campaigns near budget end, payouts waiting. Simple lists, no chart wall |
| Campaigns | List with status, budget used, posts waiting. Create, copy, edit, close, cancel |
| Campaign builder | Template picker, all fields from 6.1, funding status, live preview of the creator page. Cannot go live until funded |
| Campaign monitor | Budget gauge in dollars, posts by state, flagged posts, top creators, closing controls |
| Review queue | Posts waiting, oldest first, with filters (campaign, flagged, platform). Keyboard shortcuts for next, approve, reject. Bulk approve for posts with no flags |
| Post detail | Embedded post link, the creator and account, check results, view history chart, previous decisions, reason picker, note, approve or reject |
| Creators | Search and list. Detail shows accounts, submissions, earnings, warnings, payout status, notes. Warn, suspend, restore |
| Appeals | Inbox sorted by deadline. Detail shows the original decision and evidence. Uphold or overturn with a reply |
| Ledger | Account balances, transaction list, filter by campaign or creator, export. Manual adjustment form that needs a reason |
| Clients and funding | Client list, wallets, record funding, create report links, revoke links |
| Payout batches | Withdrawals waiting, build a batch, send, track status, retry failures |
| Settings | Fees, minimums, review window, reason codes, fraud thresholds, templates, terms versions, staff roles |
| Audit log | Who did what and when, with before and after values. Read only |

## 9. Measures to track from day one

- Median time from submission to decision
- Share of submissions rejected, by reason code
- Share of rejections that are overturned on appeal
- Median days from campaign close to creator payout
- Withdrawals failed, by method
- Support requests per 100 creators

These go on the staff dashboard as plain lists, not as a chart wall.
