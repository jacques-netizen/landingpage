-- Owner request (2026-10-07): kymencarter@gmail.com is an admin. If the account does not exist yet it
-- is created without a password, so only the owner of the inbox can sign in (by email link) and
-- nobody else can sign up with the address. Audited like every staff grant.
INSERT INTO "users" ("email") VALUES ('kymencarter@gmail.com') ON CONFLICT ("email") DO NOTHING;
--> statement-breakpoint
INSERT INTO "creator_profiles" ("user_id")
  SELECT "id" FROM "users" WHERE "email" = 'kymencarter@gmail.com'
  ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH granted AS (
  INSERT INTO "staff_roles" ("user_id", "role")
    SELECT "id", 'admin' FROM "users" WHERE "email" = 'kymencarter@gmail.com'
    ON CONFLICT DO NOTHING
    RETURNING "user_id"
)
INSERT INTO "audit_log" ("actor_id", "action", "entity", "entity_id", "after")
  SELECT NULL, 'staff.grant', 'user', "user_id"::text, '{"role":"admin","via":"owner request 2026-10-07"}'::jsonb
  FROM granted;
