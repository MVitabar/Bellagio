"use client"

import * as React from "react"
import { createContext, useContext, useState } from "react"
import { 
  ThemeContextProps, 
  ThemeProviderProps, 
  Theme 
} from "@/types"

const ThemeContext = createContext<ThemeContextProps>({
  theme: "system",
  toggleTheme: () => {},
  setTheme: () => {},
})

export const useTheme = () => useContext(ThemeContext)

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  storageKey = "restaurant-theme",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)

  React.useEffect(() => {
    const savedTheme = localStorage.getItem(storageKey) as Theme | null
    if (savedTheme) {
      setTheme(savedTheme)
    } else {
      setTheme(defaultTheme)
    }
  }, [defaultTheme, storageKey])

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const root = window.document.documentElement

    function updateTheme(theme: Theme) {
      if (!theme) return

      root.setAttribute(attribute, theme)
      localStorage.setItem(storageKey, theme)
    }

    updateTheme(theme)
  }, [theme, attribute, storageKey])

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : 
                     theme === "dark" ? "system" : 
                     "light"
    setTheme(newTheme)
  }

  const value = {
    theme,
    setTheme,
    toggleTheme
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
export type { Theme }

