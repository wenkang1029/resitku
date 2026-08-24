'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface YearContextType {
  selectedYear: number
  setSelectedYear: (year: number) => void
  availableYears: number[]
}

const YearContext = createContext<YearContextType | undefined>(undefined)

const DEFAULT_YEAR = 2025
const AVAILABLE_YEARS = [2026, 2025, 2024]

import { supabase } from '@/lib/supabase/client'

export function YearProvider({ children }: { children: React.ReactNode }) {
  const [selectedYear, setSelectedYearState] = useState<number>(DEFAULT_YEAR)
  const [userId, setUserId] = useState<string | null>(null)

  // Initialize from user-scoped localStorage or fallback
  useEffect(() => {
    async function initUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const uid = user?.id || 'guest'
        setUserId(uid)

        const storageKey = `resitku_selected_ya_${uid}`
        const stored = localStorage.getItem(storageKey) || localStorage.getItem('resitku_selected_ya')
        if (stored) {
          const parsed = parseInt(stored, 10)
          if (AVAILABLE_YEARS.includes(parsed)) {
            setSelectedYearState(parsed)
          }
        }
      } catch {}
    }
    initUser()
  }, [])

  const setSelectedYear = (year: number) => {
    setSelectedYearState(year)
    try {
      const uid = userId || 'guest'
      localStorage.setItem(`resitku_selected_ya_${uid}`, year.toString())
    } catch {}
  }

  return (
    <YearContext.Provider
      value={{
        selectedYear,
        setSelectedYear,
        availableYears: AVAILABLE_YEARS,
      }}
    >
      {children}
    </YearContext.Provider>
  )
}

export function useAssessmentYear() {
  const context = useContext(YearContext)
  if (!context) {
    throw new Error('useAssessmentYear must be used within a YearProvider')
  }
  return context
}
