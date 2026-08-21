-- ================================================================
-- ResitKu — Phase 2 seed: relief_rules 2025, rule_version 1
-- Paste into: Supabase Dashboard → SQL Editor → New query → Run
--
-- PREREQUISITE: run migration 003 first (adds enforces_combined_cap),
-- OR paste the ALTER TABLE below before the seed INSERT.
--
-- Uses a 3-pass CTE chain so FK references resolve in order:
--   roots (24 rows, no parent)
--   → level1 (8 rows, parent is a root)
--     → final INSERT (2 grandchildren, parent is a level1 row)
--
-- ALL rows set to status: 'draft'. Nothing is auto-published.
-- Does NOT insert excluded_not_reliefs (rebates, not reliefs).
-- ================================================================

-- ── STEP 0: add enforces_combined_cap if not already present ──
-- (idempotent — safe to run even after migration 003 was applied)
ALTER TABLE public.relief_rules
  ADD COLUMN IF NOT EXISTS enforces_combined_cap boolean NOT NULL DEFAULT false;

WITH

-- ── PASS 1: 24 root rows (sub_cap_parent_id IS NULL) ─────────
-- enforces_combined_cap = true ONLY on medical_combined_umbrella.
-- All other roots get the default (false).
roots AS (
  INSERT INTO public.relief_rules
    (assessment_year, rule_version, status,
     category_key, category_label, limit_amount,
     sub_cap_parent_id, enforces_combined_cap, source_reference)
  VALUES
    (2025,1,'draft','self_dependent',
     'Individu dan saudara tanggungan / Individual and dependent relatives',
     9000, NULL, false, 'LHDN item 1'),

    (2025,1,'draft','parents_medical_care',
     'Perbelanjaan ibu bapa dan datuk nenek (rawatan perubatan, pergigian, keperluan khas, penjagaan) / Parents & grandparents medical/dental/special needs/carer expenses',
     8000, NULL, false, 'LHDN item 2 (parent bracket)'),

    (2025,1,'draft','disabled_support_equipment',
     'Peralatan sokongan asas (diri sendiri/suami/isteri/anak/ibu bapa kurang upaya) / Basic supporting equipment for disabled self/spouse/child/parent',
     6000, NULL, false, 'LHDN item 3'),

    (2025,1,'draft','disabled_individual',
     'Individu kurang upaya / Disabled individual',
     7000, NULL, false, 'LHDN item 4'),

    (2025,1,'draft','education_fees_self',
     'Yuran pengajian (sendiri) / Education fees (self)',
     7000, NULL, false, 'LHDN item 5 (parent bracket)'),

    -- enforces_combined_cap = TRUE: confirmed by actual MyTax/ezHasil e-Filing
    -- portal behavior. Engine must apply BOTH per-child caps (items 6, 7, 8)
    -- AND sum of all three children capped at RM10,000.
    (2025,1,'draft','medical_combined_umbrella',
     'Perbelanjaan perubatan bagi diri sendiri, suami/isteri atau anak (had gabungan) / Medical expenses for self, spouse or child (combined umbrella cap)',
     10000, NULL, true, 'LHDN e-Filing (MyTax/ezHasil) combined heading covering items 6, 7, and 8'),

    (2025,1,'draft','lifestyle_general',
     'Gaya hidup: buku, komputer/telefon/tablet, internet, kursus / Lifestyle: books, computer/phone/tablet, internet, courses',
     2500, NULL, false, 'LHDN item 9'),

    (2025,1,'draft','lifestyle_sports',
     'Gaya hidup tambahan: peralatan sukan, fasiliti sukan, pertandingan, gimnasium / Additional lifestyle: sports equipment, facility fees, competitions, gym',
     1000, NULL, false, 'LHDN item 10'),

    (2025,1,'draft','breastfeeding_equipment',
     'Peralatan penyusuan ibu (anak ≤2 tahun, sekali setiap 2 YA) / Breastfeeding equipment (child ≤2 years, once per 2 YA)',
     1000, NULL, false, 'LHDN item 11'),

    (2025,1,'draft','childcare_fees',
     'Yuran penghantaran anak (≤6 tahun) ke taman asuhan/tadika berdaftar / Registered childcare/kindergarten fees (child ≤6 years)',
     3000, NULL, false, 'LHDN item 12'),

    (2025,1,'draft','sspn_net_deposit',
     'Tabungan bersih SSPN / Net SSPN savings deposit',
     8000, NULL, false, 'LHDN item 13'),

    (2025,1,'draft','spouse_alimony',
     'Suami/isteri/bayaran alimoni kepada bekas isteri / Spouse / alimony to former wife',
     4000, NULL, false, 'LHDN item 14'),

    (2025,1,'draft','disabled_spouse',
     'Suami/isteri kurang upaya / Disabled spouse',
     6000, NULL, false, 'LHDN item 15'),

    (2025,1,'draft','child_below_18',
     'Anak di bawah umur 18 tahun / Child below 18 years',
     2000, NULL, false, 'LHDN item 16a'),

    (2025,1,'draft','child_18plus_alevel_matriculation',
     'Anak 18+ belajar sepenuh masa (A-Level/sijil/matrikulasi/pra-ijazah) / Child 18+ full-time (A-Level/certificate/matriculation/pre-degree)',
     2000, NULL, false, 'LHDN item 16b (first tier)'),

    (2025,1,'draft','child_18plus_higher_ed',
     'Anak 18+ belajar sepenuh masa peringkat diploma/ijazah ke atas / Child 18+ full-time diploma/degree level and above',
     8000, NULL, false, 'LHDN item 16b (second tier — diploma+/degree+ in Malaysia or recognised institutions abroad)'),

    (2025,1,'draft','disabled_child',
     'Anak kurang upaya / Disabled child',
     8000, NULL, false, 'LHDN item 16c'),

    -- life_insurance_epf: enforces_combined_cap intentionally false.
    -- Its two children happen to sum exactly to the parent (4000+3000=7000),
    -- so the combined-cap constraint is redundant at current values.
    -- Revisit and set true if a third child is ever added or limits change.
    (2025,1,'draft','life_insurance_epf',
     'Insurans nyawa dan KWSP / Life insurance and EPF',
     7000, NULL, false, 'hasil.gov.my Pelepasan Cukai table (YA2025), item 17 — RM7,000 combined ceiling confirmed identical for all taxpayer categories (pensionable civil servants, non-pensionable, self-employed). No profile-based branching required for this item.'),

    (2025,1,'draft','prs_deferred_annuity',
     'Skim Persaraan Swasta dan Anuiti Tertangguh / Private Retirement Scheme and deferred annuity',
     3000, NULL, false, 'LHDN item 18'),

    (2025,1,'draft','education_medical_insurance',
     'Insurans pendidikan dan perubatan / Education and medical insurance',
     4000, NULL, false, 'LHDN item 19'),

    (2025,1,'draft','socso_contribution',
     'Caruman PERKESO / SOCSO contribution',
     350, NULL, false, 'LHDN item 20'),

    (2025,1,'draft','ev_charging_compost_machine',
     'Kemudahan pengecasan kenderaan elektrik dan mesin kompos sisa makanan / EV charging facility and food waste compost machine',
     2500, NULL, false, 'LHDN item 21 (combined category, confirmed)'),

    (2025,1,'draft','first_home_loan_interest_tier1',
     'Faedah pinjaman rumah pertama, harga ≤RM500,000 / First home loan interest, price ≤RM500,000',
     7000, NULL, false, 'LHDN item 22, tier i (SPA executed 1 Jan 2025 – 31 Dec 2027)'),

    (2025,1,'draft','first_home_loan_interest_tier2',
     'Faedah pinjaman rumah pertama, harga RM500,000–RM750,000 / First home loan interest, price RM500,000–RM750,000',
     5000, NULL, false, 'LHDN item 22, tier ii (SPA executed 1 Jan 2025 – 31 Dec 2027)')

  RETURNING id, category_key
),

