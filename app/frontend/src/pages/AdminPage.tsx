import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../api/client'
import { DistributionConfigurator, type DistributionConfig, validateDistribution } from '../components/DistributionConfigurator'

export function AdminPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [pot, setPot] = useState(0)
  const [challengeStatus, setChallengeStatus] = useState<'active' | 'closed' | 'none'>('active')
  const [levels, setLevels] = useState<any[]>([])
  const [selectedLevelId, setSelectedLevelId] = useState<string>('default-level')
  const [showLevelSelector, setShowLevelSelector] = useState(false)
  const [showDistributionConfig, setShowDistributionConfig] = useState(false)
  const [distributionConfig, setDistributionConfig] = useState<DistributionConfig>({
    type: 'percentage',
    rules: [
      { position: 1, amount: 40, type: 'percentage' },
      { position: 2, amount: 25, type: 'percentage' },
      { position: 3, amount: 15, type: 'percentage' },
    ],
    rake: 5,
    rake_type: 'percentage',
    minimum_players: 3,
    refund_on_insufficient: true,
  })

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    if (!user.isAdmin) {
      setError('Admin access required')
      setTimeout(() => navigate('/entry'), 2000)
      return
    }

    loadLeaderboard()
    loadLevels()
  }, [user, navigate])

  const loadLevels = async () => {
    try {
      const response = await api.levels.list()
      setLevels(response.levels || [])
      console.log('Loaded levels:', response.levels)
    } catch (error) {
      console.error('Failed to load levels:', error)
    }
  }

  const loadLeaderboard = async () => {
    try {
      // Always try to get leaderboard data first
      const data = await api.leaderboard.get('daily-challenge')
      setLeaderboard(data.entries || [])
      setPot(data.pot || 0)
      
      // Check if challenge is active by trying to get today's challenge
      try {
        const challengeData = await api.challenge.getToday()
        console.log('Challenge data:', challengeData)
        setChallengeStatus('active')
      } catch (error: any) {
        console.log('Challenge error:', error.response?.data)
        // If error message indicates challenge is closed
        if (error.response?.data?.error?.includes('ended') || 
            error.response?.data?.error?.includes('closed')) {
          setChallengeStatus('closed')
        } else {
          setChallengeStatus('none')
        }
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
      // Even if leaderboard fails, try to check challenge status
      try {
        await api.challenge.getToday()
        setChallengeStatus('active')
      } catch {
        setChallengeStatus('closed')
      }
    }
  }

  const handleCloseChallenge = async () => {
    if (!confirm('Are you sure you want to close the daily challenge and distribute prizes?')) {
      return
    }

    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/challenge/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ challengeId: 'daily-challenge' })
      })

      if (!response.ok) {
        throw new Error(`Failed to close challenge: ${response.statusText}`)
      }

      const result = await response.json()
      setMessage(result.message || 'Challenge closed successfully!')
      
      // Reload leaderboard to see the updated state
      setTimeout(() => loadLeaderboard(), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to close challenge')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateChallenge = async () => {
    // Show level selector if not already shown
    if (!showLevelSelector) {
      setShowLevelSelector(true)
      return
    }

    // Show distribution config after level selection
    if (!showDistributionConfig) {
      if (!selectedLevelId) {
        alert('Please select a level for the challenge')
        return
      }
      setShowDistributionConfig(true)
      return
    }

    // Validate distribution before creating challenge
    if (!validateDistribution(distributionConfig)) {
      setError('Invalid prize distribution: payouts + rake must equal 100%')
      return
    }

    if (!confirm(`Create a new daily challenge with level: ${levels.find(l => l.id === selectedLevelId)?.name || selectedLevelId}?`)) {
      return
    }

    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      const selectedLevel = levels.find(l => l.id === selectedLevelId)
      const entryFee = selectedLevel?.config?.difficulty?.entryFee || 20
      const attemptsPerDay = selectedLevel?.config?.difficulty?.attemptsPerDay || 2
      
      const token = localStorage.getItem('token')
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/challenge/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: 'Daily Clash',
          levelId: selectedLevelId,
          entryFee,
          attemptsPerDay,
          rakeBps: 0,
          startsImmediately: true,
          prizeDistribution: distributionConfig
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create challenge: ${response.statusText}`)
      }

      const result = await response.json()
      setMessage(result.message || 'Challenge created successfully!')
      setShowLevelSelector(false)
      setShowDistributionConfig(false)
      
      // Reload leaderboard to see the new state
      setTimeout(() => loadLeaderboard(), 1000)
    } catch (err: any) {
      setError(err.message || 'Failed to create challenge')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSeedDatabase = async () => {
    if (!confirm('This will reset and seed the database. Continue?')) {
      return
    }

    setIsLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/seed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to seed database: ${response.statusText}`)
      }

      const result = await response.json()
      setMessage(result.message || 'Database seeded successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to seed database')
    } finally {
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
    if (rank === 1) return Math.floor(pot * 0.40)
    if (rank === 2) return Math.floor(pot * 0.25)
    if (rank === 3) return Math.floor(pot * 0.15)
    return 0
  }

  return (
    <div className="min-h-screen relative py-8 px-4">
      <button
        onClick={logout}
        className="absolute top-4 right-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
      >
        Logout
      </button>

      <div className="max-w-6xl mx-auto">
        <div className="candy-card mb-6">
          <h1 className="text-3xl font-candy text-candy-pink mb-6">Admin Dashboard</h1>
          
          {message && (
            <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
              {message}
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gradient-to-r from-purple-100 to-purple-200 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">Challenge Management</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  <p className="text-xl font-bold">
                    {challengeStatus === 'active' && <span className="text-green-600">🟢 Active</span>}
                    {challengeStatus === 'closed' && <span className="text-red-600">🔴 Closed</span>}
                    {challengeStatus === 'none' && <span className="text-gray-600">⚫ No Challenge</span>}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Current Pot</p>
                  <p className="text-2xl font-bold text-candy-green flex items-center gap-1">
                    <img src="/goldbars.png" alt="Gold" className="w-6 h-6" />
                    {pot}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Players</p>
                  <p className="text-2xl font-bold">{leaderboard.length}</p>
                </div>
              </div>
              {challengeStatus === 'active' ? (
                <button
                  onClick={handleCloseChallenge}
                  disabled={isLoading}
                  className="mt-6 w-full px-6 py-3 bg-red-500 text-white font-bold rounded-full hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Processing...' : leaderboard.length === 0 ? 'Close Challenge (No Winners)' : 'Close Challenge & Pay Winners'}
                </button>
              ) : (
                <>
                  {showLevelSelector && !showDistributionConfig && (
                    <div className="mt-4 space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Select Level for Challenge:
                      </label>
                      <select
                        value={selectedLevelId}
                        onChange={(e) => setSelectedLevelId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                      >
                        <option value="">-- Select a Level --</option>
                        <option value="default-level">Default Level (Classic)</option>
                        {levels.map((level) => (
                          <option key={level.id} value={level.id}>
                            {level.name} ({level.config?.grid?.width}x{level.config?.grid?.height})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {showDistributionConfig && (
                    <div className="mt-4">
                      <h3 className="text-lg font-medium mb-2">Prize Distribution Configuration</h3>
                      <DistributionConfigurator
                        value={distributionConfig}
                        onChange={setDistributionConfig}
                      />
                    </div>
                  )}
                  <button
                    onClick={handleCreateChallenge}
                    disabled={isLoading || (showLevelSelector && !selectedLevelId) || (showDistributionConfig && !validateDistribution(distributionConfig))}
                    className="mt-6 w-full px-6 py-3 bg-green-500 text-white font-bold rounded-full hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Processing...' : 
                     showDistributionConfig ? (validateDistribution(distributionConfig) ? 'Confirm & Create Challenge' : 'Fix Distribution (Must = 100%)') :
                     showLevelSelector ? 'Next: Configure Prizes' : 
                     'Create New Challenge'}
                  </button>
                  {(showLevelSelector || showDistributionConfig) && (
                    <button
                      onClick={() => {
                        if (showDistributionConfig) {
                          setShowDistributionConfig(false)
                        } else {
                          setShowLevelSelector(false)
                        }
                      }}
                      className="mt-2 w-full px-6 py-3 bg-gray-300 text-gray-700 font-bold rounded-full hover:bg-gray-400 transition-colors"
                    >
                      {showDistributionConfig ? 'Back' : 'Cancel'}
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="bg-gradient-to-r from-blue-100 to-blue-200 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">System Actions</h2>
              <div className="space-y-4">
                <button
                  onClick={() => navigate('/editor')}
                  className="w-full px-6 py-3 bg-purple-500 text-white font-bold rounded-full hover:bg-purple-600 transition-colors"
                >
                  Level Editor
                </button>
                <button
                  onClick={handleSeedDatabase}
                  disabled={isLoading}
                  className="w-full px-6 py-3 bg-blue-500 text-white font-bold rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Processing...' : 'Seed Database'}
                </button>
                <button
                  onClick={() => navigate('/entry')}
                  className="w-full px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-full hover:bg-gray-300 transition-colors"
                >
                  Back to Game
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Current Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <p className="text-gray-500">No entries yet</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-2 font-bold text-sm text-gray-600 pb-2 border-b">
                  <div>Rank</div>
                  <div>Player</div>
                  <div>Time</div>
                  <div>User ID</div>
                  <div>Prize</div>
                </div>
                {leaderboard.slice(0, 10).map((entry, index) => {
                  const rank = index + 1
                  const prize = calculatePrize(rank)
                  return (
                    <div key={entry.attemptId} className="grid grid-cols-5 gap-2 py-2 border-b">
                      <div className="font-bold">
                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                      </div>
                      <div>{entry.displayName}</div>
                      <div>{formatTime(entry.timeMs)}</div>
                      <div className="text-xs text-gray-500">{entry.userId.slice(0, 8)}...</div>
                      <div>
                        {prize > 0 && (
                          <span className="flex items-center gap-1 text-candy-green font-bold">
                            <img src="/goldbars.png" alt="Gold" className="w-4 h-4" />
                            {prize}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
            <h3 className="font-bold mb-2">Prize Distribution</h3>
            <ul className="text-sm space-y-1">
              <li>1st Place: 40% of pot = {Math.floor(pot * 0.40)} Gold Bars</li>
              <li>2nd Place: 25% of pot = {Math.floor(pot * 0.25)} Gold Bars</li>
              <li>3rd Place: 15% of pot = {Math.floor(pot * 0.15)} Gold Bars</li>
              <li>Platform keeps: 0% (no rake configured)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}