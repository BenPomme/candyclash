import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export function AdminPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/')
    }
  }, [user, navigate])

  if (!user?.isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="candy-card mb-6">
          <h1 className="text-3xl font-candy text-candy-pink mb-6">Admin Dashboard</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-candy-yellow/20 rounded-lg p-6">
              <h3 className="font-bold text-candy-orange mb-2">Active Players</h3>
              <p className="text-3xl font-bold">0</p>
            </div>
            <div className="bg-candy-green/20 rounded-lg p-6">
              <h3 className="font-bold text-candy-green mb-2">Today's Pot</h3>
              <p className="text-3xl font-bold">🪙 0</p>
            </div>
            <div className="bg-candy-blue/20 rounded-lg p-6">
              <h3 className="font-bold text-candy-blue mb-2">Total Attempts</h3>
              <p className="text-3xl font-bold">0</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">Quick Actions</h2>
            
            <div className="flex gap-4">
              <button
                onClick={() => navigate('/editor')}
                className="candy-button"
              >
                Level Editor
              </button>
              <button
                className="gold-button"
                onClick={() => {
                  if (confirm('Close current challenge and distribute prizes?')) {
                    // TODO: Implement close challenge
                  }
                }}
              >
                Close Daily Challenge
              </button>
              <button
                className="px-6 py-3 bg-red-500 text-white font-bold rounded-full hover:bg-red-600"
                onClick={() => {
                  if (confirm('Reset all leaderboards and data? This cannot be undone!')) {
                    // TODO: Implement reset
                  }
                }}
              >
                Reset Everything
              </button>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Active Challenges</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-600">No active challenges</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/entry')}
          className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-full hover:bg-gray-300"
        >
          Back to Game
        </button>
      </div>
    </div>
  )
}