-- ── PASS 2: 8 level-1 children (parent is a root) ────────────
-- Uses UUIDs captured in the roots CTE above.
-- All level-1 children: enforces_combined_cap = false (default).
level1 AS (
  INSERT INTO public.relief_rules
    (assessment_year, rule_version, status,
     category_key, category_label, limit_amount,
     sub_cap_parent_id, enforces_combined_cap, source_reference)
  VALUES
    (2025,1,'draft','parents_full_medical_exam',
     'Pemeriksaan perubatan penuh ibu bapa / Parents'' complete medical examination',
     1000,
     (SELECT id FROM roots WHERE category_key = 'parents_medical_care'),
     false,
     'LHDN item 2, sub-item 2 (restricted RM1,000 within the RM8,000 parent bracket)'),

    (2025,1,'draft','education_upskilling_course',
     'Kursus peningkatan kemahiran atau kemajuan diri / Upskilling or self-enhancement course',
     2000,
     (SELECT id FROM roots WHERE category_key = 'education_fees_self'),
     false,
     'LHDN item 5, sub-item 3 (restricted RM2,000 within the RM7,000 parent bracket)'),

    -- Item 6: child of medical_combined_umbrella (has its own grandchildren below)
    (2025,1,'draft','medical_serious_vaccination_dental',
     'Perbelanjaan perubatan: penyakit serius, rawatan kesuburan, pemvaksinan, pergigian / Medical: serious diseases, fertility treatment, vaccination, dental',
     10000,
     (SELECT id FROM roots WHERE category_key = 'medical_combined_umbrella'),
     false,
     'LHDN item 6, child of the combined RM10,000 umbrella. No additional individual cap beyond vaccination/dental sub-caps.'),

    -- Item 7: child of medical_combined_umbrella
    (2025,1,'draft','medical_fullexam_covid_mental_selftest',
     'Pemeriksaan perubatan penuh, ujian COVID-19, kesihatan mental, peralatan kendiri / Full medical exam, COVID-19 test, mental health, self-test devices',
     1000,
     (SELECT id FROM roots WHERE category_key = 'medical_combined_umbrella'),
     false,
     'LHDN item 7, child of the combined RM10,000 umbrella, individually capped at RM1,000 by the e-Filing form itself'),

    -- Item 8: child of medical_combined_umbrella
    (2025,1,'draft','child_learning_disability_assessment',
     'Penilaian dan rawatan kurang upaya pembelajaran anak (≤18 tahun) / Learning disability assessment & treatment for child (≤18 years)',
     6000,
     (SELECT id FROM roots WHERE category_key = 'medical_combined_umbrella'),
     false,
     'LHDN item 8, child of the combined RM10,000 umbrella, individually capped at RM6,000 by the e-Filing form itself'),

    (2025,1,'draft','disabled_child_higher_ed_additional',
     'Tambahan anak kurang upaya belajar diploma/ijazah ke atas / Additional for disabled child studying diploma/degree level and above',
     8000,
     (SELECT id FROM roots WHERE category_key = 'disabled_child'),
     false,
     'LHDN item 16c (additional tier)'),

    (2025,1,'draft','epf_contribution_subcap',
     'Caruman KWSP (sub-cap) / EPF contribution (sub-cap)',
     4000,
     (SELECT id FROM roots WHERE category_key = 'life_insurance_epf'),
     false,
     'hasil.gov.my Pelepasan Cukai table (YA2025), item 17 sub-item 1 — RM4,000 EPF sub-cap applies uniformly across all taxpayer categories. Confirmed: no civil-servant exception or employment_type branching needed.'),

    (2025,1,'draft','life_insurance_premium_subcap',
     'Premium insurans hayat/takaful (sub-cap) / Life insurance/takaful premium (sub-cap)',
     3000,
     (SELECT id FROM roots WHERE category_key = 'life_insurance_epf'),
     false,
     'hasil.gov.my Pelepasan Cukai table (YA2025), item 17 sub-item 2 — RM3,000 life insurance/takaful sub-cap applies uniformly across all taxpayer categories. Confirmed: no civil-servant exception or employment_type branching needed.')

  RETURNING id, category_key
)

