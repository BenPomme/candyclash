import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../api/client'

export function EntryPage() {
  const navigate = useNavigate()
  const { user, logout, updateBalance } = useAuthStore()
  const [challenge, setChallenge] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [timeRemaining, setTimeRemaining] = useState('')
  const [userRank, setUserRank] = useState<number | null>(null)

  const getObjectiveText = (challenge: any) => {
    if (!challenge?.level?.objectives?.primary) {
      return 'Complete the challenge as fast as you can!'
    }
    
    const objectives = challenge.level?.objectives
    const primary = objectives?.primary
    
    if (!primary) {
      return 'Complete the challenge as fast as you can!'
    }
    
    switch (primary.type) {
      case 'collect':
        const target = primary.target || 'yellow'
        const count = primary.count || 100
        return `Collect ${count} ${target} candies as fast as you can!`
      
      case 'score':
        const score = primary.score || 10000
        return `Reach a score of ${score.toLocaleString()} points as fast as you can!`
      
      case 'clear':
        return 'Clear all special tiles from the board as fast as you can!'
      
      default:
        return 'Complete the challenge as fast as you can!'
    }
  }

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    loadChallenge()
    loadLeaderboard()
  }, [user, navigate])

  useEffect(() => {
    if (!challenge) return

    const updateCountdown = () => {
      const now = new Date()
      
      // Handle different date formats from Firebase
      let endTimeValue = challenge.closesAt || challenge.challenge?.endsAt
      let endTime: Date
      
      if (!endTimeValue) {
        setTimeRemaining('No end time set')
        return
      }
      
      // Handle Firestore timestamp format
      if (endTimeValue._seconds) {
        endTime = new Date(endTimeValue._seconds * 1000)
      } else if (endTimeValue.seconds) {
        endTime = new Date(endTimeValue.seconds * 1000)
      } else if (typeof endTimeValue === 'string') {
        endTime = new Date(endTimeValue)
      } else {
        endTime = new Date(endTimeValue)
      }
      
      // Check if date is valid
      if (isNaN(endTime.getTime())) {
        // If invalid, try to set it to end of today
        endTime = new Date()
        endTime.setHours(23, 59, 59, 999)
      }
      
      const diff = endTime.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining('Challenge ended')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setTimeRemaining(`${hours}h ${minutes}m`)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [challenge])

  const loadChallenge = async () => {
    try {
      const data = await api.challenge.getToday()
      console.log('Challenge data:', data) // Debug log
      setChallenge(data)
    } catch (err) {
      setError('No active challenge available')
    } finally {
      setIsLoading(false)
    }
  }

  const loadLeaderboard = async () => {
    try {
      const data = await api.leaderboard.get('daily-challenge', 10)
      setUserRank(data.userRank)
    } catch (err) {
      // Silently fail - leaderboard is optional
    }
  }

  const handleJoin = async () => {
    if (!challenge) return

    try {
      setIsLoading(true)
      const joinResponse = await api.challenge.join(challenge.challenge.id)
      
      // Update the local balance to reflect the entry fee deduction
      if (user && challenge.challenge.entryFee) {
        updateBalance(user.goldBalance - challenge.challenge.entryFee)
      }
      
      navigate('/game', {
        state: {
          attemptId: joinResponse.attemptId,
          attemptToken: joinResponse.attemptToken,
          challengeId: challenge.challenge.id,
          level: challenge.level
        }
      })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join challenge')
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl font-candy text-candy-pink animate-pulse">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
          <div className="text-sm text-gray-600">
            {user?.displayName || user?.email}
            {user?.isAdmin && <span className="ml-2 text-xs bg-purple-500 text-white px-2 py-1 rounded">ADMIN</span>}
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
        
        <div className="candy-card max-w-md w-full text-center">
          <h2 className="text-2xl font-candy text-candy-red mb-4">{error}</h2>
          
          {user?.isAdmin && (
            <div className="mb-4 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
              <p className="text-sm text-gray-700 mb-2">As an admin, you can create a new challenge</p>
              <button 
                onClick={() => navigate('/admin')} 
                className="px-6 py-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 font-bold"
              >
                Go to Admin Panel
              </button>
            </div>
          )}
          
          <button onClick={() => window.location.reload()} className="candy-button">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
        <div className="text-sm text-gray-600">
          {user?.displayName || user?.email}
          {user?.isAdmin && <span className="ml-2 text-xs bg-purple-500 text-white px-2 py-1 rounded">ADMIN</span>}
        </div>
        {user?.isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            Admin Panel
          </button>
        )}
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Logout
        </button>
      </div>
      
      <div className="candy-card max-w-lg w-full">
          <div className="text-center mb-6">
          <div className="mb-3">
            <div className="text-sm text-gray-600">Welcome back,</div>
            <div className="text-xl font-bold text-candy-purple">
              {user?.displayName || user?.email}
            </div>
          </div>
          
          <h1 className="text-3xl font-candy text-candy-pink mb-2">
            {challenge?.challenge.name || 'Daily Challenge'}
          </h1>
          
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-3 mb-3">
            <div className="text-sm text-gray-600 mb-1">Challenge ends in</div>
            <div className="text-2xl font-bold text-candy-purple">{timeRemaining}</div>
          </div>

          <div className="flex justify-center items-center gap-4 text-lg mb-3">
            <div className="flex items-center gap-2">
              <img src="/goldbars.png" alt="Gold" className="w-6 h-6" />
              <span className="font-bold">{user?.goldBalance || 0}</span>
            </div>
            <div className="text-gray-400">|</div>
            <div>
              <span className="text-sm text-gray-600">Prize Pool:</span>
              <span className="font-bold text-candy-green ml-2 flex items-center gap-1 inline-flex">
                <img src="/goldbars.png" alt="Gold" className="w-5 h-5" />
                {challenge?.pot || 0}
              </span>
            </div>
          </div>

          {userRank && (
            <div className="bg-yellow-100 rounded-lg p-2">
              <span className="text-sm text-gray-600">Your Current Rank: </span>
              <span className="font-bold text-lg">#{userRank}</span>
              {userRank <= 3 && <span className="ml-2">🏆</span>}
            </div>
          )}
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-candy-yellow/20 rounded-lg p-4">
            <h3 className="font-bold text-candy-orange mb-2">Challenge Objective</h3>
            <p>{getObjectiveText(challenge)}</p>
          </div>

          <div className="bg-candy-blue/20 rounded-lg p-4">
            <h3 className="font-bold text-candy-blue mb-2">Entry Fee</h3>
            <p className="text-2xl flex items-center gap-2">
              <img src="/goldbars.png" alt="Gold" className="w-8 h-8" />
              {challenge?.challenge.entryFee || 20} Gold Bars
            </p>
          </div>

          <div className="bg-candy-green/20 rounded-lg p-4">
            <h3 className="font-bold text-candy-green mb-2">Attempts Remaining</h3>
            <p className="text-2xl">{challenge?.attemptsLeft || 0} / 2 today</p>
          </div>

          <div className="bg-candy-purple/20 rounded-lg p-4">
            <h3 className="font-bold text-candy-purple mb-2">Prize Distribution</h3>
            <div className="space-y-1 text-sm">
              <p>🥇 1st Place: 40% of pot</p>
              <p>🥈 2nd Place: 25% of pot</p>
              <p>🥉 3rd Place: 15% of pot</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleJoin}
            disabled={
              !challenge ||
              challenge.attemptsLeft <= 0 ||
              user!.goldBalance < challenge.challenge.entryFee
            }
            className="flex-1 gold-button disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Play Now!
          </button>
          <button
            onClick={() => navigate('/leaderboard')}
            className="flex-1 candy-button"
          >
            View Leaderboard
          </button>
        </div>

        {user?.isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="w-full mt-4 px-6 py-3 bg-purple-500 text-white font-bold rounded-full hover:bg-purple-600 transition-colors"
          >
            Admin Dashboard
          </button>
        )}

        {challenge?.attemptsLeft <= 0 && (
          <p className="text-center text-red-500 mt-4">
            You've used all your attempts for today!
          </p>
        )}
        
        {user && challenge && user.goldBalance < challenge.challenge.entryFee && (
          <p className="text-center text-red-500 mt-4">
            Not enough Gold Bars to enter!
          </p>
        )}
      </div>
    </div>
  )
}