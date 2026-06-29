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
