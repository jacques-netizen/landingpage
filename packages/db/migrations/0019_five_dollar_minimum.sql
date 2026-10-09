-- Owner's testing report (2026-10-08): the minimum withdrawal is $5. Applies to a stored value too,
-- since one saved on the settings page would otherwise keep the old minimum. Audited.
WITH changed AS (
  UPDATE "settings" SET "value" = '500'::jsonb, "updated_at" = now()
    WHERE "key" = 'withdrawal_min_cents' AND "value" <> '500'::jsonb
    RETURNING "value"
)
INSERT INTO "audit_log" ("actor_id", "action", "entity", "entity_id", "after")
  SELECT NULL, 'settings.update', 'settings', 'withdrawal_min_cents', '{"value":500,"via":"owner request 2026-10-08"}'::jsonb
  FROM changed;
