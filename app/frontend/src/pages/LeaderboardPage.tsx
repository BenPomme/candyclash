import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../api/client'

export function LeaderboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState('')
  const [pot, setPot] = useState(0)
  const [_userRank, setUserRank] = useState<number | null>(null)
  const [closesAt, setClosesAt] = useState<any>(null)
  const [calculatedPrizes, setCalculatedPrizes] = useState<any[]>([])

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    // Load leaderboard data
    loadLeaderboard()
    
    // Refresh every 5 seconds
    const refreshInterval = setInterval(loadLeaderboard, 5000)

    return () => {
      clearInterval(refreshInterval)
    }
  }, [user, navigate])

  useEffect(() => {
    if (!closesAt) return

    const updateCountdown = () => {
      const now = new Date()
      let endTime: Date
      
      // Handle different date formats from Firebase
      if (typeof closesAt === 'number') {
        endTime = new Date(closesAt)
      } else if (closesAt._seconds) {
        endTime = new Date(closesAt._seconds * 1000)
      } else if (closesAt.seconds) {
        endTime = new Date(closesAt.seconds * 1000)
      } else {
        endTime = new Date(closesAt)
      }
      
      // Check if date is valid
      if (isNaN(endTime.getTime())) {
        // If invalid, use end of today
        endTime = new Date()
        endTime.setHours(23, 59, 59, 999)
      }
      
      const diff = endTime.getTime() - now.getTime()
      
      if (diff <= 0) {
        setTimeLeft('Challenge ended')
        return
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setTimeLeft(`${hours}h ${minutes}m`)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [closesAt])
  
  const loadLeaderboard = async () => {
    try {
      const data = await api.leaderboard.get('daily-challenge')
      console.log('Leaderboard data:', data)
      setLeaderboard(data.entries || [])
      setPot(data.pot || 0)
      setUserRank(data.userRank)
      setClosesAt(data.closesAt)
      setCalculatedPrizes(data.calculatedPrizes || [])
      setIsLoading(false)
    } catch (error: any) {
      console.error('Failed to load leaderboard:', error)
      console.error('Error details:', error.response?.data)
      // Set empty data but don't redirect
      setLeaderboard([])
      setPot(0)
      setIsLoading(false)
    }
  }
  
  const formatTime = (timeMs: number) => {
    const minutes = Math.floor(timeMs / 60000)
    const seconds = Math.floor((timeMs % 60000) / 1000)
    const ms = Math.floor((timeMs % 1000) / 10)
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }
  
  const calculatePrize = (rank: number) => {
    // Use calculated prizes from backend if available
    const prizeData = calculatedPrizes.find((p: any) => p.position === rank)
    if (prizeData) {
      return prizeData.amount
    }
    
    // Fallback to default calculation
    if (rank === 1) return Math.floor(pot * 0.40)
    if (rank === 2) return Math.floor(pot * 0.25)
    if (rank === 3) return Math.floor(pot * 0.15)
    return 0
  }

  return (
    <div className="min-h-screen relative py-4 md:py-8 px-4">
      <div className="absolute top-2 right-2 md:top-4 md:right-4 flex items-center gap-2 md:gap-3">
        <div className="text-xs md:text-sm text-gray-600 hidden sm:block">
          {user?.displayName || user?.email}
          {user?.isAdmin && <span className="ml-2 text-xs bg-purple-500 text-white px-2 py-1 rounded">ADMIN</span>}
        </div>
        <button
          onClick={logout}
          className="px-3 py-1 md:px-4 md:py-2 text-sm md:text-base bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Logout
        </button>
      </div>
      
      <div className="max-w-4xl mx-auto">
        <div className="candy-card mb-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-candy text-candy-pink mb-2">Leaderboard</h1>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3 md:gap-6">
              <div>
                <span className="text-sm text-gray-600">Prize Pool:</span>
                <span className="text-xl md:text-2xl font-bold text-candy-green ml-2 flex items-center gap-1 inline-flex">
                  <img src="/goldbars.png" alt="Gold" className="w-6 h-6" />
                  {pot}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-600">Closes in:</span>
                <span className="text-xl md:text-2xl font-bold text-candy-orange ml-2">{timeLeft}</span>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-2xl font-candy text-candy-pink animate-pulse">Loading...</div>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry, index) => {
                const rank = index + 1
                const prize = calculatePrize(rank)
                const isCurrentUser = entry.userId === user?.id
                return (
                  <div
                    key={entry.attemptId}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      rank === 1
                        ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 border-2 border-yellow-400'
                        : rank === 2
                        ? 'bg-gradient-to-r from-gray-100 to-gray-200 border-2 border-gray-400'
                        : rank === 3
                        ? 'bg-gradient-to-r from-orange-100 to-orange-200 border-2 border-orange-400'
                        : prize > 0
                        ? 'bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300'
                        : isCurrentUser
                        ? 'bg-candy-blue/10 border-2 border-candy-blue'
                        : 'bg-white border-2 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-xl md:text-2xl font-bold">
                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                      </div>
                      <div>
                        <p className="font-bold text-sm md:text-base">
                          {entry.displayName}
                          {isCurrentUser && <span className="text-candy-blue ml-2 text-xs md:text-sm">(You)</span>}
                        </p>
                        <p className="text-xs md:text-sm text-gray-600">Time: {formatTime(entry.timeMs)}</p>
                      </div>
                    </div>
                    {prize > 0 && (
                      <div className="text-right flex items-center gap-1">
                        <img src="/goldbars.png" alt="Gold" className="w-5 h-5" />
                        <p className="font-bold text-candy-green">{prize}</p>
                      </div>
                    )}
                  </div>
                )
              })}
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
              onClick={() => navigate('/entry')}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-full hover:bg-gray-300"
            >
              Back to Home
            </button>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Players in prize positions win Gold Bars when the daily challenge closes!</p>
          <p>Prize winners are highlighted in green above.</p>
        </div>
      </div>
    </div>
  )
}