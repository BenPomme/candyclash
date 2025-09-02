import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../api/client'

interface User {
  id: string
  email: string
  displayName: string | null
  goldBalance: number
  isAdmin: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, displayName?: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  updateBalance: (newBalance: number) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,

      login: async (email: string, displayName?: string) => {
        set({ isLoading: true })
        try {
          const response = await api.auth.login(email, displayName)
          set({
            user: response.user,
            token: response.token,
            isLoading: false,
          })
          localStorage.setItem('token', response.token)
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        set({ user: null, token: null })
        localStorage.removeItem('token')
        window.location.href = '/'
      },

      checkAuth: async () => {
        const token = localStorage.getItem('token')
        if (!token) {
          set({ user: null, token: null })
          return
        }

        set({ isLoading: true })
        try {
          const user = await api.auth.me()
          set({ user, token, isLoading: false })
        } catch (error) {
          set({ user: null, token: null, isLoading: false })
          localStorage.removeItem('token')
        }
      },

      updateBalance: (newBalance: number) => {
        set((state) => ({
          user: state.user ? { ...state.user, goldBalance: newBalance } : null,
        }))
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
)