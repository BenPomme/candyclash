import axios, { AxiosInstance } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

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
        if (error.response?.status === 401) {
          localStorage.removeItem('token')
          window.location.href = '/'
        }
        return Promise.reject(error)
      },
    )
  }

  auth = {
    login: async (email: string) => {
      const response = await this.client.post('/api/auth/dev-login', { email })
      return response.data
    },
    me: async () => {
      const response = await this.client.get('/api/me')
      return response.data
    },
  }

  challenge = {
    getToday: async () => {
      const response = await this.client.get('/api/challenge/today')
      return response.data
    },
    join: async (challengeId: string) => {
      const response = await this.client.post(`/api/challenge/${challengeId}/join`)
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
      const response = await this.client.post(`/api/attempt/${attemptId}/complete`, data)
      return response.data
    },
  }

  leaderboard = {
    get: async (challengeId: string, limit = 50) => {
      const response = await this.client.get(`/api/leaderboard/${challengeId}?limit=${limit}`)
      return response.data
    },
  }

  levels = {
    list: async () => {
      const response = await this.client.get('/api/levels')
      return response.data
    },
    get: async (levelId: string) => {
      const response = await this.client.get(`/api/levels/${levelId}`)
      return response.data
    },
    create: async (data: any) => {
      const response = await this.client.post('/api/levels', data)
      return response.data
    },
    update: async (levelId: string, data: any) => {
      const response = await this.client.put(`/api/levels/${levelId}`, data)
      return response.data
    },
    delete: async (levelId: string) => {
      const response = await this.client.delete(`/api/levels/${levelId}`)
      return response.data
    },
    test: async (levelId: string) => {
      const response = await this.client.post(`/api/levels/${levelId}/test`)
      return response.data
    },
  }

  admin = {
    closeChallenge: async (challengeId: string) => {
      const response = await this.client.post(`/api/admin/challenge/close`, { id: challengeId })
      return response.data
    },
    createChallenge: async (data: any) => {
      const response = await this.client.post('/api/admin/challenge/create', data)
      return response.data
    },
    getDashboard: async () => {
      const response = await this.client.get('/api/admin/dashboard')
      return response.data
    },
    reset: async () => {
      const response = await this.client.post('/api/admin/reset')
      return response.data
    },
  }
}

export const api = new ApiClient()