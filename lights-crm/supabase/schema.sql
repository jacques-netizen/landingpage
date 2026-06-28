-- =============================================
-- Lights CRM — Supabase Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- PROFILES (extends auth.users)
-- =============================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'sales' check (role in ('admin', 'sales', 'warehouse', 'accountant')),
  avatar_url text,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- =============================================
-- CATEGORIES
-- =============================================
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  parent_id uuid references categories(id)
);

insert into categories (name, slug) values
  ('Chandeliers', 'chandeliers'),
  ('Pendant Lights', 'pendant-lights'),
  ('Wall Lights', 'wall-lights'),
  ('Floor Lamps', 'floor-lamps'),
  ('Table Lamps', 'table-lamps'),
  ('Ceiling Lights', 'ceiling-lights'),
  ('Outdoor Lighting', 'outdoor-lighting'),
  ('LED Strips', 'led-strips'),
  ('Accessories', 'accessories');

-- =============================================
-- SUPPLIERS
-- =============================================
create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz default now()
);

-- =============================================
-- PRODUCTS
-- =============================================
create table products (
  id uuid primary key default uuid_generate_v4(),
  sku text not null unique,
  name text not null,
  description text,
  category_id uuid references categories(id),
  supplier_id uuid references suppliers(id),
  brand text,
  unit_price numeric(10,2) not null default 0,
  stock_qty integer not null default 0,
  low_stock_threshold integer not null default 5,
  is_custom_order boolean not null default false,
  images text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on products (sku);
create index on products (category_id);
create index on products (stock_qty);

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_updated_at
  before update on products
  for each row execute procedure set_updated_at();

-- =============================================
-- STOCK ADJUSTMENTS
-- =============================================
create table stock_adjustments (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id),
  qty_change integer not null,
  reason text not null,
  adjusted_by uuid not null references profiles(id),
  adjusted_at timestamptz default now()
);

-- =============================================
-- CUSTOMERS
-- =============================================
create table customers (
  id uuid primary key default uuid_generate_v4(),
  type text not null default 'retail' check (type in ('retail', 'b2b')),
  name text not null,
  company_name text,
  phone text,
  whatsapp text,
  email text,
  address text,
  notes text,
  tags text[] default '{}',
  created_at timestamptz default now()
);

create index on customers (type);
create index on customers (name);

-- =============================================
-- ORDERS
-- =============================================
create table orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text not null unique,
  customer_id uuid references customers(id),
  channel text not null default 'walk_in' check (channel in ('walk_in', 'phone', 'whatsapp', 'b2b')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'in_progress', 'ready', 'delivered', 'cancelled')),
  notes text,
  expected_delivery date,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger orders_updated_at
  before update on orders
  for each row execute procedure set_updated_at();

-- Auto-generate order number
create sequence order_number_seq start 1000;

create or replace function generate_order_number()
returns trigger language plpgsql as $$
begin
  new.order_number = 'ORD-' || lpad(nextval('order_number_seq')::text, 5, '0');
  return new;
end;
$$;

create trigger orders_set_number
  before insert on orders
  for each row execute procedure generate_order_number();

-- =============================================
-- ORDER ITEMS
-- =============================================
create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  qty integer not null default 1,
  unit_price numeric(10,2) not null,
  discount_pct numeric(5,2) not null default 0,
  is_custom_order boolean not null default false,
  supplier_id uuid references suppliers(id),
  expected_arrival date,
  created_at timestamptz default now()
);

-- =============================================
-- INVOICES
-- =============================================
create table invoices (
  id uuid primary key default uuid_generate_v4(),
  invoice_number text not null unique,
  order_id uuid references orders(id),
  customer_id uuid not null references customers(id),
  status text not null default 'draft' check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue')),
  subtotal numeric(10,2) not null default 0,
  discount_total numeric(10,2) not null default 0,
  tax_rate numeric(5,2) not null default 21,
  tax_total numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  due_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger invoices_updated_at
  before update on invoices
  for each row execute procedure set_updated_at();

create sequence invoice_number_seq start 1000;

create or replace function generate_invoice_number()
returns trigger language plpgsql as $$
begin
  new.invoice_number = 'INV-' || lpad(nextval('invoice_number_seq')::text, 5, '0');
  return new;
end;
$$;

create trigger invoices_set_number
  before insert on invoices
  for each row execute procedure generate_invoice_number();

-- =============================================
-- INVOICE ITEMS
-- =============================================
create table invoice_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  product_id uuid references products(id),
  description text not null,
  qty integer not null default 1,
  unit_price numeric(10,2) not null,
  discount_pct numeric(5,2) not null default 0,
  line_total numeric(10,2) not null
);

