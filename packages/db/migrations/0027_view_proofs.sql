CREATE TABLE "view_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"claimed_views" bigint,
	"screenshot_file_id" uuid,
	"recording_file_id" uuid,
	"note" text,
	"submitted_at" timestamp with time zone,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"set_views" bigint,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "view_proofs_status_check" CHECK (status in ('requested','submitted','approved','rejected'))
);
--> statement-breakpoint
ALTER TABLE "view_proofs" ADD CONSTRAINT "view_proofs_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_proofs" ADD CONSTRAINT "view_proofs_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_proofs" ADD CONSTRAINT "view_proofs_screenshot_file_id_files_id_fk" FOREIGN KEY ("screenshot_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_proofs" ADD CONSTRAINT "view_proofs_recording_file_id_files_id_fk" FOREIGN KEY ("recording_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_proofs" ADD CONSTRAINT "view_proofs_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "view_proofs_submission" ON "view_proofs" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "view_proofs_status" ON "view_proofs" USING btree ("status");