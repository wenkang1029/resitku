-- Migration 009: Consolidate claimed_amount calculation inside confirm_receipt_admin RPC
-- Ensures both Telegram bot and Web Dashboard compute identical claimed_amount
-- when confirming receipts with excluded line items.

CREATE OR REPLACE FUNCTION public.confirm_receipt_admin(p_receipt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_has_line_items boolean;
  v_excluded_count integer;
  v_included_total numeric;
BEGIN
  -- 1. Check if receipt has line items and if any are excluded
  SELECT
    EXISTS(SELECT 1 FROM public.receipt_line_items WHERE receipt_id = p_receipt_id),
    COUNT(*) FILTER (WHERE include_in_records = false),
    COALESCE(SUM(amount) FILTER (WHERE include_in_records = true), 0)
  INTO
    v_has_line_items,
    v_excluded_count,
    v_included_total
  FROM public.receipt_line_items
  WHERE receipt_id = p_receipt_id;

  -- 2. If line items exist and some were excluded, record claimed_amount
  -- Otherwise, keep claimed_amount as NULL (indicating full total_amount is used)
  IF v_has_line_items AND v_excluded_count > 0 THEN
    UPDATE public.receipts
    SET claimed_amount = v_included_total,
        status = 'confirmed',
        needs_review = false
    WHERE id = p_receipt_id
    RETURNING to_jsonb(receipts.*) INTO v_result;
  ELSE
    UPDATE public.receipts
    SET status = 'confirmed',
        needs_review = false
    WHERE id = p_receipt_id
    RETURNING to_jsonb(receipts.*) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;
