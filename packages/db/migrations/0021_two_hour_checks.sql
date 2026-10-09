-- Testing report (2026-10-08): post stats refresh every 2 hours while a campaign runs. Applies to a
-- stored value too. Posts already scheduled further out pick up the new pace after their next check.
WITH changed AS (
  UPDATE "settings" SET "value" = jsonb_set("value", '{until_close_hours}', '2'::jsonb), "updated_at" = now()
    WHERE "key" = 'view_check_intervals' AND ("value"->>'until_close_hours')::int <> 2
    RETURNING "value"
)
INSERT INTO "audit_log" ("actor_id", "action", "entity", "entity_id", "after")
  SELECT NULL, 'settings.update', 'settings', 'view_check_intervals', jsonb_build_object('value', "value", 'via', 'testing report 2026-10-08')
  FROM changed;
--> statement-breakpoint
-- Bring posts on a live campaign that wait longer than 2 hours forward, so the change shows at once.
UPDATE "submissions" s SET "next_check_at" = now() + interval '2 hours'
  FROM "campaigns" c
  WHERE c."id" = s."campaign_id" AND c."status" IN ('live', 'closing')
    AND s."next_check_at" > now() + interval '2 hours';
