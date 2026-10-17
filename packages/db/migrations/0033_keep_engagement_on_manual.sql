-- Owner report 2026-10-17: posts whose views were set from analytics showed 0 likes, comments and shares,
-- because the manual snapshot carried no engagement. Fill those from the last figures a check read.
UPDATE "view_snapshots" v SET
  "likes" = coalesce(v."likes", (SELECT x."likes" FROM "view_snapshots" x
    WHERE x."submission_id" = v."submission_id" AND x."taken_at" < v."taken_at" AND x."likes" IS NOT NULL
    ORDER BY x."taken_at" DESC LIMIT 1)),
  "comments" = coalesce(v."comments", (SELECT x."comments" FROM "view_snapshots" x
    WHERE x."submission_id" = v."submission_id" AND x."taken_at" < v."taken_at" AND x."comments" IS NOT NULL
    ORDER BY x."taken_at" DESC LIMIT 1)),
  "shares" = coalesce(v."shares", (SELECT x."shares" FROM "view_snapshots" x
    WHERE x."submission_id" = v."submission_id" AND x."taken_at" < v."taken_at" AND x."shares" IS NOT NULL
    ORDER BY x."taken_at" DESC LIMIT 1))
WHERE v."source" = 'manual' AND (v."likes" IS NULL OR v."comments" IS NULL OR v."shares" IS NULL);
--> statement-breakpoint
UPDATE "view_snapshot_days" d SET
  "likes" = coalesce(d."likes", (SELECT x."likes" FROM "view_snapshots" x
    WHERE x."submission_id" = d."submission_id" AND x."taken_at" <= d."taken_at" AND x."likes" IS NOT NULL
    ORDER BY x."taken_at" DESC LIMIT 1)),
  "comments" = coalesce(d."comments", (SELECT x."comments" FROM "view_snapshots" x
    WHERE x."submission_id" = d."submission_id" AND x."taken_at" <= d."taken_at" AND x."comments" IS NOT NULL
    ORDER BY x."taken_at" DESC LIMIT 1)),
  "shares" = coalesce(d."shares", (SELECT x."shares" FROM "view_snapshots" x
    WHERE x."submission_id" = d."submission_id" AND x."taken_at" <= d."taken_at" AND x."shares" IS NOT NULL
    ORDER BY x."taken_at" DESC LIMIT 1))
WHERE d."likes" IS NULL OR d."comments" IS NULL OR d."shares" IS NULL;
