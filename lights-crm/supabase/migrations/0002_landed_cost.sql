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
