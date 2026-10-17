ALTER TABLE "campaigns" ADD COLUMN "client_spend_factor" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Owner rule 2026-10-17: the Marrz-Audio client report counts spend at twice the clippers' earnings.
UPDATE "campaigns" SET "client_spend_factor" = 2 WHERE "title" = 'Marrz-Audio';
