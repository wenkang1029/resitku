-- ================================================================
-- Migration 004: split bilingual category_label into EN and MS columns
--
-- Background: category_label previously stored strings joined with ' / '.
-- Substrings with internal slashes (e.g. 'suami/isteri', 'Spouse / alimony')
-- caused ambiguous splits. This migration introduces separate clean columns.
-- ================================================================

ALTER TABLE public.relief_rules
  ADD COLUMN IF NOT EXISTS category_label_en text,
  ADD COLUMN IF NOT EXISTS category_label_ms text;

UPDATE public.relief_rules
SET
  category_label_ms = CASE category_key
    WHEN 'self_dependent' THEN 'Individu dan saudara tanggungan'
    WHEN 'parents_medical_care' THEN 'Perbelanjaan ibu bapa dan datuk nenek (rawatan perubatan, pergigian, keperluan khas, penjagaan)'
    WHEN 'parents_full_medical_exam' THEN 'Pemeriksaan perubatan penuh ibu bapa'
    WHEN 'disabled_support_equipment' THEN 'Peralatan sokongan asas (diri sendiri/suami/isteri/anak/ibu bapa kurang upaya)'
    WHEN 'disabled_individual' THEN 'Individu kurang upaya'
    WHEN 'education_fees_self' THEN 'Yuran pengajian (sendiri)'
    WHEN 'education_upskilling_course' THEN 'Kursus peningkatan kemahiran atau kemajuan diri'
    WHEN 'medical_combined_umbrella' THEN 'Perbelanjaan perubatan bagi diri sendiri, suami/isteri atau anak (had gabungan)'
    WHEN 'medical_serious_vaccination_dental' THEN 'Perbelanjaan perubatan: penyakit serius, rawatan kesuburan, pemvaksinan, pergigian'
    WHEN 'medical_vaccination_subcap' THEN 'Pemvaksinan (sub-cap)'
    WHEN 'medical_dental_subcap' THEN 'Pemeriksaan dan rawatan pergigian (sub-cap)'
    WHEN 'medical_fullexam_covid_mental_selftest' THEN 'Pemeriksaan perubatan penuh, ujian COVID-19, kesihatan mental, peralatan kendiri'
    WHEN 'child_learning_disability_assessment' THEN 'Penilaian dan rawatan kurang upaya pembelajaran anak (≤18 tahun)'
    WHEN 'lifestyle_general' THEN 'Gaya hidup: buku, komputer/telefon/tablet, internet, kursus'
    WHEN 'lifestyle_sports' THEN 'Gaya hidup tambahan: peralatan sukan, fasiliti sukan, pertandingan, gimnasium'
    WHEN 'breastfeeding_equipment' THEN 'Peralatan penyusuan ibu (anak ≤2 tahun, sekali setiap 2 YA)'
    WHEN 'childcare_fees' THEN 'Yuran penghantaran anak (≤6 tahun) ke taman asuhan/tadika berdaftar'
    WHEN 'sspn_net_deposit' THEN 'Tabungan bersih SSPN'
    WHEN 'spouse_alimony' THEN 'Suami/isteri/bayaran alimoni kepada bekas isteri'
    WHEN 'disabled_spouse' THEN 'Suami/isteri kurang upaya'
    WHEN 'child_below_18' THEN 'Anak di bawah umur 18 tahun'
    WHEN 'child_18plus_alevel_matriculation' THEN 'Anak 18+ belajar sepenuh masa (A-Level/sijil/matrikulasi/pra-ijazah)'
    WHEN 'child_18plus_higher_ed' THEN 'Anak 18+ belajar sepenuh masa peringkat diploma/ijazah ke atas'
    WHEN 'disabled_child' THEN 'Anak kurang upaya'
    WHEN 'disabled_child_higher_ed_additional' THEN 'Tambahan anak kurang upaya belajar diploma/ijazah ke atas'
    WHEN 'life_insurance_epf' THEN 'Insurans nyawa dan KWSP'
    WHEN 'epf_contribution_subcap' THEN 'Caruman KWSP (sub-cap)'
    WHEN 'life_insurance_premium_subcap' THEN 'Premium insurans hayat/takaful (sub-cap)'
    WHEN 'prs_deferred_annuity' THEN 'Skim Persaraan Swasta dan Anuiti Tertangguh'
    WHEN 'education_medical_insurance' THEN 'Insurans pendidikan dan perubatan'
    WHEN 'socso_contribution' THEN 'Caruman PERKESO'
    WHEN 'ev_charging_compost_machine' THEN 'Kemudahan pengecasan kenderaan elektrik dan mesin kompos sisa makanan'
    WHEN 'first_home_loan_interest_tier1' THEN 'Faedah pinjaman rumah pertama, harga ≤RM500,000'
    WHEN 'first_home_loan_interest_tier2' THEN 'Faedah pinjaman rumah pertama, harga RM500,000–RM750,000'
    WHEN 'none' THEN 'Tidak layak pelepasan cukai'
    ELSE category_label
  END,
  category_label_en = CASE category_key
    WHEN 'self_dependent' THEN 'Individual and dependent relatives'
    WHEN 'parents_medical_care' THEN 'Parents & grandparents medical/dental/special needs/carer expenses'
    WHEN 'parents_full_medical_exam' THEN 'Parents'' complete medical examination'
    WHEN 'disabled_support_equipment' THEN 'Basic supporting equipment for disabled self/spouse/child/parent'
    WHEN 'disabled_individual' THEN 'Disabled individual'
    WHEN 'education_fees_self' THEN 'Education fees (self)'
    WHEN 'education_upskilling_course' THEN 'Upskilling or self-enhancement course'
    WHEN 'medical_combined_umbrella' THEN 'Medical expenses for self, spouse or child (combined umbrella cap)'
    WHEN 'medical_serious_vaccination_dental' THEN 'Medical: serious diseases, fertility treatment, vaccination, dental'
    WHEN 'medical_vaccination_subcap' THEN 'Vaccination (sub-cap)'
    WHEN 'medical_dental_subcap' THEN 'Dental examination and treatment (sub-cap)'
    WHEN 'medical_fullexam_covid_mental_selftest' THEN 'Full medical exam, COVID-19 test, mental health, self-test devices'
    WHEN 'child_learning_disability_assessment' THEN 'Learning disability assessment & treatment for child (≤18 years)'
    WHEN 'lifestyle_general' THEN 'Lifestyle: books, computer/phone/tablet, internet, courses'
    WHEN 'lifestyle_sports' THEN 'Additional lifestyle: sports equipment, facility fees, competitions, gym'
    WHEN 'breastfeeding_equipment' THEN 'Breastfeeding equipment (child ≤2 years, once per 2 YA)'
    WHEN 'childcare_fees' THEN 'Registered childcare/kindergarten fees (child ≤6 years)'
    WHEN 'sspn_net_deposit' THEN 'Net SSPN savings deposit'
    WHEN 'spouse_alimony' THEN 'Spouse / alimony to former wife'
    WHEN 'disabled_spouse' THEN 'Disabled spouse'
    WHEN 'child_below_18' THEN 'Child below 18 years'
    WHEN 'child_18plus_alevel_matriculation' THEN 'Child 18+ full-time (A-Level/certificate/matriculation/pre-degree)'
    WHEN 'child_18plus_higher_ed' THEN 'Child 18+ full-time diploma/degree level and above'
    WHEN 'disabled_child' THEN 'Disabled child'
    WHEN 'disabled_child_higher_ed_additional' THEN 'Additional for disabled child studying diploma/degree level and above'
    WHEN 'life_insurance_epf' THEN 'Life insurance and EPF'
    WHEN 'epf_contribution_subcap' THEN 'EPF contribution (sub-cap)'
    WHEN 'life_insurance_premium_subcap' THEN 'Life insurance/takaful premium (sub-cap)'
    WHEN 'prs_deferred_annuity' THEN 'Private Retirement Scheme and deferred annuity'
    WHEN 'education_medical_insurance' THEN 'Education and medical insurance'
    WHEN 'socso_contribution' THEN 'SOCSO contribution'
    WHEN 'ev_charging_compost_machine' THEN 'EV charging facility and food waste compost machine'
    WHEN 'first_home_loan_interest_tier1' THEN 'First home loan interest, price ≤RM500,000'
    WHEN 'first_home_loan_interest_tier2' THEN 'First home loan interest, price RM500,000–RM750,000'
    WHEN 'none' THEN 'Not tax-relief-eligible'
    ELSE category_label
  END;
