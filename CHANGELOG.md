# Change log

Every change to the platform's code, newest first: what changed, who asked for it, who made it, and the
commit. Built from git by `pnpm changelog` (scripts/changelog.mjs); run it after each commit and commit
this file as "Update the change log". Fix a line by hand if it is wrong; the script keeps edited lines.
Changes staff make to live data (money, decisions, users) are in the admin's Audit log instead.

Who made it: "Claude Code session …xxxxxx" is the Claude Code session that wrote the commit (its full
link is in the commit's Claude-Session trailer); a GitHub name is a person committing directly. Who
asked: the commit's Requested-by trailer, "not recorded" for changes made before 2026-11-09.

## 2026-11-14

- Client report: the campaign picture is always shown whole, never cropped, with a blurred copy filling the frame · Requested by: owner · Made by: Claude Code session …oZc8T8 · 66ffb93
- Client report: phone layout on a phone held sideways, and the page can no longer slide off the screen · Requested by: owner · Made by: Claude Code session …oZc8T8 · b2dff8a

## 2026-11-13

- Security hardening: rate limits on every public endpoint, id and length checks on clipper actions, strict webhook input · Requested by: owner · Made by: Claude Code session …oZc8T8 · 3a28f0b

## 2026-11-12

- Record the music tracking decisions and document the new tables, job and settings · Requested by: owner · Made by: Claude Code session …T7QHqA · 8bd84ca
- Show music results on the client report for campaigns with a tracked song · Requested by: owner · Made by: Claude Code session …T7QHqA · 4f982d7
- Add the Music tab to the campaign workspace: song setup, provider match, typed-in numbers, chart places and data health · Requested by: owner · Made by: Claude Code session …T7QHqA · 6180dc1
- Run the music pull every hour in the worker · Requested by: owner · Made by: Claude Code session …T7QHqA · 073d41a
- Show the sound check on the review cards · Requested by: owner · Made by: Claude Code session …T7QHqA · 2c0af4d
- Read the sound of each TikTok post and check it against the campaign's official sound · Requested by: owner · Made by: Claude Code session …T7QHqA · dec7404
- Add music setup, typed-in numbers, the daily music pull and the music report queries · Requested by: owner · Made by: Claude Code session …T7QHqA · 528940f
- Add the music data provider layer: Soundcharts adapter, the empty provider and the Scrape Creators sound count, tested on documented response shapes · Requested by: owner · Made by: Claude Code session …T7QHqA · ef4074c
- Add the music package: link parsing, metric names and the music calculations, with tests · Requested by: owner · Made by: Claude Code session …T7QHqA · 7bc549d
- Add music tracking tables, sound check columns and the music provider settings · Requested by: owner · Made by: Claude Code session …T7QHqA · 44b5a47

## 2026-11-11

- Client report refresh: unchanged data answers 304 and is not redrawn; remove the old load-more path · Requested by: owner · Made by: Claude Code session …oZc8T8 · 99abf5e

## 2026-11-10

- Staff can mark a withdrawal as sent in one step, reference optional; clippers see Sent · Requested by: owner · Made by: Claude Code session …6mbuoN · 55190ee
- Staff are told when a clipper changes their payout method; staff can message clippers without a strike · Requested by: owner · Made by: Claude Code session …6mbuoN · b297cdc

## 2026-11-09

- Client reports load fonts from the app, not Google; email footer can carry the postal address · Requested by: owner · Made by: Claude Code session …oZc8T8 · 687a61f
- Change log: every change with who asked and who made it, deploys, and staff actions in the admin · Requested by: owner · Made by: Claude Code session …oZc8T8 · f9c3851
- Add the runbook for running the platform from a new Claude Code account; bring the handover up to date · Requested by: owner · Made by: Claude Code session …oZc8T8 · 7b87b49

## 2026-11-06

- Apply the client-budget limit to Davido right away on deploy · Requested by: owner · Made by: Claude Code session …oZc8T8 · b3741bf
- Clippers stop earning once the client's budget is used up · Requested by: owner · Made by: Claude Code session …oZc8T8 · 53744f8
- Client report spend never passes the budget shown to the client · Requested by: owner · Made by: Claude Code session …oZc8T8 · f276f60

## 2026-11-03

- Client report phone layout · Requested by: owner · Made by: Claude Code session …oZc8T8 · 3899d28
- Client report: Show all loads every clip and the refresh keeps them · Requested by: owner · Made by: Claude Code session …oZc8T8 · c6e6c19
- Billboard report names the Instagram account of each reel · Requested by: owner · Made by: Claude Code session …oZc8T8 · 2daf212
- Report hides the generic CSV stand-in name · Requested by: owner · Made by: Claude Code session …oZc8T8 · deb6abc
- Resume the Billboard campaign once more, recording what closed it · Requested by: owner · Made by: Claude Code session …oZc8T8 · 835595b
- Add 5 more Billboard videos (2 Keira, 3 Batuhan); 8 duplicates skipped · Requested by: owner · Made by: Claude Code session …oZc8T8 · c27c157
- Add 9 more Billboard videos (6 Keira, 3 Batuhan); 7 duplicates skipped · Requested by: owner · Made by: Claude Code session …oZc8T8 · 57914ab

## 2026-11-02

- Client report names stand-in clippers; Keira's videos show her name · Requested by: owner · Made by: Claude Code session …oZc8T8 · 2da3b7d
- Worker one-off: resume the Billboard campaign and approve its waiting posts · Requested by: owner · Made by: Claude Code session …oZc8T8 · 27aaa66
- Report of an ended campaign shows posts added after it ended · Requested by: owner · Made by: Claude Code session …oZc8T8 · f4e8a07
- Date imported posts on the day they were posted, so the report lists every post it counts · Requested by: owner · Made by: Claude Code session …oZc8T8 · 9b6592f
- Report spend for a per-post-fee campaign is the fee plus the rate on each post's views · Requested by: owner · Made by: Claude Code session …oZc8T8 · 83aebde
- Billboard client report shows a $2,000 budget · Requested by: owner · Made by: Claude Code session …oZc8T8 · 9252c62
- Turn account linking and bio code verification back on · Requested by: owner · Made by: Claude Code session …oZc8T8 · 65720cc
- Flat fee per post paid outside the platform; the Billboard report adds $10 to every post · Requested by: owner · Made by: Claude Code session …oZc8T8 · 6d40123
- Add the handover guide for the engineer taking over the platform · Requested by: owner · Made by: Claude Code session …oZc8T8 · f7ae8e8
- Billboard posts: outside pay is $10 plus $3 per 1,000 views · Requested by: owner · Made by: Claude Code session …oZc8T8 · 613f856
- Leave posts added by staff off the public leaderboard · Requested by: owner · Made by: Claude Code session …oZc8T8 · 833506e
- Format the developers layout · Requested by: owner · Made by: Claude Code session …oZc8T8 · 6df1a79
- Client report counts pay made outside the platform; Billboard posts show $10 spend each · Requested by: owner · Made by: Claude Code session …oZc8T8 · d20361c
- Add the Billboard report file's 77 posts on deploy, noting the flat $10 per post · Requested by: owner · Made by: Claude Code session …oZc8T8 · 3be6d3d
- Add the owner's 15 Billboard clips that are no longer online on deploy · Requested by: owner · Made by: Claude Code session …oZc8T8 · 77b5ea6
- Add clips that are no longer online from their video files · Requested by: owner · Made by: Claude Code session …oZc8T8 · 0e31bdd
- CSV import: follow TikTok share links, match clippers by display name · Requested by: owner · Made by: Claude Code session …oZc8T8 · f6adea3

## 2026-10-30

- Accept any CSV with post links; clipper column optional · Requested by: owner · Made by: Claude Code session …oZc8T8 · a1bfd9e
- Show 'Add posts from a CSV' on ended campaigns too, not only live ones · Requested by: owner · Made by: Claude Code session …oZc8T8 · 5b54baf
- Developer docs: render per request so the Railway build no longer needs runtime secrets · Requested by: not recorded · Made by: jacques-netizen · 24d3dd1
- CI: give the partner API tests their database · Requested by: owner · Made by: Claude Code session …oZc8T8 · 78454ea
- Bring two stale tests up to date (6-hour checks, added reason codes) and make the report test independent of the time of day · Requested by: owner · Made by: Claude Code session …oZc8T8 · b2ed7c7
- Add posts to a campaign from a CSV, on the campaign's Clips tab · Requested by: owner · Made by: Claude Code session …oZc8T8 · a25cad2
- Payout methods: USDC on Solana or BEP-20, USDT on Solana, BEP-20 or TRC-20, and the account holder's address for tier 1 bank transfers · Requested by: owner · Made by: Claude Code session …oZc8T8 · 353c802
- Fix the lint and formatting errors that failed every CI run · Requested by: owner · Made by: Claude Code session …oZc8T8 · c75c2c4

## 2026-10-29

- Ask UK clippers for their bank sort code, and show it to finance on withdrawals · Requested by: owner · Made by: Claude Code session …oZc8T8 · 6b44c95

## 2026-10-28

- Public developer docs at /developers (and developers.maisondelites.com), with a reference built from the OpenAPI file · Requested by: owner · Made by: Claude Code session …oZc8T8 · aa2013b
- Partner API endpoints at /api/v1 and Admin, Developers to make and revoke partner keys · Requested by: owner · Made by: Claude Code session …oZc8T8 · c491fea
- Partner API core: approved partners' keys, read-only campaign and clip data, signed webhooks with retries · Requested by: owner · Made by: Claude Code session …oZc8T8 · a260229
- Developer handbook: how the platform is laid out, run, tested and deployed, and how money moves · Requested by: owner · Made by: Claude Code session …oZc8T8 · c5b7ed3

## 2026-10-26

- Count every view of a post toward its payout, including the views it had when it was submitted · Requested by: owner · Made by: Claude Code session …oZc8T8 · 8b72bdb
- Campaign reports: Claude-written client reports from campaign data, edited by instruction, published at /reports/<slug> with a PDF · Requested by: owner · Made by: Claude Code session …oZc8T8 · e9e9aea
- Resume a closed campaign until its earnings are released, so views read after an early close count · Requested by: owner · Made by: Claude Code session …oZc8T8 · 02213da

## 2026-10-25

- Hide Google sign-in and YouTube linking while Google rejects the app's addresses, and warn staff with the addresses to add · Requested by: owner · Made by: Claude Code session …oZc8T8 · 87bdcca

## 2026-10-17

- Budget shown to the client per campaign; Davido X Winnerman-Audio shows $2,000 · Requested by: owner · Made by: Claude Code session …oZc8T8 · 48555c9
- Davido X Winnerman-Audio client report at twice the clippers' earnings; per-campaign switch on the Settings tab · Requested by: owner · Made by: Claude Code session …oZc8T8 · 6f26811
- Verified views keep the post's likes, comments and shares; staff can enter them from the analytics · Requested by: owner · Made by: Claude Code session …oZc8T8 · 8ab9eb5
- Client report leaves out rejected and removed posts · Requested by: owner · Made by: Claude Code session …oZc8T8 · 3dc8c93
- Client spend factor per campaign: only Marrz-Audio counts spend at twice the clippers' earnings · Requested by: owner · Made by: Claude Code session …oZc8T8 · 00d1eda
- Client report keeps the budget as set; only spend is at the client's rate · Requested by: owner · Made by: Claude Code session …oZc8T8 · aadf361
- Client report counts every amount at twice the clippers' earnings (a $2 CPM on a $1 campaign) · Requested by: owner · Made by: Claude Code session …oZc8T8 · 77b9089

## 2026-10-16

- Staff set a post's views from analytics the clipper sent, with the screenshot, or ask the clipper to verify · Requested by: owner · Made by: Claude Code session …oZc8T8 · 0b461fc

## 2026-10-15

- Format the campaigns test · Requested by: owner · Made by: Claude Code session …oZc8T8 · fe00c11
- Brand site: Kojo Blak testimonial plays the YouTube video; caps per post and per creator can change on a live campaign · Requested by: owner · Made by: Claude Code session …oZc8T8 · 34f41ca
- Campaign workspace: actions box and report links stay above the tabs, clip tiles show likes, comments and the last check, specs follow the new admin · Requested by: owner · Made by: Claude Code session …oZc8T8 · 6a48da1
- Staff admin organised around campaigns: home list with waiting counts, campaign workspace with Review, Verifications, Clips, Clippers and Payouts tabs, clips playing inline, creator Verify views flow · Requested by: owner · Made by: Claude Code session …oZc8T8 · ba9b9ba
- View verification: Instagram posts always, stale or zero posts after 48 hours, verified views stand until the scraper passes them, flags and a three-rejection block · Requested by: owner · Made by: Claude Code session …oZc8T8 · 0fe1414

## 2026-10-14

- Demo campaign: build it in steps from the admin with TikTok, Instagram and X through the provider, dated June to December 2025 · Requested by: owner · Made by: Claude Code session …oZc8T8 · 18b56bb
- Final Zohran Mamdani demo clip file: 1,673 clips, 278M views, real likes and comments · Requested by: owner · Made by: Claude Code session …oZc8T8 · 27267f9
- Demo clip file: 1,663 clips with likes, first pass · Requested by: owner · Made by: Claude Code session …oZc8T8 · c877abe
- Record how the Zohran Mamdani demo clip file is built · Requested by: owner · Made by: Claude Code session …oZc8T8 · 0824522
- Demo campaign: official portrait as the cover, a $500 cap per post, and a way to add clips to an existing demo · Requested by: owner · Made by: Claude Code session …oZc8T8 · 4c39cc8
- Add the Zohran Mamdani demo clip file: 189 public YouTube clips, 161M views, with its end-to-end test · Requested by: owner · Made by: Claude Code session …oZc8T8 · a92aab8
- Check views every 6 hours after a post's first 72 hours, and let admins make demo campaigns from a clip file · Requested by: owner · Made by: Claude Code session …oZc8T8 · 8003146
- Warn on the staff dashboard when the data provider refuses every view check, with its last answer · Requested by: owner · Made by: Claude Code session …oZc8T8 · 8db704b
- Carry the provider's own error through "No provider could fetch the post", with the response text · Requested by: owner · Made by: Claude Code session …oZc8T8 · 24780d1
- Show on health how many checks got views in the last day and the provider's last error · Requested by: owner · Made by: Claude Code session …oZc8T8 · ea4e0da
- Count every view when a post's first working check comes late, and correct baselines a late check set · Requested by: owner · Made by: Claude Code session …oZc8T8 · 827ebf5
- Offer view proofs on picture posts only, recording each post's media kind from the platform · Requested by: owner · Made by: Claude Code session …oZc8T8 · a9309d0
- Let creators prove a post's views with a screen recording and a screenshot that staff check and set · Requested by: owner · Made by: Claude Code session …oZc8T8 · 42651fc
- Put tracked posts with no check scheduled back on the hourly check, and show tracking status on health · Requested by: owner · Made by: Claude Code session …oZc8T8 · e606dee

## 2026-10-12

- Play report clips as the video itself, streamed through the app, instead of the platform widget · Requested by: owner · Made by: Claude Code session …oZc8T8 · 6a32697
- Show report clips in a proper 9:16 frame and open the platform player full size in an overlay · Requested by: owner · Made by: Claude Code session …oZc8T8 · 2da6d9f
- Rebuild the client report from the Client Report mockup with gentle transitions · Requested by: owner · Made by: Claude Code session …oZc8T8 · 088dc3e
- Report: platform players for every clip, payout reasons, clean budget line, no CPM for clients; worker heartbeat, stale snapshot alarm and a manual stats refresh · Requested by: owner · Made by: Claude Code session …oZc8T8 · 7d19df6
- Show the report's submissions as clip cards with the video, figures and clipper, plus sort, Show all and a CSV download · Requested by: owner · Made by: Claude Code session …oZc8T8 · b3a9b39
- Delete a post's day rows with it, and let a report link be revoked right after it is made · Requested by: owner · Made by: Claude Code session …oZc8T8 · 816bdc1
- Keep each post's latest figures per day for the report, so it loads in under a second at 2,000 clips · Requested by: owner · Made by: Claude Code session …oZc8T8 · eed4172
- Add the client campaign report: signed share links, live figures from SQL, admin create and revoke · Requested by: owner · Made by: Claude Code session …oZc8T8 · 660cf40
- Check every post's views hourly while its campaign runs · Requested by: owner · Made by: Claude Code session …oZc8T8 · 397d53f

## 2026-10-11

- Show web addresses in a campaign's brief and rules as blue links · Requested by: owner · Made by: Claude Code session …oZc8T8 · d7ca983

## 2026-10-10

- Follow short share links from the TikTok and Instagram apps to the post · Requested by: owner · Made by: Claude Code session …oZc8T8 · 23ce0d1
- Publish version 1 of the terms, privacy policy, campaign rules, cookie notice and brand terms · Requested by: owner · Made by: Claude Code session …oZc8T8 · 333dd36
- Show which data providers are set up on the health check and the staff dashboard · Requested by: owner · Made by: Claude Code session …oZc8T8 · 27340f1
- Keep a post for review when the platform cannot be reached instead of refusing it · Requested by: owner · Made by: Claude Code session …oZc8T8 · a63fa46

## 2026-10-09

- Make the $5 minimum tests independent of stored settings · Requested by: owner · Made by: Claude Code session …oZc8T8 · 3b21b87
- Format the new tests · Requested by: owner · Made by: Claude Code session …oZc8T8 · 4384d8a
- Campaigns screen: one Sign out, no rate for creators, ended campaigns show paid out of budget · Requested by: owner · Made by: Claude Code session …oZc8T8 · 07c43f1
- Turn the staff Campaigns page into an overview of every campaign, with search and filters · Requested by: owner · Made by: Claude Code session …oZc8T8 · 09ff9bd
- Check post stats every 2 hours while a campaign runs · Requested by: owner · Made by: Claude Code session …oZc8T8 · b369545
- Show each post's views, likes and comments in a campaign's Submissions tab, with search and approve, deny, pending and delete buttons · Requested by: owner · Made by: Claude Code session …oZc8T8 · 576cea1
- Let staff put a decided post back to pending or delete it, reversing its earnings · Requested by: owner · Made by: Claude Code session …oZc8T8 · e6625f4
- Show each joined campaign's picture in My campaigns, without the rate · Requested by: owner · Made by: Claude Code session …oZc8T8 · b0f16f8
- Send the menu's Support to the Discord server · Requested by: owner · Made by: Claude Code session …oZc8T8 · 0b89f91
- Set the minimum withdrawal to $5 · Requested by: owner · Made by: Claude Code session …oZc8T8 · b2b48d0

## 2026-10-08

- Let admins credit a user's balance · Requested by: owner · Made by: Claude Code session …oZc8T8 · e0003a8
- Add bank payouts and a three step crypto setup · Requested by: owner · Made by: Claude Code session …oZc8T8 · 5d898f3
- Allow bank transfer withdrawals in the money engine · Requested by: owner · Made by: Claude Code session …oZc8T8 · 0b08664
- Make Glass the default theme · Requested by: owner · Made by: Claude Code session …oZc8T8 · bc331e0
- Let creators withdraw to a crypto wallet, and let finance verify, pay and reject withdrawals on the Payouts page · Requested by: owner · Made by: Claude Code session …oZc8T8 · 9c00997
- Add crypto withdrawals to the money engine: wallet on each request, a verify step, and reject from any open step · Requested by: owner · Made by: Claude Code session …oZc8T8 · af893c5
- Switch account linking off: creators submit links without linking and a reviewer checks each post · Requested by: owner · Made by: Claude Code session …oZc8T8 · 9398336

## 2026-10-07

- Let admins delete campaigns that have already ended · Requested by: owner · Made by: Claude Code session …oZc8T8 · 7e4b7c0
- Show ended campaigns to creators with nothing left and a full budget bar · Requested by: owner · Made by: Claude Code session …oZc8T8 · 747fde0
- Let admins delete campaigns, keeping the records of ones that moved money · Requested by: owner · Made by: Claude Code session …oZc8T8 · 60b8fc2
- Apply review decisions at once so quick key presses are never dropped · Requested by: owner · Made by: Claude Code session …oZc8T8 · ac4cd14
- Show past campaigns under the active ones on the campaigns screen · Requested by: owner · Made by: Claude Code session …oZc8T8 · 4c55fed
- Let staff change the budget of funded and live campaigns, moving the difference through the ledger · Requested by: owner · Made by: Claude Code session …oZc8T8 · bd4c9f2
- Stop the main domain's home page redirecting to itself · Requested by: owner · Made by: Claude Code session …oZc8T8 · d63c53a
- Recognise the main domain when Cloudflare forwards it under Railway's address · Requested by: owner · Made by: Claude Code session …oZc8T8 · efafa6f
- Put Sign out at the bottom of the creator menu · Requested by: owner · Made by: Claude Code session …oZc8T8 · 9bba759
- Show the featured campaign's own picture in the banner · Requested by: owner · Made by: Claude Code session …oZc8T8 · a3cdfa0
- Use app.maisondelites.com for sign-in and fix the main domain's redirect loop · Requested by: owner · Made by: Claude Code session …oZc8T8 · 0c54e26
- Let admins change the picture behind the featured campaign · Requested by: owner · Made by: Claude Code session …oZc8T8 · 3477c58
- Let admins choose the featured campaign and its words on the campaigns screen · Requested by: owner · Made by: Claude Code session …oZc8T8 · fd35d87
- Make kymencarter@gmail.com an admin · Requested by: owner · Made by: Claude Code session …oZc8T8 · f827767
- Record the decisions for accounts with passwords, profile and Home · Requested by: owner · Made by: Claude Code session …oZc8T8 · bf7a9c0
- Keep posts already decided out of the review queue when a refresh brings them back · Requested by: owner · Made by: Claude Code session …oZc8T8 · 5685a68
- Tell creators on the Support page to open a ticket in the Discord · Requested by: owner · Made by: Claude Code session …oZc8T8 · c80eb34
- Lay out Home like the reference: profile card, earnings, views and submissions, active campaigns · Requested by: owner · Made by: Claude Code session …oZc8T8 · 7771617
- Add a profile page for username, Discord name, picture and password, and show usernames instead of emails · Requested by: owner · Made by: Claude Code session …oZc8T8 · c50bf9d
- Sign up and sign in with a username and password, with an emailed code on new devices · Requested by: owner · Made by: Claude Code session …oZc8T8 · ea8acc1
- Remove the Campaigns and Wallet pill from the home and public pages · Requested by: owner · Made by: Claude Code session …oZc8T8 · 64eecf4
- Send visitors on the Railway address to the app address · Requested by: owner · Made by: Claude Code session …oZc8T8 · 05dff94
- Ask for a payout method before Withdraw, and show it to finance on the creator page · Requested by: owner · Made by: Claude Code session …oZc8T8 · 5f7ff43
- Move the review queue into the dark staff console with the admin menu · Requested by: owner · Made by: Claude Code session …oZc8T8 · 24034c8
- Drop the 18 or older requirement from sign up and the creator pages · Requested by: owner · Made by: Claude Code session …oZc8T8 · 926bf15
- Name the admin menu's creator search Find a creator so it is not confused with the page search · Requested by: owner · Made by: Claude Code session …oZc8T8 · 5dfab47
- Add the creator Home with profile, tier, linked accounts and totals, and the leaderboard · Requested by: owner · Made by: Claude Code session …oZc8T8 · 4d15dc9
- Sign new accounts straight in, start everyone on Campaigns, and keep sessions for 90 days · Requested by: owner · Made by: Claude Code session …oZc8T8 · 11208a9
- Give the creator app one menu on every screen and put the wallet in the campaigns frame · Requested by: owner · Made by: Claude Code session …oZc8T8 · 99f29b5
- Restyle the staff console as a dark admin modelled on the Promote layout, with a campaign page of header card, tabs and rule cards · Requested by: owner · Made by: Claude Code session …oZc8T8 · 61dbe89

## 2026-10-06

- Send For creators to the app domain, and add the Brand site page to upload case study videos, posters and clips · Requested by: owner · Made by: Claude Code session …oZc8T8 · c552201
- Serve the brand site on the main domain and the creator app on its own subdomain from one deployment · Requested by: owner · Made by: Claude Code session …oZc8T8 · 9cdf7f7
- Give each campaign an overview with its numbers and every approved, pending and rejected post · Requested by: owner · Made by: Claude Code session …oZc8T8 · 5dbdfc9
- Remove the ad disclosure requirement from submissions and campaigns · Requested by: owner · Made by: Claude Code session …oZc8T8 · b7567e7
- Format the team test · Requested by: owner · Made by: Claude Code session …oZc8T8 · 99eea60
- Add the Team page to give staff access by email, and a separate staff sign-in · Requested by: owner · Made by: Claude Code session …oZc8T8 · a96164f
- Rework the campaign builder: uploads for pictures and assets, plain dollar amounts, inline new client, and one-step go live · Requested by: owner · Made by: Claude Code session …oZc8T8 · c91739b
- Make the ADMIN_EMAIL addresses admin when they sign in, so the owner needs no command line · Requested by: owner · Made by: Claude Code session …oZc8T8 · 3cc380a

## 2026-10-05

- Add the production image, Railway config, health check, first-admin command and deploy guide · Requested by: owner · Made by: Claude Code session …oZc8T8 · 13a7f9f
- Record that queue filters, bulk approve and the leaderboard are on hold · Requested by: owner · Made by: Claude Code session …oZc8T8 · d490ee9
- Wait for the page to hydrate before clicking filters and tabs in the visual tests · Requested by: owner · Made by: Claude Code session …oZc8T8 · d19aa3a
- Add the notifications page, email preferences by signed link, one-click unsubscribe, and the answer box for reviewer questions · Requested by: owner · Made by: Claude Code session …oZc8T8 · d124cb8
- Notify creators and staff for releases, removals, account problems, campaign events and new campaigns, and let creators answer a reviewer's question · Requested by: owner · Made by: Claude Code session …oZc8T8 · 6490456
- Fix a lint error in the email job and record the notification decisions · Requested by: owner · Made by: Claude Code session …oZc8T8 · 42168e5
- Send notification emails from the worker with retries, preferences and signed links, and warn staff about appeals due within 24 hours · Requested by: owner · Made by: Claude Code session …oZc8T8 · c3e5943
- Add the staff creators list and detail with warnings, suspension, restore and audited notes · Requested by: owner · Made by: Claude Code session …oZc8T8 · cad4ac5
- Clear the sign-in rate limit counters before each test sign-in so the suite stays under the limit · Requested by: owner · Made by: Claude Code session …oZc8T8 · 32b23d9
- Add appeals for creators, the staff appeals inbox by deadline, and the staff dashboard · Requested by: owner · Made by: Claude Code session …oZc8T8 · a151ec4
- Build the review queue from Creator Site v1 with keyboard shortcuts, and add the full post detail page · Requested by: owner · Made by: Claude Code session …oZc8T8 · 9f74bce
- Add reviewer decisions, flag handling, appeals, warnings and suspension with exact earnings reversal · Requested by: owner · Made by: Claude Code session …oZc8T8 · ca5ff45
- Lock the owner-approved wallet phone layout in the reference set · Requested by: owner · Made by: Claude Code session …oZc8T8 · 0cdc4e1
- Format the wallet converter settings · Requested by: owner · Made by: Claude Code session …oZc8T8 · 5c0fc3b
- Propose a phone layout for the wallet, from the mockup's components only · Requested by: owner · Made by: Claude Code session …oZc8T8 · 7675a22
- Add the staff campaign monitor with budget gauge, posts by state, flags, top creators and closing · Requested by: owner · Made by: Claude Code session …oZc8T8 · 15d442b
- Add My campaigns with posts, counted views and earnings per joined campaign · Requested by: owner · Made by: Claude Code session …oZc8T8 · db902f1
- Build the wallet from Creator Site v1 with real balances, posts, rating, streak and payout overview · Requested by: owner · Made by: Claude Code session …oZc8T8 · f1ddb68
- Add the hourly earnings release, repeatable budget returns and the daily ledger check · Requested by: owner · Made by: Claude Code session …oZc8T8 · 985bc6f
- Add the view check job with snapshots, earnings, the grace period, fraud flags and the daily account re-check · Requested by: owner · Made by: Claude Code session …oZc8T8 · e834303
- Add Scrape Creators as the data provider for TikTok, Instagram and X accounts linked by bio code · Requested by: owner · Made by: Claude Code session …oZc8T8 · f94e40e
- Keep Prettier off the generated designed screens when it runs from the web app folder · Requested by: owner · Made by: Claude Code session …oZc8T8 · 89e511a
- Restore the designed screens to the converter's exact output and count the new reason code in the config test · Requested by: owner · Made by: Claude Code session …oZc8T8 · 58fcac9
- Let the platform choice on the accounts screen wrap, and add Phase 3 review screenshots · Requested by: owner · Made by: Claude Code session …oZc8T8 · bb75323
- Add the creator submissions screen with filters and a detail drawer, and admin editing of reason code messages · Requested by: owner · Made by: Claude Code session …oZc8T8 · 68d5fe1
- Format the submission files · Requested by: owner · Made by: Claude Code session …oZc8T8 · be711fb
- Add the submission form with the eleven automatic checks, reason codes and live results · Requested by: owner · Made by: Claude Code session …oZc8T8 · 29d2c35
- Add the YouTube provider and linking a YouTube channel by YouTube login, with tokens encrypted at rest · Requested by: owner · Made by: Claude Code session …oZc8T8 · bd15658
- Format the accounts end to end test · Requested by: owner · Made by: Claude Code session …oZc8T8 · ac56e4b
- Add the accounts screen and bio code linking through the provider interface with a mock provider · Requested by: owner · Made by: Claude Code session …oZc8T8 · 18295cb
- Lock the owner-approved phone layout of the campaigns screen in the reference set · Requested by: owner · Made by: Claude Code session …oZc8T8 · b55912a
- Add the worker app that runs the campaign lifecycle job every 5 minutes · Requested by: owner · Made by: Claude Code session …oZc8T8 · f9b0206
- Add how it works, for clients, fees, help and legal pages, and link them from the home and brand site · Requested by: owner · Made by: Claude Code session …oZc8T8 · 7e1008d
- Add the campaign page with every rule shown before joining, and joining with access codes for private campaigns · Requested by: owner · Made by: Claude Code session …oZc8T8 · 25c255e
- Build the campaigns screen from Creator Site v1 with real campaigns, filters, search and both themes · Requested by: owner · Made by: Claude Code session …oZc8T8 · c3064da
- Add staff screens for clients, funding, the campaign list and the campaign builder · Requested by: owner · Made by: Claude Code session …oZc8T8 · f01d964
- Add the campaigns package: builder form, templates, terms versions, publish only when funded, copy, close, join, lifecycle · Requested by: owner · Made by: Claude Code session …oZc8T8 · e2acd2c
- Parse dollars typed by staff into whole cents with string maths · Requested by: owner · Made by: Claude Code session …oZc8T8 · d46030e
- Seed funded campaigns and earnings through the money engine, matching the mockups' sample numbers · Requested by: owner · Made by: Claude Code session …oZc8T8 · 2d2caa1
- Record that the Data, Loading and Error switches are preview tools · Requested by: owner · Made by: Claude Code session …oZc8T8 · d0b5eaf
- Run the money tests in CI and record the money engine decisions · Requested by: owner · Made by: Claude Code session …oZc8T8 · 84a945b
- Implement the money engine: accounts, idempotent transactions, earnings, release, reversal, withdrawals and quote · Requested by: owner · Made by: Claude Code session …oZc8T8 · ee834ac
- Reject unbalanced ledger transactions and negative balances at commit, and make ledger rows unchangeable · Requested by: owner · Made by: Claude Code session …oZc8T8 · 3d92939
- Write the money engine tests first: the 13 required cases, property tests and concurrency · Requested by: owner · Made by: Claude Code session …oZc8T8 · 32782ae
- Format the phone capture script and clarify the phone layout rule · Requested by: owner · Made by: Claude Code session …oZc8T8 · 3710a14
- Lock the approved phone layouts for the home page and brand site at 390px · Requested by: owner · Made by: Claude Code session …oZc8T8 · 32fb4c9
- Record the open items the owner will answer later · Requested by: owner · Made by: Claude Code session …oZc8T8 · cfae190
- Format the phone stylesheet and converter config · Requested by: owner · Made by: Claude Code session …oZc8T8 · eefde86
- Propose phone layouts for the home page and brand site, and stop shared components overflowing on phones · Requested by: owner · Made by: Claude Code session …oZc8T8 · 96f34e0

## 2026-10-04

- Run the platform checks on every branch push as well as pull requests · Requested by: owner · Made by: Claude Code session …oZc8T8 · 91e2fe3
- Fix the rate limiter skipping requests made before Redis connects · Requested by: owner · Made by: Claude Code session …oZc8T8 · 0285a36
- Add CI: lint, formatting, types, tests, migrations check, locked design check, end to end and visual tests · Requested by: owner · Made by: Claude Code session …oZc8T8 · ced2e48
- Guard /admin and the staff API by role on the server, with end to end tests · Requested by: owner · Made by: Claude Code session …oZc8T8 · 8f02669
- Add Auth.js sign in with email magic link, Google and Discord, with age and terms consent on sign up · Requested by: owner · Made by: Claude Code session …oZc8T8 · 658d854
- Add the shared components and the /styleguide page with every state in paper, Dark and Glass · Requested by: owner · Made by: Claude Code session …oZc8T8 · 0ab6400
- Add visual tests for the home page and brand site against the locked screenshots · Requested by: owner · Made by: Claude Code session …oZc8T8 · d01e42b
- Build the brand site from Platform Mockups with case studies and videos in settings · Requested by: owner · Made by: Claude Code session …oZc8T8 · 83f1220
- Build the home page from Creator Site v1, with its copy editable from settings · Requested by: owner · Made by: Claude Code session …oZc8T8 · d25f094
- Add the web app with design tokens taken from the mockups and self-hosted mockup fonts · Requested by: owner · Made by: Claude Code session …oZc8T8 · 98226c3
- Add the database package with every table, migrations, seed, settings and audit log helpers · Requested by: owner · Made by: Claude Code session …oZc8T8 · fd1f18a
- Create the monorepo with TypeScript, lint, formatting and shared config · Requested by: owner · Made by: Claude Code session …oZc8T8 · 068fca4
- Lock reference screenshots at 1440 and 1024 px in Git LFS, add the full CLAUDE.md rules · Requested by: owner · Made by: Claude Code session …oZc8T8 · 0fbeabb
- Add platform build brief, locked handoff mockups, reference screenshots and CLAUDE.md · Requested by: owner · Made by: Claude Code session …oZc8T8 · 8189a95
- Winnerman: hero reads Into the African feed, drop views per week · Requested by: not recorded · Made by: Claude Code session …Am43pL · ff09a69
- Winnerman: remove the Davido disclaimer · Requested by: not recorded · Made by: Claude Code session …Am43pL · 358b5cd
- Winnerman: put the actual artist on the page, correct his handle · Requested by: not recorded · Made by: Claude Code session …Am43pL · b59a540
- Add Winnerman campaign outline at /winnerman · Requested by: not recorded · Made by: Claude Code session …Am43pL · 58f2f4f

## 2026-10-02

- Run It Bak: route the root of runitbak.<domain> to the gate · Requested by: not recorded · Made by: Claude Code session …9He9Q2 · 3afe679
- Run It Bak: serve the gate at the root of runitbak.<domain> · Requested by: not recorded · Made by: Claude Code session …9He9Q2 · 27c3873
- Run It Bak: default password is Steallikeanartist · Requested by: not recorded · Made by: Claude Code session …9He9Q2 · 217a9a2
- Add Run It Bak: password gated content bank at /runitbak · Requested by: not recorded · Made by: Claude Code session …9He9Q2 · 4d7109b

## 2026-09-30

- Add Steal Like an Artist content bank at /steal-like-an-artist · Requested by: not recorded · Made by: Claude Code session …9He9Q2 · d7a60cd

## 2026-09-28

- Campaign proposal: fix clips on mobile, redesign the video tiles · Requested by: not recorded · Made by: Claude Code session …Am43pL · 3c0cf14
- Campaign proposal: remove start-date slider, next step and 11M figure · Requested by: not recorded · Made by: Claude Code session …Am43pL · 323de12
- Campaign proposal: full visual rebuild, clip-account embeds, calculator last · Requested by: not recorded · Made by: Claude Code session …Am43pL · 9a003f3
- Campaign proposal: price on a $3 CPM slider, swap embeds to clip accounts · Requested by: not recorded · Made by: Claude Code session …Am43pL · 24e9a26
- Add 2027 campaign short-form distribution proposal at /owning-the-feed · Requested by: not recorded · Made by: Claude Code session …Am43pL · f310af9

## 2026-09-26

- Remove em dashes from brand sheet copy and notifications · Requested by: not recorded · Made by: Claude Code · fbb54f9

## 2026-09-22

- Update handlers.js · Requested by: not recorded · Made by: jacques-netizen · b2c4115
- Update index.html · Requested by: not recorded · Made by: jacques-netizen · 0d9ae1e
- notify: show booking source/event-type in Discord message · Requested by: not recorded · Made by: jacques-netizen · e56789d

## 2026-09-18

- book/index.html: load Cal.com event type based on utm_source · Requested by: not recorded · Made by: jacques-netizen · 8829638

## 2026-09-17

- Add monogram crest, optional intro video, and booking thank-you to brand sheet · Requested by: not recorded · Made by: Claude Code session …eT3KyJ · 0dec9ec
- Add client Brand Discovery questionnaire with capture backend · Requested by: not recorded · Made by: Claude Code session …eT3KyJ · 339c5c5

## 2026-08-30

- Add Scott Sebastian growth proposal at /scott-sebastian · Requested by: not recorded · Made by: Claude Code session …Am43pL · f672236

## 2026-08-23

- Redesign campaign hub + dashboard; fix broken hub cards · Requested by: not recorded · Made by: jacques-netizen · caae9ea
- Admin overhaul + Save button + budget spend bar · Requested by: not recorded · Made by: jacques-netizen · 2488d79

## 2026-08-14

- CandyRific: remove the budget slider from the shortlist · Requested by: not recorded · Made by: Claude Code session …Am43pL · 38e024f
- CandyRific: cut the credit line, the caveats, the instructions and the corny copy · Requested by: not recorded · Made by: Claude Code session …Am43pL · 75bbe2e
- CandyRific: use the red-carpet frame for Maya Jama as requested · Requested by: not recorded · Made by: Claude Code session …Am43pL · 6dbd696
- CandyRific: swap Maya Jama to a tighter, stronger frame · Requested by: not recorded · Made by: Claude Code session …Am43pL · 9f50049
- CandyRific deck: all eight portraits live, plus audience figures · Requested by: not recorded · Made by: Claude Code session …Am43pL · 27f6f45
- CandyRific deck: wire real portraits for six of eight talent · Requested by: not recorded · Made by: Claude Code session …Am43pL · bb0eab0
- Add CandyRific talent roster as an interactive deck at /candyrific · Requested by: not recorded · Made by: Claude Code session …Am43pL · 25912c1

## 2026-07-24

- CoinJuice: fill in real values instead of bracket placeholders · Requested by: not recorded · Made by: Claude Code session …Am43pL · 359d914
- Add CoinJuice growth proposal at /coinjuice · Requested by: not recorded · Made by: Claude Code session …Am43pL · 435cbe8

## 2026-07-23

- Fuzzbucket: reword cheesy heading, add live budget calculator · Requested by: not recorded · Made by: Claude Code session …Am43pL · 6d28e92
- Add Fuzzbucket growth proposal at /fuzzbucket · Requested by: not recorded · Made by: Claude Code session …Am43pL · c46f867

## 2026-07-20

- Fix Two Options section: drop the gimmicky pull-quote, use a plain comparison table · Requested by: not recorded · Made by: Claude Code session …Am43pL · ca78e7a
- Add ValuePilot x MDE interactive engagement proposal at /valuepilot-engagement · Requested by: not recorded · Made by: Claude Code session …Am43pL · 65555a9

## 2026-07-19

- Add Gordon Glenister brand monetization system operating manual at /gordon-system · Requested by: not recorded · Made by: Claude Code session …Am43pL · 5fa8dd5

## 2026-07-10

- Add interactive ValuePilot Go-To-Market Action Plan at /valuepilot-gtm · Requested by: not recorded · Made by: Claude Code session …Am43pL · a1e22e0

## 2026-07-07

- Campaign banner image + fix name not sticking on republish · Requested by: not recorded · Made by: jacques-netizen · 677924d
- Fix new-campaign routing bug + remove platform-split panel · Requested by: not recorded · Made by: jacques-netizen · 4e96a45
- Operator campaign hub — list all clients, click to edit · Requested by: not recorded · Made by: jacques-netizen · 9d225e4
- Trigger redeploy + document campaigns domain · Requested by: not recorded · Made by: jacques-netizen · 704b408

## 2026-07-06

- Multi-client campaign dashboards + SOP · Requested by: not recorded · Made by: jacques-netizen · 99d90f4

## 2026-07-02

- Show clip status (accepted/pending/rejected) on cards · Requested by: not recorded · Made by: jacques-netizen · dc429dc
- chore: trigger redeploy (valuepilot page missing from live site) · Requested by: not recorded · Made by: Claude Code session …Am43pL · 69b90f0
- Add ValuePilot Marketing Execution Plan presentation at /valuepilot · Requested by: not recorded · Made by: Claude Code session …Am43pL · eba03c1

## 2026-06-30

- Content tiles: elegant monogram cards (stable) · Requested by: not recorded · Made by: jacques-netizen · ff98354
- Show the real posts via official Instagram/YouTube embeds · Requested by: not recorded · Made by: jacques-netizen · 5ad4758
- On-demand thumbnail resolve + incremental saves · Requested by: not recorded · Made by: jacques-netizen · f9dfe2b
- Same-origin image proxy so IG/TikTok thumbnails display · Requested by: not recorded · Made by: jacques-netizen · eab84dd
- Instagram thumbnails via free embed + proxy display + cron self-heal · Requested by: not recorded · Made by: jacques-netizen · 5e49cbb
- Use a dedicated Instagram API for thumbnails · Requested by: not recorded · Made by: jacques-netizen · d7b2ff0
- Thumbnail diagnostic endpoint + admin tool · Requested by: not recorded · Made by: jacques-netizen · 0e8fa75
- Optional ScraperAPI proxy for reliable Instagram thumbnails · Requested by: not recorded · Made by: jacques-netizen · cb55634
- Browser-side Instagram preview fallback (keyless screenshot) · Requested by: not recorded · Made by: jacques-netizen · ca23a2a
- Recognize Amount Paid column for real spend · Requested by: not recorded · Made by: jacques-netizen · a7bd74a
- Instagram thumbnails via public embed endpoint · Requested by: not recorded · Made by: jacques-netizen · c30805b
- Never estimate spend — real CSV earnings only · Requested by: not recorded · Made by: jacques-netizen · 971d160
- Reliable thumbnails (og:image) + auto-calculated spend · Requested by: not recorded · Made by: jacques-netizen · 3969899
- Fix thumbnails + clickable tiles + admin Save & Publish · Requested by: not recorded · Made by: jacques-netizen · c058f42
- Dashboard: remove guarantee-floor loader, add real thumbnails · Requested by: not recorded · Made by: jacques-netizen · bd97f0f
- Campaign dashboard + simple CSV file upload admin · Requested by: not recorded · Made by: jacques-netizen · 0f4ad2f

## 2026-06-29

- Add Gordon Glenister photo to Michael proposal LinkedIn offer · Requested by: not recorded · Made by: Claude Code session …Am43pL · 22be3ae
- Add Michael Bruce-de-Rouche proposal with 3 standalone offers + live calculator · Requested by: not recorded · Made by: Claude Code session …Am43pL · d9c8d22

## 2026-06-24

- Add viral reel thumbnail to Samer proposal · Requested by: not recorded · Made by: Claude Code session …Am43pL · 98d09d9
- Add Four's profile photo to Samer proposal; make viral card a tap-to-play link · Requested by: not recorded · Made by: Claude Code session …Am43pL · 402246f
- Add Samer Zayat growth proposal page at /samer · Requested by: not recorded · Made by: Claude Code session …Am43pL · 94469e0

## 2026-06-22

- Remove em dashes, fix booking CTA routing, correct partnership email · Requested by: not recorded · Made by: Claude Code session …Am43pL · 1523b0c
- Add hello. landing subdomain; route book. root to the calendar · Requested by: not recorded · Made by: Claude Code session …Am43pL · 27975ec
- Split funnel into clean landing page + /booked confirmation · Requested by: not recorded · Made by: Claude Code session …Am43pL · cc32378
- docs: document book.maisondelites.com custom domain setup · Requested by: not recorded · Made by: Claude Code session …Am43pL · b1ed97d

## 2026-06-15

- Remove temporary /api/notify-test diagnostic endpoint now that Discord notifications are confirmed working · Requested by: not recorded · Made by: Claude Code · 21d67c3
- Redeploy to pick up the saved DISCORD_WEBHOOK_URL secret · Requested by: not recorded · Made by: Claude Code · 53bcaad
- Add temporary GET /api/notify-test to diagnose the Discord webhook wiring from a browser · Requested by: not recorded · Made by: Claude Code · a412877
- Redeploy to activate DISCORD_WEBHOOK_URL secret · Requested by: not recorded · Made by: Claude Code · c7bed6e
- Restore the uploaded Walmart case-study clip (/v/walmart); revert the accidental YouTube swap · Requested by: not recorded · Made by: Claude Code · 808b571
- Trigger redeploy to attach DISCORD_WEBHOOK_URL secret · Requested by: not recorded · Made by: Claude Code · 2678e47
- Switch /book to the live Cal.com booking embed · Requested by: not recorded · Made by: Claude Code · d74b436
- Switch /book toward Cal.com: native questions (no double entry) + server-side webhook to Discord · Requested by: not recorded · Made by: Claude Code · 4b4c95f
- Restructure /book booking flow per conversion research: minimal entry, fit-gate, then calendar, then qualify · Requested by: not recorded · Made by: Claude Code · d3215c5
- Fix /book calendar not rendering: wait for async Calendly script, then init inline widget with name/email prefill · Requested by: not recorded · Made by: Claude Code · 8b6310e
- Make /book an interactive multi-step intake form that captures full lead details to Discord · Requested by: not recorded · Made by: Claude Code · 0cc9719
- Send a Discord notification when someone books · Requested by: not recorded · Made by: Claude Code · 8e39e77
- Add /book page: embedded Calendly that auto-redirects to landing page on booking · Requested by: not recorded · Made by: Claude Code · 3acaa7d
- Restore portrait clip popup; give the vertical paid-ads FAQ Short a portrait player · Requested by: not recorded · Made by: Claude Code · 9303f29
- Wire FAQ 3 + Walmart YouTube videos; widen clip popup to 16:9 · Requested by: not recorded · Made by: Claude Code · 01cda9c
- Wire welcome + FAQ 1/2 videos to YouTube embeds · Requested by: not recorded · Made by: Claude Code · f832daf
- Remove GitHub Actions deploy workflow (Cloudflare builds work; the paused service was Netlify, which is unused) · Requested by: not recorded · Made by: Claude Code · df76785
- Add GitHub Actions deploy workflow (free deploy bypassing managed builds) · Requested by: not recorded · Made by: Claude Code · 21ac55f
- Add Walmart campaign results: 17M views at 0.2% conversion · Requested by: not recorded · Made by: Claude Code · 314160b
- Add welcome video upload slot and improve upload progress · Requested by: not recorded · Made by: Claude Code · 75be658
- Trigger Worker build with corrected deploy command · Requested by: not recorded · Made by: Claude Code · 444fb9e
- Deploy as Cloudflare Worker with static assets · Requested by: not recorded · Made by: Claude Code · 87b81dd
- Trigger Cloudflare redeploy to pick up MEDIA binding and ADMIN_PASSWORD · Requested by: not recorded · Made by: Claude Code · 4500d7d

## 2026-06-14

- Add password-protected phone upload page (Cloudflare Pages + R2) · Requested by: not recorded · Made by: Claude Code · b7690d2
- Add phone-friendly self-hosted video uploads from the repo · Requested by: not recorded · Made by: Claude Code · 673a30f
- Move interactive case study deck under FAQ and fix blank section · Requested by: not recorded · Made by: Claude Code · 30ffe9c
- Wire Walmart case-study video and add Google Drive support to clip lightbox · Requested by: not recorded · Made by: Claude Code · 2cc7035
- FAQ 4-7 to text; add interactive case studies section (count-up, filters, CPM calc, reach map, dashboard links, clips) with Walmart placeholder · Requested by: not recorded · Made by: Claude Code · 61723b6

## 2026-06-11

- Add welcome video player to hero; feature Priscilla and Lavinia, remove Michael Dapaah from front grid · Requested by: not recorded · Made by: Claude Code · a2347bc
- Add Dennis Gyamfi photo; upgrade Priscilla Donkoh and Lavinia Calin photos · Requested by: not recorded · Made by: Claude Code · f46e433
- Add profile photos for Shaun Okojie, Tobi Brown, Michael Dapaah, and JAE5 · Requested by: not recorded · Made by: Claude Code · b4c97ad
- Add profile photos for Ola Aina, Demarai Gray, Eva Apio, Sheggz, and Fuse ODG · Requested by: not recorded · Made by: Claude Code · d41418d

## 2026-06-10

- Add profile photos for Shaggy, Eugy, Sophie Castillo, Young T & Bugsey, and Tim Duzit · Requested by: not recorded · Made by: Claude Code · 1f479d0
- Add profile photos for King Promise, Odumodu Blvck, JELEEL!, and Pheelz · Requested by: not recorded · Made by: Claude Code · a969f93
- Add profile photos for Asake, KiDi, and Spinall · Requested by: not recorded · Made by: Claude Code · 7064890
- Add profile photos for Naomi Campbell and Idris Elba · Requested by: not recorded · Made by: Claude Code · cb1e3bd
- Add profile photos for Priscilla Donkoh and Lavinia Calin · Requested by: not recorded · Made by: Claude Code · 0c5552a
- Switch talent photos to local image files (Instagram auto-fetch now blocked) · Requested by: not recorded · Made by: Claude Code · 75d795f
- Move Dennis Gyamfi to Sport category · Requested by: not recorded · Made by: Claude Code · ebbfe87
- Add Dennis Gyamfi to talent roster · Requested by: not recorded · Made by: Claude Code · 23e04c3
- Add Lavinia Calin, Priscilla Donkoh, and Tobi Brown to talent roster · Requested by: not recorded · Made by: Claude Code · bfb8b42

## 2026-06-09

- Add IG profile photos to talent cards and wire FAQ video slots · Requested by: not recorded · Made by: Claude Code · 30e1264
- Build post-booking landing page with talent roster modal · Requested by: not recorded · Made by: Claude Code · ba455e6
