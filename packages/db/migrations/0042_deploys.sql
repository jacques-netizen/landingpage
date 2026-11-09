CREATE TABLE "deploys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commit_sha" text NOT NULL,
	"branch" text,
	"message" text,
	"author" text,
	"railway_deployment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deploys_commit_sha_unique" UNIQUE("commit_sha")
);
