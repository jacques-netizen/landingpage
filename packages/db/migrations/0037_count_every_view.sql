-- Every view of a post counts, the ones it had when it was submitted too (owner rule, 2026-10-26).
-- Posts still being tracked lose their baseline; approved posts show the views they now count, and the
-- next view check (or "Refresh stats") pays the difference. Paid-out posts are left as they were.
UPDATE "submissions" SET "baseline_views" = 0
WHERE "baseline_views" <> 0 AND "state" NOT IN ('paid_out');
--> statement-breakpoint
UPDATE "submissions" SET "counted_views" = greatest("latest_views", "verified_views")
WHERE "state" IN ('approved', 'earning');
--> statement-breakpoint
-- Schedule a check now for every approved post on a live campaign, so the payout catches up within the hour.
UPDATE "submissions" s SET "next_check_at" = now()
FROM "campaigns" c
WHERE c."id" = s."campaign_id" AND c."status" = 'live' AND NOT c."demo" AND s."state" IN ('approved', 'earning');
