-- ================================================================
-- Migration 003: add enforces_combined_cap to relief_rules
--
-- Rationale: the relief calculation engine cannot safely infer
-- "shared umbrella cap" from COUNT(direct children) > 1.
--
-- Counterexample that breaks the heuristic:
--   life_insurance_epf has 2 children:
--     epf_contribution_subcap      RM 4,000
--     life_insurance_premium_subcap RM 3,000
--   Their individual limits sum exactly to the parent: RM7,000.
--   So child-count > 1 would flag it as a shared umbrella — and
--   produce the right answer today, but only by arithmetic
--   coincidence. Add a third child at RM2,000 and the heuristic
--   over-caps a valid claim.
--
-- The correct signal is per-row intent, confirmed by actual
-- LHDN e-Filing portal behavior — hence an explicit boolean flag.
--
-- enforces_combined_cap = true means the engine MUST apply BOTH:
--   (1) each child's own limit_amount individually (always done), AND
--   (2) SUM(all children's post-cap amounts) capped at parent limit_amount
--
-- Currently confirmed true: medical_combined_umbrella only.
-- life_insurance_epf: intentionally left false — see note below.
-- ================================================================

ALTER TABLE public.relief_rules
  ADD COLUMN IF NOT EXISTS enforces_combined_cap boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.relief_rules.enforces_combined_cap IS
  'When true, the calculation engine must enforce BOTH each child''s '
  'individual limit_amount AND SUM(children) <= this parent''s limit_amount. '
  'Do NOT infer from COUNT(children) > 1 — misfires when child limits do not '
  'coincidentally sum to the parent limit. '
  'Set true only on rows confirmed by actual e-Filing portal behavior. '
  'Currently confirmed: medical_combined_umbrella only (items 6+7+8).';
