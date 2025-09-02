import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export function GamePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<any | null>(null)

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    // TODO: Initialize Phaser game here
    // For now, just show a placeholder

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
      }
    }
  }, [user, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-candy text-candy-pink">Game In Progress</h1>
        </div>
        
        <div className="flex justify-center">
          <div className="bg-white rounded-lg shadow-2xl p-4">
            <div className="bg-gray-100 rounded-lg" style={{ width: '800px', height: '600px' }}>
              <div ref={gameContainerRef} className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-2xl font-candy text-candy-purple mb-4">
                    Phaser Game Will Load Here
                  </p>
                  <button
                    onClick={() => navigate('/leaderboard')}
                    className="candy-button"
                  >
                    View Leaderboard
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-between items-center">
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Time</p>
                  <p className="text-2xl font-bold font-mono">00:00</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Yellow Candies</p>
                  <p className="text-2xl font-bold text-candy-yellow">0 / 100</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Score</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
              
              <button
                onClick={() => navigate('/entry')}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Exit Game
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}