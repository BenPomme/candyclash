import React, { useEffect, useState } from 'react'
import { Trophy, TrendingUp, Target, Percent } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

interface GlobalLeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  netGoldChange: number
  gamesPlayed?: number
  wins?: number
  winRate?: string
}

interface GlobalStats {
  totalPlayers: number
  totalGamesPlayed: number
  totalGoldCirculated: number
  averageGamesPerPlayer: string
  topWinner: {
    userId: string
    displayName: string
    netGoldChange: number
  }
}

const GlobalLeaderboard: React.FC = () => {
  const [entries, setEntries] = useState<GlobalLeaderboardEntry[]>([])
  const [userRank, setUserRank] = useState<number | string | null>(null)
  const [userStats, setUserStats] = useState<any>(null)
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, token } = useAuthStore()
  const currentUserId = user?.id

  useEffect(() => {
    fetchGlobalLeaderboard()
    fetchGlobalStats()
  }, [currentUserId])

  const fetchGlobalLeaderboard = async () => {
    try {
      setLoading(true)
      const params: any = { limit: 50 }
      if (currentUserId) {
        params.userId = currentUserId
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/global-leaderboard?${new URLSearchParams(params)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      setEntries(data.leaderboard || [])
      setUserRank(data.userRank)
      setUserStats(data.userStats)
    } catch (err) {
      console.error('Failed to fetch global leaderboard:', err)
      setError('Failed to load global leaderboard')
    } finally {
      setLoading(false)
    }
  }

  const fetchGlobalStats = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/global-stats/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      setGlobalStats(data)
    } catch (err) {
      console.error('Failed to fetch global stats:', err)
    }
  }

  const formatGoldChange = (amount: number) => {
    const sign = amount >= 0 ? '+' : ''
    return `${sign}${amount.toLocaleString()}`
  }

  const getRowColor = (entry: GlobalLeaderboardEntry) => {
    if (entry.rank === 1) return 'bg-gradient-to-r from-yellow-100 to-yellow-50 border-yellow-300'
    if (entry.rank === 2) return 'bg-gradient-to-r from-gray-100 to-gray-50 border-gray-300'
    if (entry.rank === 3) return 'bg-gradient-to-r from-orange-100 to-orange-50 border-orange-300'
    if (entry.userId === currentUserId) return 'bg-blue-50 border-blue-300'
    return 'bg-white'
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '👑'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return null
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Global Stats Summary */}
      {globalStats && (
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-6 text-white">
          <h3 className="text-xl font-bold mb-4">Global Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm opacity-90">Total Players</p>
              <p className="text-2xl font-bold">{globalStats.totalPlayers}</p>
            </div>
            <div>
              <p className="text-sm opacity-90">Total Games</p>
              <p className="text-2xl font-bold">{globalStats.totalGamesPlayed}</p>
            </div>
            <div>
              <p className="text-sm opacity-90">Gold Circulated</p>
              <p className="text-2xl font-bold">{globalStats.totalGoldCirculated.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm opacity-90">Avg Games/Player</p>
              <p className="text-2xl font-bold">{globalStats.averageGamesPerPlayer}</p>
            </div>
          </div>
        </div>
      )}

      {/* User's Global Stats */}
      {userStats && currentUserId && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Your Global Ranking</p>
              <p className="text-2xl font-bold text-blue-600">
                {typeof userRank === 'number' ? `#${userRank}` : userRank}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Net Gold Change</p>
              <p className={`text-2xl font-bold ${userStats.netGoldChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatGoldChange(userStats.netGoldChange)}
              </p>
            </div>
            {userStats.gamesPlayed > 0 && (
              <>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Games Played</p>
                  <p className="text-xl font-bold">{userStats.gamesPlayed}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Win Rate</p>
                  <p className="text-xl font-bold">{userStats.winRate}%</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6" />
            All-Time Global Leaderboard
          </h2>
          <p className="text-sm text-white opacity-90 mt-1">
            Cumulative gold bar gains across all games
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-1">
                    <TrendingUp className="w-4 h-4" />
                    Net Gold
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  <div className="flex items-center justify-end gap-1">
                    <Target className="w-4 h-4" />
                    Games
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  <div className="flex items-center justify-end gap-1">
                    <Trophy className="w-4 h-4" />
                    Wins
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  <div className="flex items-center justify-end gap-1">
                    <Percent className="w-4 h-4" />
                    Win Rate
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr
                  key={entry.userId}
                  className={`${getRowColor(entry)} border-l-4 transition-all duration-300 hover:shadow-md`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">
                        {getRankIcon(entry.rank) || `#${entry.rank}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {entry.displayName}
                        {entry.userId === currentUserId && (
                          <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">You</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className={`font-bold text-lg ${entry.netGoldChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatGoldChange(entry.netGoldChange)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right hidden md:table-cell">
                    <span className="text-gray-700">
                      {entry.gamesPlayed || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right hidden md:table-cell">
                    <span className="text-gray-700">
                      {entry.wins || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right hidden lg:table-cell">
                    <span className="text-gray-700">
                      {entry.winRate || '0.0'}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {entries.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No players on the global leaderboard yet
          </div>
        )}
      </div>
    </div>
  )
}

export default GlobalLeaderboard