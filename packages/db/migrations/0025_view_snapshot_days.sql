CREATE TABLE "view_snapshot_days" (
	"submission_id" uuid NOT NULL,
	"day" date NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"views" bigint NOT NULL,
	"likes" bigint,
	"comments" bigint,
	"shares" bigint,
	CONSTRAINT "view_snapshot_days_submission_id_day_pk" PRIMARY KEY("submission_id","day")
);
--> statement-breakpoint
ALTER TABLE "view_snapshot_days" ADD CONSTRAINT "view_snapshot_days_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill: each post's latest readable snapshot per UTC day, from every snapshot so far.
INSERT INTO "view_snapshot_days" ("submission_id", "day", "taken_at", "views", "likes", "comments", "shares")
SELECT DISTINCT ON ("submission_id", ("taken_at" AT TIME ZONE 'UTC')::date)
  "submission_id", ("taken_at" AT TIME ZONE 'UTC')::date, "taken_at", "views", "likes", "comments", "shares"
FROM "view_snapshots" WHERE "views" IS NOT NULL
ORDER BY "submission_id", ("taken_at" AT TIME ZONE 'UTC')::date, "taken_at" DESC
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- The day rows replace the expression index from 0024.
DROP INDEX IF EXISTS "view_snapshots_submission_day";
