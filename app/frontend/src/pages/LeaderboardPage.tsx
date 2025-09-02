import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export function LeaderboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    // TODO: Load leaderboard data
    setTimeout(() => {
      setLeaderboard([
        { rank: 1, name: 'Player1', time: '01:23.45', prize: '🪙 160' },
        { rank: 2, name: 'Player2', time: '01:25.67', prize: '🪙 100' },
        { rank: 3, name: 'Player3', time: '01:28.90', prize: '🪙 60' },
      ])
      setIsLoading(false)
    }, 1000)

    // Update countdown timer
    const interval = setInterval(() => {
      const now = new Date()
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)
      const diff = endOfDay.getTime() - now.getTime()
      
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      
      setTimeLeft(`${hours}h ${minutes}m`)
    }, 1000)

    return () => clearInterval(interval)
  }, [user, navigate])

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="candy-card mb-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-candy text-candy-pink mb-2">Leaderboard</h1>
            <div className="flex justify-center items-center gap-6">
              <div>
                <span className="text-sm text-gray-600">Prize Pool:</span>
                <span className="text-2xl font-bold text-candy-green ml-2">🪙 400</span>
              </div>
              <div>
                <span className="text-sm text-gray-600">Closes in:</span>
                <span className="text-2xl font-bold text-candy-orange ml-2">{timeLeft}</span>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-2xl font-candy text-candy-pink animate-pulse">Loading...</div>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    entry.rank === 1
                      ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 border-2 border-yellow-400'
                      : entry.rank === 2
                      ? 'bg-gradient-to-r from-gray-100 to-gray-200 border-2 border-gray-400'
                      : entry.rank === 3
                      ? 'bg-gradient-to-r from-orange-100 to-orange-200 border-2 border-orange-400'
                      : 'bg-white border-2 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold">
                      {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                    </div>
                    <div>
                      <p className="font-bold">{entry.name}</p>
                      <p className="text-sm text-gray-600">Time: {entry.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-candy-green">{entry.prize}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-4">
            <button
              onClick={() => navigate('/entry')}
              className="flex-1 candy-button"
            >
              Play Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-full hover:bg-gray-300"
            >
              Back to Home
            </button>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Top 3 players win Gold Bars when the daily challenge closes!</p>
          <p>Everyone receives a booster for participating.</p>
        </div>
      </div>
    </div>
  )
}