import { createContext, useContext, useState, useCallback } from 'react'
import { api } from './api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('nexus_user')
    return raw ? JSON.parse(raw) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('nexus_token'))

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password)
    localStorage.setItem('nexus_token', res.data.access_token)
    localStorage.setItem('nexus_user', JSON.stringify(res.data.investigator))
    setToken(res.data.access_token)
    setUser(res.data.investigator)
    return res.data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('nexus_token')
    localStorage.removeItem('nexus_user')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
