import axios, { AxiosInstance } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://candyclash-85fd4.web.app' : 'http://localhost:8080')

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.status, error.response?.data)
        if (error.response?.status === 401) {
          // Only redirect on 401 if not on leaderboard page
          const currentPath = window.location.pathname
          if (!currentPath.includes('/leaderboard')) {
            localStorage.removeItem('token')
            window.location.href = '/'
          }
        }
        return Promise.reject(error)
      },
    )
  }

  auth = {
    login: async (email: string) => {
      const response = await this.client.post('/auth/dev-login', { email })
      return response.data
    },
    me: async () => {
      const response = await this.client.get('/me')
      return response.data
    },
  }

  challenge = {
    getToday: async () => {
      const response = await this.client.get('/challenge/today')
      return response.data
    },
    join: async (challengeId: string) => {
      const response = await this.client.post(`/challenge/${challengeId}/join`, {})
      return response.data
    },
  }

  attempt = {
    complete: async (
      attemptId: string,
      data: {
        timeMs: number
        collected: Record<string, number>
        moves: number
        attemptToken: string
      },
    ) => {
      const response = await this.client.post(`/attempt/${attemptId}/complete`, data)
      return response.data
    },
  }

  leaderboard = {
    get: async (challengeId: string, limit = 50) => {
      const response = await this.client.get(`/leaderboard/${challengeId}?limit=${limit}`)
      return response.data
    },
  }

  levels = {
    list: async () => {
      const response = await this.client.get('/levels')
      return response.data
    },
    get: async (levelId: string) => {
      const response = await this.client.get(`/levels/${levelId}`)
      return response.data
    },
    create: async (data: any) => {
      const response = await this.client.post('/levels', data)
      return response.data
    },
    update: async (levelId: string, data: any) => {
      const response = await this.client.put(`/levels/${levelId}`, data)
      return response.data
    },
    delete: async (levelId: string) => {
      const response = await this.client.delete(`/levels/${levelId}`)
      return response.data
    },
    test: async (levelId: string) => {
      const response = await this.client.post(`/levels/${levelId}/test`)
      return response.data
    },
  }

  admin = {
    closeChallenge: async (challengeId: string) => {
      const response = await this.client.post(`/admin/challenge/close`, { id: challengeId })
      return response.data
    },
    createChallenge: async (data: any) => {
      const response = await this.client.post('/admin/challenge/create', data)
      return response.data
    },
    getDashboard: async () => {
      const response = await this.client.get('/admin/dashboard')
      return response.data
    },
    reset: async () => {
      const response = await this.client.post('/admin/reset')
      return response.data
    },
  }
}

export const api = new ApiClient()