-- Migration 008: Add claimed_amount to receipts
-- claimed_amount = SUM of included line items after user toggling.
-- NULL = nothing excluded (use total_amount for all calculations).
-- total_amount remains IMMUTABLE as the original extracted document total.
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS claimed_amount numeric NULL;

COMMENT ON COLUMN public.receipts.claimed_amount IS
  'Sum of included line items at confirm time. NULL means nothing was excluded — use total_amount. Never overwrite total_amount; it stays as the original receipt figure for audit and duplicate detection.';
