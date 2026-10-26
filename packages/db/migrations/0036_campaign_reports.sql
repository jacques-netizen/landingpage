CREATE TABLE "campaign_report_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"parent_id" uuid,
	"spec" jsonb NOT NULL,
	"data" jsonb NOT NULL,
	"note" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_report_versions_number" UNIQUE("report_id","number")
);
--> statement-breakpoint
CREATE TABLE "campaign_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"week_number" integer,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_version_id" uuid,
	"published_version_id" uuid,
	"published_at" timestamp with time zone,
	"published_data" jsonb,
	"covers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_reports_slug_unique" UNIQUE("slug"),
	CONSTRAINT "campaign_reports_kind_check" CHECK (kind in ('week','final')),
	CONSTRAINT "campaign_reports_status_check" CHECK (status in ('draft','published'))
);
--> statement-breakpoint
ALTER TABLE "campaign_report_versions" ADD CONSTRAINT "campaign_report_versions_report_id_campaign_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."campaign_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_report_versions" ADD CONSTRAINT "campaign_report_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_reports" ADD CONSTRAINT "campaign_reports_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_reports" ADD CONSTRAINT "campaign_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_reports_campaign" ON "campaign_reports" USING btree ("campaign_id");