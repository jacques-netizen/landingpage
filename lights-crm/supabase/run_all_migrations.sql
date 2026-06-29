-- =============================================
-- 17 Prime Home — ALL migrations combined (run once, top to bottom)
-- Safe to re-run: uses add column if not exists / create or replace.
-- =============================================

-- >>>>>>>>>>>>>>>>>>>> 0001_order_cancellation.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> 0002_landed_cost.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================
-- 17 Prime Home — Migration 0002: Landed cost & margin
-- Run in Supabase SQL Editor AFTER 0001_order_cancellation.sql
--
-- Adds true landed cost per product (supplier price + freight + Tema
-- duty/VAT/levies) so margin is real, not guessed. order_items snapshot
-- the cost at sale time so historical margin reports stay accurate even
-- when a product's landed cost changes on the next container.
-- =============================================

-- Current landed unit cost of a product (in GH₵).
alter table products
  add column if not exists cost_price numeric(10,2) not null default 0;

-- Cost snapshot captured when the line is sold/ordered.
alter table order_items
  add column if not exists cost_price numeric(10,2) not null default 0;


-- >>>>>>>>>>>>>>>>>>>> 0003_multi_location.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================
-- 17 Prime Home — Migration 0003: Multi-location stock
-- Run in Supabase SQL Editor AFTER 0002_landed_cost.sql
--
-- Splits stock into two locations: the showroom floor (sellable at the
-- POS) and the warehouse (bulk/backup). products.stock_qty is now the
-- SHOWROOM quantity; warehouse_qty is the new backup quantity. Stock can
-- be transferred between them. On-hand = stock_qty + warehouse_qty.
-- =============================================

alter table products
  add column if not exists warehouse_qty integer not null default 0;


-- >>>>>>>>>>>>>>>>>>>> 0004_delivery_tracking.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================
-- 17 Prime Home — Migration 0004: Delivery tracking
-- Run in Supabase SQL Editor AFTER 0003_multi_location.sql
--
-- Captures where an order is going and proof that it was delivered.
-- =============================================

alter table orders add column if not exists delivery_address text;
alter table orders add column if not exists delivered_at timestamptz;
alter table orders add column if not exists received_by text;       -- person who took delivery (proof)
alter table orders add column if not exists delivery_note text;


-- >>>>>>>>>>>>>>>>>>>> 0005_purchase_orders.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================
-- 17 Prime Home — Migration 0005: Supplier purchase orders
-- Run in Supabase SQL Editor AFTER 0004_delivery_tracking.sql
--
-- Tracks what's been ordered from overseas suppliers and what's in
-- transit, and receives a PO straight into warehouse stock (updating
-- landed cost) so buying connects to the stock position.
-- =============================================

