-- Migration 007: Universal confirm flow, auto-expire, and include_in_records
-- Adds columns needed for the mandatory confirm step and auto-expiry

-- auto_confirmed: marks receipts auto-confirmed after 7 days without action
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS auto_confirmed boolean NOT NULL DEFAULT false;

-- include_in_records: per-line-item toggle (false = excluded from totals)
ALTER TABLE public.receipt_line_items
  ADD COLUMN IF NOT EXISTS include_in_records boolean NOT NULL DEFAULT true;
