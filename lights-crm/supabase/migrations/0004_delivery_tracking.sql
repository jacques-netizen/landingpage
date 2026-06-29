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
