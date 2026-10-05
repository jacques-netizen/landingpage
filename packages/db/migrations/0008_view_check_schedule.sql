ALTER TABLE "submissions" ADD COLUMN "next_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "missing_since" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "submissions_next_check" ON "submissions" USING btree ("next_check_at");--> statement-breakpoint
-- Posts already being tracked are due at once.
UPDATE "submissions" SET "next_check_at" = now() WHERE "state" NOT IN ('rejected_auto', 'rejected', 'removed');
