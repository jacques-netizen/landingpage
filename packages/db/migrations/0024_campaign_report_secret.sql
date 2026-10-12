ALTER TABLE "campaigns" ADD COLUMN "report_secret" text;--> statement-breakpoint
-- The client report builds a day-by-day series from the latest snapshot per post per day; this index
-- lets that read in index order instead of sorting every snapshot (client report brief, 2026-10-12).
CREATE INDEX IF NOT EXISTS "view_snapshots_submission_day" ON "view_snapshots" ("submission_id", (("taken_at" AT TIME ZONE 'UTC')::date), "taken_at" DESC) WHERE "views" IS NOT NULL;
