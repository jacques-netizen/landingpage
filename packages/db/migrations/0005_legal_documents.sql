CREATE TABLE "legal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"body_markdown" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "legal_documents_slug_version" UNIQUE("slug","version"),
	CONSTRAINT "legal_documents_slug_check" CHECK (slug in ('terms','privacy','campaign-rules','cookies','brand-terms'))
);
--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;