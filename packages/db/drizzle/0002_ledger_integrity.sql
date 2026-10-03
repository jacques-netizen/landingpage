-- Every ledger transaction must have at least two entries and the entries must sum to zero.
-- Checked at commit, so entries can be inserted one by one inside a transaction.
CREATE FUNCTION ledger_check_balanced() RETURNS trigger AS $$
DECLARE
  tx_id uuid;
  n integer;
  total numeric;
BEGIN
  IF TG_TABLE_NAME = 'ledger_transactions' THEN
    tx_id := NEW.id;
  ELSE
    tx_id := NEW.transaction_id;
  END IF;
  SELECT count(*), coalesce(sum(amount_cents), 0) INTO n, total FROM ledger_entries WHERE transaction_id = tx_id;
  IF n < 2 THEN
    RAISE EXCEPTION 'ledger transaction % needs at least two entries (has %)', tx_id, n;
  END IF;
  IF total <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % does not balance, the sum of its entries is %', tx_id, total;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER ledger_transactions_balanced
  AFTER INSERT ON ledger_transactions DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_check_balanced();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER ledger_entries_balanced
  AFTER INSERT ON ledger_entries DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_check_balanced();
--> statement-breakpoint
-- Campaign budgets, creator balances, client holding and payouts in transit never go below zero.
-- This is the backstop. The engine also locks accounts so concurrent jobs wait for each other.
CREATE FUNCTION ledger_check_not_negative() RETURNS trigger AS $$
DECLARE
  account_kind text;
  balance numeric;
BEGIN
  IF NEW.amount_cents >= 0 THEN
    RETURN NULL;
  END IF;
  SELECT kind INTO account_kind FROM ledger_accounts WHERE id = NEW.account_id;
  IF account_kind IN ('campaign_budget', 'creator_pending', 'creator_available', 'client_funds_holding', 'payout_in_transit') THEN
    SELECT coalesce(sum(amount_cents), 0) INTO balance FROM ledger_entries WHERE account_id = NEW.account_id;
    IF balance < 0 THEN
      RAISE EXCEPTION 'ledger account % (%) would go below zero, balance %', NEW.account_id, account_kind, balance;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER ledger_entries_not_negative
  AFTER INSERT ON ledger_entries DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_check_not_negative();
