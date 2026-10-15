ALTER TABLE "submissions" ADD COLUMN "verified_views" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "view_proofs" ADD COLUMN "flag" text;--> statement-breakpoint
-- Proofs approved before this change count as verifications: the views they set stand as verified.
UPDATE "submissions" s SET "verified_views" = p.set_views
  FROM (SELECT DISTINCT ON (submission_id) submission_id, set_views FROM "view_proofs"
        WHERE status = 'approved' AND set_views IS NOT NULL ORDER BY submission_id, reviewed_at DESC) p
  WHERE p.submission_id = s.id AND p.set_views > s."verified_views";
