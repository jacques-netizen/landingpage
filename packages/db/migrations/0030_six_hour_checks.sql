-- Owner decision 2026-10-14: after a post's first 72 hours, views are checked every 6 hours, not hourly.
-- The first 72 hours stay hourly. Applies to a stored value too.
WITH changed AS (
  UPDATE "settings"
    SET "value" = jsonb_set("value", '{until_close_hours}', '6'::jsonb),
        "updated_at" = now()
    WHERE "key" = 'view_check_intervals'
      AND ("value"->>'until_close_hours')::int <> 6
    RETURNING "value"
)
INSERT INTO "audit_log" ("actor_id", "action", "entity", "entity_id", "after")
  SELECT NULL, 'settings.update', 'settings', 'view_check_intervals', jsonb_build_object('value', "value", 'via', 'owner decision 2026-10-14')
  FROM changed;
