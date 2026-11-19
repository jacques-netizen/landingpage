CREATE TABLE "post_insights" (
	"submission_id" uuid PRIMARY KEY NOT NULL,
	"views" bigint NOT NULL,
	"views_by_app" jsonb,
	"likes" bigint,
	"comments" bigint,
	"reposts" bigint,
	"saves" bigint,
	"extra" jsonb,
	"source" text NOT NULL,
	"read_on" date NOT NULL,
	"set_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_insights" ADD CONSTRAINT "post_insights_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_insights" ADD CONSTRAINT "post_insights_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;