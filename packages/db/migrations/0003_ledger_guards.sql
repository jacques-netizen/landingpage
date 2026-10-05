-- Ledger guarantees (02_DATA_AND_MONEY.md sections 1 to 3), checked at commit so a transaction can
-- insert all of its entries first:
--   every transaction's entries sum to zero and it has at least two entries;
--   guarded accounts (everything but the outside world) never go below zero.
CREATE OR REPLACE FUNCTION ledger_check_entry() RETURNS trigger AS $$
DECLARE
  tx_sum bigint;
  tx_count integer;
  acct_kind text;
  acct_balance bigint;
BEGIN
  SELECT coalesce(sum(amount_cents), 0), count(*) INTO tx_sum, tx_count
    FROM ledger_entries WHERE transaction_id = NEW.transaction_id;
  IF tx_sum <> 0 OR tx_count < 2 THEN
    RAISE EXCEPTION 'ledger transaction % does not balance (sum %, % entries)', NEW.transaction_id, tx_sum, tx_count;
  END IF;
  SELECT kind INTO acct_kind FROM ledger_accounts WHERE id = NEW.account_id;
  IF acct_kind <> 'external' THEN
    SELECT coalesce(sum(amount_cents), 0) INTO acct_balance FROM ledger_entries WHERE account_id = NEW.account_id;
    IF acct_balance < 0 THEN
      RAISE EXCEPTION 'ledger account % (%) would go below zero (%)', NEW.account_id, acct_kind, acct_balance;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER ledger_entries_balanced
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_check_entry();
--> statement-breakpoint
-- Money rows are never edited or deleted. Corrections are new rows.
CREATE OR REPLACE FUNCTION ledger_block_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger rows cannot be changed; post a correction instead';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER ledger_entries_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION ledger_block_changes();
--> statement-breakpoint
CREATE TRIGGER ledger_transactions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON ledger_transactions
  FOR EACH STATEMENT EXECUTE FUNCTION ledger_block_changes();