create table if not exists purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  po_number text not null unique,
  supplier_id uuid references suppliers(id),
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'in_transit', 'received', 'cancelled')),
  order_date date,
  expected_arrival date,
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists purchase_order_items (
  id uuid primary key default uuid_generate_v4(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid references products(id),
  description text not null,
  qty integer not null default 1,
  unit_cost numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

-- PO numbering: PO-00001
create sequence if not exists po_number_seq start 1000;

create or replace function generate_po_number()
returns trigger language plpgsql as $$
begin
  new.po_number = 'PO-' || lpad(nextval('po_number_seq')::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists purchase_orders_set_number on purchase_orders;
create trigger purchase_orders_set_number
  before insert on purchase_orders
  for each row execute procedure generate_po_number();

drop trigger if exists purchase_orders_updated_at on purchase_orders;
create trigger purchase_orders_updated_at
  before update on purchase_orders
  for each row execute procedure set_updated_at();

-- Receive a PO into warehouse stock and refresh each product's landed cost.
create or replace function receive_purchase_order(p_po_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po   purchase_orders%rowtype;
  v_item record;
  v_uid  uuid := auth.uid();
begin
  select * into v_po from purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'Purchase order % not found', p_po_id;
  end if;
  if v_po.status = 'received' then
    raise exception 'Purchase order % is already received', v_po.po_number;
  end if;
  if v_po.status = 'cancelled' then
    raise exception 'Purchase order % is cancelled', v_po.po_number;
  end if;

  for v_item in
    select product_id, qty, unit_cost from purchase_order_items where po_id = p_po_id and product_id is not null
  loop
    update products
      set warehouse_qty = warehouse_qty + v_item.qty,
          cost_price = case when v_item.unit_cost > 0 then v_item.unit_cost else cost_price end
    where id = v_item.product_id;

    insert into stock_adjustments (product_id, qty_change, reason, adjusted_by)
    values (v_item.product_id, v_item.qty,
            'PO ' || v_po.po_number || ' received → warehouse', v_uid);
  end loop;

  update purchase_orders set status = 'received' where id = p_po_id;
end;
$$;

grant execute on function receive_purchase_order(uuid) to authenticated;

-- RLS (mirror the rest of the app: any authenticated user)
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;

drop policy if exists "Auth read purchase_orders" on purchase_orders;
drop policy if exists "Auth write purchase_orders" on purchase_orders;
drop policy if exists "Auth read purchase_order_items" on purchase_order_items;
drop policy if exists "Auth write purchase_order_items" on purchase_order_items;

create policy "Auth read purchase_orders" on purchase_orders for select using (auth.uid() is not null);
create policy "Auth write purchase_orders" on purchase_orders for all using (auth.uid() is not null);
create policy "Auth read purchase_order_items" on purchase_order_items for select using (auth.uid() is not null);
create policy "Auth write purchase_order_items" on purchase_order_items for all using (auth.uid() is not null);


-- >>>>>>>>>>>>>>>>>>>> 0006_quotes.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================
-- 17 Prime Home — Migration 0006: Quotes
-- Run in Supabase SQL Editor AFTER 0005_purchase_orders.sql
--
-- Formal priced quotations for designers / B2B. A quote does not touch
-- stock or revenue; when accepted it converts into an invoice in one click.
-- =============================================

create table if not exists quotes (
  id uuid primary key default uuid_generate_v4(),
  quote_number text not null unique,
  customer_id uuid not null references customers(id),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted')),
  valid_until date,
  subtotal numeric(10,2) not null default 0,
  discount_total numeric(10,2) not null default 0,
  tax_rate numeric(5,2) not null default 12.5,
  tax_total numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  notes text,
  converted_invoice_id uuid references invoices(id),
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists quote_items (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references quotes(id) on delete cascade,
  product_id uuid references products(id),
  description text not null,
  qty integer not null default 1,
  unit_price numeric(10,2) not null,
  discount_pct numeric(5,2) not null default 0,
  line_total numeric(10,2) not null
);

create sequence if not exists quote_number_seq start 1000;

create or replace function generate_quote_number()
returns trigger language plpgsql as $$
begin
  new.quote_number = 'QUO-' || lpad(nextval('quote_number_seq')::text, 5, '0');
  return new;
end;
$$;

drop trigger if exists quotes_set_number on quotes;
create trigger quotes_set_number
  before insert on quotes
  for each row execute procedure generate_quote_number();

drop trigger if exists quotes_updated_at on quotes;
create trigger quotes_updated_at
  before update on quotes
  for each row execute procedure set_updated_at();

-- Convert an accepted quote into an invoice (status 'sent'). Idempotent.
create or replace function convert_quote_to_invoice(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote      quotes%rowtype;
  v_invoice_id uuid;
begin
  select * into v_quote from quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Quote % not found', p_quote_id;
  end if;
  if v_quote.converted_invoice_id is not null then
    return v_quote.converted_invoice_id;
  end if;

  insert into invoices (customer_id, status, subtotal, discount_total, tax_rate, tax_total, total, amount_paid, notes)
  values (v_quote.customer_id, 'sent', v_quote.subtotal, v_quote.discount_total, v_quote.tax_rate, v_quote.tax_total, v_quote.total, 0, v_quote.notes)
  returning id into v_invoice_id;

  insert into invoice_items (invoice_id, product_id, description, qty, unit_price, discount_pct, line_total)
  select v_invoice_id, product_id, description, qty, unit_price, discount_pct, line_total
  from quote_items where quote_id = p_quote_id;

  update quotes set status = 'converted', converted_invoice_id = v_invoice_id where id = p_quote_id;
  return v_invoice_id;
end;
$$;

grant execute on function convert_quote_to_invoice(uuid) to authenticated;

-- RLS
alter table quotes enable row level security;
alter table quote_items enable row level security;

drop policy if exists "Auth read quotes" on quotes;
drop policy if exists "Auth write quotes" on quotes;
drop policy if exists "Auth read quote_items" on quote_items;
drop policy if exists "Auth write quote_items" on quote_items;

create policy "Auth read quotes" on quotes for select using (auth.uid() is not null);
create policy "Auth write quotes" on quotes for all using (auth.uid() is not null);
create policy "Auth read quote_items" on quote_items for select using (auth.uid() is not null);
create policy "Auth write quote_items" on quote_items for all using (auth.uid() is not null);


