'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'auth_user'
const COOKIE_NAME = 'auth_email'

interface AuthContextValue {
  userEmail: string | null
  userInitials: string
  isLoading: boolean
  login: (email: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setUserEmail(stored)
    setIsLoading(false)
  }, [])

  const login = useCallback((email: string) => {
    localStorage.setItem(STORAGE_KEY, email)
    // Session cookie — expires on browser close
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(email)}; path=/; SameSite=Lax`
    setUserEmail(email)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
    setUserEmail(null)
    router.push('/login')
  }, [router])

  // Derive initials from email local part: hill.mugisha@ → HM
  const userInitials = userEmail
    ? userEmail
        .split('@')[0]
        .split(/[.\-_]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('')
    : ''

  return (
    <AuthContext.Provider value={{ userEmail, userInitials, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
