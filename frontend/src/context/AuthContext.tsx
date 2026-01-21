import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from '../types'
import { login as loginApi, getCurrentUser } from '../api/auth'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser))
        // Verify token is still valid
        getCurrentUser()
          .then((user) => {
            setUser(user)
            localStorage.setItem('user', JSON.stringify(user))
          })
          .catch(() => {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            setUser(null)
          })
          .finally(() => setIsLoading(false))
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setIsLoading(false)
      }
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (username: string, password: string) => {
    const response = await loginApi({ username, password })
    localStorage.setItem('token', response.access_token)
    localStorage.setItem('user', JSON.stringify(response.user))
    setUser(response.user)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
