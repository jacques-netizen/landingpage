-- Keep updated_at current on every table that has it.
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_name = c.table_name AND tb.table_schema = c.table_schema
    WHERE c.table_schema = 'public' AND c.column_name = 'updated_at' AND tb.table_type = 'BASE TABLE'
      AND c.table_name <> 'audit_log'
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', 'set_updated_at_' || t.table_name, t.table_name);
  END LOOP;
END $$;
--> statement-breakpoint
-- Audit rows cannot be edited or deleted by the application.
CREATE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log rows cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
--> statement-breakpoint
-- Money rows are never edited or deleted. Corrections are new rows.
CREATE FUNCTION ledger_rows_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows cannot be updated or deleted', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER ledger_transactions_immutable BEFORE UPDATE OR DELETE ON ledger_transactions FOR EACH ROW EXECUTE FUNCTION ledger_rows_immutable();
--> statement-breakpoint
CREATE TRIGGER ledger_entries_immutable BEFORE UPDATE OR DELETE ON ledger_entries FOR EACH ROW EXECUTE FUNCTION ledger_rows_immutable();
--> statement-breakpoint
-- A creator cannot have two withdrawal requests in 'requested' at the same time.
CREATE UNIQUE INDEX withdrawals_one_requested_per_creator ON withdrawals (creator_id) WHERE status = 'requested';
--> statement-breakpoint
-- A campaign needs a platform, and a budget cannot be below zero is enforced by the ledger in Phase 1.
ALTER TABLE campaigns ADD CONSTRAINT campaigns_platforms_check CHECK (cardinality(platforms) > 0 AND platforms <@ ARRAY['tiktok','instagram','youtube','x']::text[]);
