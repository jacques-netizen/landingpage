ALTER TABLE "campaigns" ADD COLUMN "client_budget_cents" bigint;--> statement-breakpoint
-- Owner request 2026-10-17: the Davido X Winnerman-Audio client report shows a $2,000 budget.
UPDATE "campaigns" SET "client_budget_cents" = 200000 WHERE "title" = 'Davido X Winnerman-Audio';
