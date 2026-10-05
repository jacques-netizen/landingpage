ALTER TABLE "notifications" ADD COLUMN "email_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "email_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "email_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "emailed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_new_campaigns" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "notifications_email_pending" ON "notifications" USING btree ("created_at") WHERE "notifications"."email_status" in ('pending', 'sending');--> statement-breakpoint
CREATE INDEX "notifications_user_created" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_email_status_check" CHECK (email_status in ('pending','sending','sent','skipped','failed'));--> statement-breakpoint
-- Notifications written before email sending existed are not emailed now.
UPDATE "notifications" SET "email_status" = 'skipped';
