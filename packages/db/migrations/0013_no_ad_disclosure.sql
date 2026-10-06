ALTER TABLE "campaigns" ALTER COLUMN "require_ad_disclosure" SET DEFAULT false;--> statement-breakpoint
-- Owner decision: no campaign requires an ad disclosure.
UPDATE "campaigns" SET "require_ad_disclosure" = false;
--> statement-breakpoint
UPDATE "campaigns" SET "required_hashtags" = array(select t from unnest("required_hashtags") t where lower(t) not in ('#ad', 'ad', '#sponsored', '#paidpartnership')) WHERE "required_hashtags" IS NOT NULL;
