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
