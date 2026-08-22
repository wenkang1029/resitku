-- ================================================================
-- Migration 005: Add duplicate detection columns to receipts
-- ================================================================

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS possible_duplicate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_of_id uuid REFERENCES public.receipts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.receipts.possible_duplicate IS
  'True if extraction detected an existing receipt with identical merchant, total_amount, and transaction_date.';

COMMENT ON COLUMN public.receipts.duplicate_of_id IS
  'Foreign key referencing the original matching receipt if possible_duplicate is true.';