-- ── PASS 3: 2 grandchildren (parent is a level-1 row) ────────
-- medical_vaccination_subcap and medical_dental_subcap sit under
-- medical_serious_vaccination_dental, which itself sits under
-- medical_combined_umbrella — this is the 3-level deep chain.
-- All grandchildren: enforces_combined_cap = false (default).
INSERT INTO public.relief_rules
  (assessment_year, rule_version, status,
   category_key, category_label, limit_amount,
   sub_cap_parent_id, enforces_combined_cap, source_reference)
VALUES
  (2025,1,'draft','medical_vaccination_subcap',
   'Pemvaksinan (sub-cap) / Vaccination (sub-cap)',
   1000,
   (SELECT id FROM level1 WHERE category_key = 'medical_serious_vaccination_dental'),
   false,
   'LHDN item 6, sub-item 3 (restricted RM1,000 within item 6, which itself sits inside the RM10,000 combined umbrella)'),

  (2025,1,'draft','medical_dental_subcap',
   'Pemeriksaan dan rawatan pergigian (sub-cap) / Dental examination and treatment (sub-cap)',
   1000,
   (SELECT id FROM level1 WHERE category_key = 'medical_serious_vaccination_dental'),
   false,
   'LHDN item 6, sub-item 4 (restricted RM1,000 within item 6, which itself sits inside the RM10,000 combined umbrella)');


-- ================================================================
-- VERIFICATION QUERIES — run these after the INSERT above succeeds
-- ================================================================

-- 1. Total row count (should be 30)
SELECT COUNT(*) AS total_rows
FROM public.relief_rules
WHERE assessment_year = 2025 AND rule_version = 1;


-- 2. Tree view: parent → child → grandchild
-- Shows the full hierarchy with indentation via LPAD.
WITH RECURSIVE tree AS (
  -- Anchor: root rows
  SELECT
    id, category_key, limit_amount, sub_cap_parent_id,
    0 AS depth,
    category_key AS sort_path
  FROM public.relief_rules
  WHERE sub_cap_parent_id IS NULL
    AND assessment_year = 2025 AND rule_version = 1

  UNION ALL

  -- Recursive: children of the current level
  SELECT
    r.id, r.category_key, r.limit_amount, r.sub_cap_parent_id,
    t.depth + 1,
    t.sort_path || ' > ' || r.category_key
  FROM public.relief_rules r
  JOIN tree t ON r.sub_cap_parent_id = t.id
  WHERE r.assessment_year = 2025 AND r.rule_version = 1
)
SELECT
  LPAD('', depth * 4, ' ') || category_key AS hierarchy,
  limit_amount,
  enforces_combined_cap,
  depth
FROM tree
ORDER BY sort_path;
