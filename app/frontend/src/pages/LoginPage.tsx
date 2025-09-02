import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      await login(email)
      navigate('/entry')
    } catch (err) {
      setError('Failed to login. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="candy-card max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-candy text-candy-pink mb-2">Candy Clash</h1>
          <p className="text-gray-600">Compete for Gold Bars!</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border-2 border-candy-pink rounded-lg focus:outline-none focus:border-candy-orange"
              placeholder="player@example.com"
            />
          </div>

          {error && (
            <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full candy-button disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Logging in...' : 'Play Now!'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Dev Mode: Enter any email to play</p>
          <p>All players start with 200 Gold Bars</p>
        </div>
      </div>
    </div>
  )
}