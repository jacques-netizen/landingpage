CREATE TABLE "answers" (
	"session_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"value" jsonb NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"name" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"storage_key" text,
	"generated_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"content_manifest_version" text,
	"error" text,
	CONSTRAINT "guides_lead_id_unique" UNIQUE("lead_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"email" text NOT NULL,
	"ig_handle" text,
	"company" text,
	"consent_text_version" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"qualified" boolean NOT NULL,
	"human_priority" boolean NOT NULL,
	"path" text NOT NULL,
	"answers" jsonb NOT NULL,
	"ghl_contact_id" text,
	"ghl_opportunity_id" text,
	"meta_event_id" text NOT NULL,
	"fbp" text,
	"fbc" text,
	"client_ip" text,
	"user_agent" text,
	"booked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"variant" text NOT NULL,
	"progress_mode" text NOT NULL,
	"device_class" text NOT NULL,
	"last_scene" text,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "unsubscribes" (
	"email" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guides" ADD CONSTRAINT "guides_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "answers_session_question" ON "answers" USING btree ("session_id","question_id");--> statement-breakpoint
CREATE INDEX "events_name_at" ON "events" USING btree ("name","at");--> statement-breakpoint
CREATE INDEX "events_session" ON "events" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_lead_kind" ON "jobs" USING btree ("lead_id","kind");--> statement-breakpoint
CREATE INDEX "jobs_status_run_after" ON "jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_session" ON "leads" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "leads_email" ON "leads" USING btree ("email");