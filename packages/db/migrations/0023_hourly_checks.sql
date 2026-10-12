-- Client report brief (2026-10-12): every post is checked at least hourly while its campaign runs.
-- Applies to a stored value too; posts scheduled further out are brought forward.
WITH changed AS (
  UPDATE "settings"
    SET "value" = jsonb_set(jsonb_set("value", '{first_72h_hours}', '1'::jsonb), '{until_close_hours}', '1'::jsonb),
        "updated_at" = now()
    WHERE "key" = 'view_check_intervals'
      AND (("value"->>'first_72h_hours')::int <> 1 OR ("value"->>'until_close_hours')::int <> 1)
    RETURNING "value"
)
INSERT INTO "audit_log" ("actor_id", "action", "entity", "entity_id", "after")
  SELECT NULL, 'settings.update', 'settings', 'view_check_intervals', jsonb_build_object('value', "value", 'via', 'client report brief 2026-10-12')
  FROM changed;
--> statement-breakpoint
UPDATE "submissions" s SET "next_check_at" = now() + interval '1 hour'
  FROM "campaigns" c
  WHERE c."id" = s."campaign_id" AND c."status" IN ('live', 'closing')
    AND s."next_check_at" > now() + interval '1 hour';