-- =============================================
-- PAYMENTS
-- =============================================
create table payments (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references invoices(id),
  amount numeric(10,2) not null,
  method text not null check (method in ('cash', 'card', 'bank_transfer')),
  reference text,
  paid_at timestamptz default now(),
  recorded_by uuid not null references profiles(id)
);

-- Auto-update invoice amount_paid and status on payment
create or replace function update_invoice_on_payment()
returns trigger language plpgsql as $$
declare
  v_total numeric;
  v_paid numeric;
begin
  select total into v_total from invoices where id = new.invoice_id;
  select coalesce(sum(amount), 0) into v_paid from payments where invoice_id = new.invoice_id;

  update invoices set
    amount_paid = v_paid,
    status = case
      when v_paid >= v_total then 'paid'
      when v_paid > 0 then 'partially_paid'
      else status
    end
  where id = new.invoice_id;

  return new;
end;
$$;

create trigger payments_update_invoice
  after insert on payments
  for each row execute procedure update_invoice_on_payment();

-- =============================================
-- HELPER RPCs for dashboard & reports
-- =============================================
create or replace function get_sales_total(from_date date, to_date date)
returns numeric language sql as $$
  select coalesce(sum(total), 0)
  from invoices
  where status in ('paid', 'partially_paid')
    and created_at::date between from_date and to_date;
$$;

-- Daily revenue for bar chart (reports page)
create or replace function get_daily_revenue(from_ts timestamptz, to_ts timestamptz)
returns table(date text, revenue numeric) language sql as $$
  select
    created_at::date::text as date,
    coalesce(sum(amount_paid), 0) as revenue
  from invoices
  where status in ('paid', 'partially_paid')
    and created_at between from_ts and to_ts
  group by created_at::date
  order by created_at::date;
$$;

-- Monthly revenue for bar chart (longer periods)
create or replace function get_monthly_revenue(from_ts timestamptz, to_ts timestamptz)
returns table(month text, revenue numeric) language sql as $$
  select
    to_char(created_at, 'YYYY-MM') as month,
    coalesce(sum(amount_paid), 0) as revenue
  from invoices
  where status in ('paid', 'partially_paid')
    and created_at between from_ts and to_ts
  group by to_char(created_at, 'YYYY-MM')
  order by month;
$$;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table profiles enable row level security;
alter table products enable row level security;
alter table categories enable row level security;
alter table suppliers enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;
alter table stock_adjustments enable row level security;

-- Authenticated users can read/write their own company's data
-- (In a multi-tenant setup you'd add a company_id; for now all auth users share one company)

create policy "Auth users can read profiles" on profiles for select using (auth.uid() is not null);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

create policy "Auth read categories" on categories for select using (auth.uid() is not null);
create policy "Auth read suppliers" on suppliers for select using (auth.uid() is not null);
create policy "Auth write suppliers" on suppliers for all using (auth.uid() is not null);
create policy "Auth read products" on products for select using (auth.uid() is not null);
create policy "Auth write products" on products for all using (auth.uid() is not null);
create policy "Auth read customers" on customers for select using (auth.uid() is not null);
create policy "Auth write customers" on customers for all using (auth.uid() is not null);
create policy "Auth read orders" on orders for select using (auth.uid() is not null);
create policy "Auth write orders" on orders for all using (auth.uid() is not null);
create policy "Auth read order_items" on order_items for select using (auth.uid() is not null);
create policy "Auth write order_items" on order_items for all using (auth.uid() is not null);
create policy "Auth read invoices" on invoices for select using (auth.uid() is not null);
create policy "Auth write invoices" on invoices for all using (auth.uid() is not null);
create policy "Auth read invoice_items" on invoice_items for select using (auth.uid() is not null);
create policy "Auth write invoice_items" on invoice_items for all using (auth.uid() is not null);
create policy "Auth read payments" on payments for select using (auth.uid() is not null);
create policy "Auth write payments" on payments for all using (auth.uid() is not null);
create policy "Auth read stock_adjustments" on stock_adjustments for select using (auth.uid() is not null);
create policy "Auth write stock_adjustments" on stock_adjustments for all using (auth.uid() is not null);
