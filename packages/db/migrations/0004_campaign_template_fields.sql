ALTER TABLE "campaigns" ADD COLUMN "template_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "terms_draft_markdown" text;