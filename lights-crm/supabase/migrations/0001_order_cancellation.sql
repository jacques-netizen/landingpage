-- =============================================
-- 17 Prime Home — Migration 0001: Order cancellation
-- Run in Supabase SQL Editor AFTER schema.sql
--
-- Adds the ability to cancel an order and have it:
--   • restore stock to inventory (only if the order had deducted stock)
--   • log a stock_adjustments audit row per item
--   • void the linked invoice and reverse its payments
-- =============================================

-- 1. Track whether an order has deducted stock (POS sales set this true).
alter table orders
  add column if not exists stock_deducted boolean not null default false;

-- 2. Allow invoices to be voided.
alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check
  check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void'));

-- 3. Correct the default VAT rate for Ghana (was 21, should be 12.5).
alter table invoices alter column tax_rate set default 12.5;

-- 4. Cancellation routine — one atomic transaction.
create or replace function cancel_order(p_order_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    orders%rowtype;
  v_item     record;
  v_invoice  record;
  v_pay      record;
  v_uid      uuid := auth.uid();
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'Order % is already cancelled', v_order.order_number;
  end if;

  -- Restore stock only if it was actually deducted (POS sales).
  if v_order.stock_deducted then
    for v_item in select product_id, qty from order_items where order_id = p_order_id loop
      update products set stock_qty = stock_qty + v_item.qty where id = v_item.product_id;
      insert into stock_adjustments (product_id, qty_change, reason, adjusted_by)
      values (
        v_item.product_id,
        v_item.qty,
        'Order ' || v_order.order_number || ' cancelled' || coalesce(': ' || p_reason, ''),
        v_uid
      );
    end loop;
  end if;

  -- Mark the order cancelled and record the reason in notes.
  update orders set
    status = 'cancelled',
    stock_deducted = false,
    notes = coalesce(notes || E'\n', '') || 'CANCELLED: ' || coalesce(p_reason, 'no reason given')
  where id = p_order_id;

  -- Void linked invoice(s) and reverse their payments.
  for v_invoice in select id, invoice_number from invoices where order_id = p_order_id loop
    for v_pay in select amount, method from payments where invoice_id = v_invoice.id and amount > 0 loop
      insert into payments (invoice_id, amount, method, reference, recorded_by)
      values (
        v_invoice.id,
        -v_pay.amount,
        v_pay.method,
        'Reversal — order ' || v_order.order_number || ' cancelled',
        v_uid
      );
    end loop;
    update invoices set status = 'void' where id = v_invoice.id;
  end loop;
end;
$$;

grant execute on function cancel_order(uuid, text) to authenticated;
