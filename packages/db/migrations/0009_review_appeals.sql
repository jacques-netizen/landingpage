ALTER TABLE "appeals" ADD COLUMN "previous_state" text;--> statement-breakpoint
ALTER TABLE "appeals" ADD COLUMN "links" text[];--> statement-breakpoint
ALTER TABLE "warnings" ADD COLUMN "submission_id" uuid;--> statement-breakpoint
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;