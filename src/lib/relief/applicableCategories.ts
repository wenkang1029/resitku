export type EducationStage = 'below_18' | 'a_level_matriculation' | 'diploma_degree_higher'

export interface DependentChild {
  birth_year: number
  education_stage: EducationStage
  has_disability?: boolean
}

export interface FilingProfile {
  marital_status: 'single' | 'married'
  filing_type?: 'joint' | 'separate'
  dependent_children: DependentChild[]
  has_disability: boolean
  spouse_has_disability?: boolean
}

/**
 * Given a user's FilingProfile, returns the list of relief rule category_keys
 * that are applicable to this specific individual.
 * 
 * If profile is null or incomplete, returns null (meaning ALL categories apply by default).
 */
export function getApplicableCategoryKeys(profile: FilingProfile | null | undefined): string[] | null {
  if (!profile) {
    return null // null means no filtering: show all categories
  }

  const keys = new Set<string>()

  // 1. Core universal categories matching actual YA 2025 seeded category keys
  const universalCategories = [
    'self_dependent',
    'parents_medical_care',
    'medical_combined_umbrella',
    'medical_serious_diseases_parents',
    'medical_serious_diseases_self_spouse_child',
    'medical_fertility_treatment',
    'vaccination_expenses',
    'dental_examination_treatment',
    'child_learning_disability_expenses',
    'full_medical_checkup_mental_health',
    'disabled_support_equipment',
    'education_fees_self',
    'lifestyle_general',
    'lifestyle_sports',
    'ev_charging_compost_machine',
    'breastfeeding_equipment',
    'childcare_fees',
    'sspn_net_deposit',
    'life_insurance_epf',
    'life_insurance_premium',
    'epf_voluntary_scheme',
    'prs_deferred_annuity',
    'education_medical_insurance',
    'socso_contribution',
    'first_home_loan_interest_tier1',
    'first_home_loan_interest_tier2',
    'none'
  ]

  universalCategories.forEach((k) => keys.add(k))

  // 2. Disability (Self)
  if (profile.has_disability) {
    keys.add('disabled_individual')
  }

  // 3. Marital status & Spouse conditions
  if (profile.marital_status === 'married') {
    keys.add('spouse_alimony')

    if (profile.spouse_has_disability) {
      keys.add('disabled_spouse')
    }
  }

  // 4. Dependent Children & Tiers
  if (profile.dependent_children && profile.dependent_children.length > 0) {
    let hasBelow18 = false
    let hasMatriculation = false
    let hasHigherEd = false
    let hasDisabledChild = false

    profile.dependent_children.forEach((child) => {
      if (child.education_stage === 'below_18') {
        hasBelow18 = true
      } else if (child.education_stage === 'a_level_matriculation') {
        hasMatriculation = true
      } else if (child.education_stage === 'diploma_degree_higher') {
        hasHigherEd = true
      }

      if (child.has_disability) {
        hasDisabledChild = true
      }
    })

    if (hasBelow18) {
      keys.add('child_below_18')
    }
    if (hasMatriculation) {
      keys.add('child_18plus_alevel_matriculation')
    }
    if (hasHigherEd) {
      keys.add('child_18plus_higher_ed')
    }
    if (hasDisabledChild) {
      keys.add('disabled_child')
      keys.add('disabled_child_higher_ed_additional')
    }
  }

  return Array.from(keys)
}
