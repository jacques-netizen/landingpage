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
