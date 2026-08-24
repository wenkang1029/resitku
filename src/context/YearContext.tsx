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

export function YearProvider({ children }: { children: React.ReactNode }) {
  const [selectedYear, setSelectedYearState] = useState<number>(DEFAULT_YEAR)

  // Initialize from localStorage or fallback
  useEffect(() => {
    try {
      const stored = localStorage.getItem('resitku_selected_ya')
      if (stored) {
        const parsed = parseInt(stored, 10)
        if (AVAILABLE_YEARS.includes(parsed)) {
          setSelectedYearState(parsed)
        }
      }
    } catch {}
  }, [])

  const setSelectedYear = (year: number) => {
    setSelectedYearState(year)
    try {
      localStorage.setItem('resitku_selected_ya', year.toString())
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
