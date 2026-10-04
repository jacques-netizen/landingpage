-- citext for case-insensitive emails, pgcrypto for gen_random_uuid on older Postgres.
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
