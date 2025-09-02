import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../api/client'

export function EntryPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [challenge, setChallenge] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    loadChallenge()
  }, [user, navigate])

  const loadChallenge = async () => {
    try {
      const data = await api.challenge.getToday()
      setChallenge(data)
    } catch (err) {
      setError('No active challenge available')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!challenge) return

    try {
      setIsLoading(true)
      const joinResponse = await api.challenge.join(challenge.challenge.id)
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
        <div className="candy-card max-w-md w-full text-center">
          <h2 className="text-2xl font-candy text-candy-red mb-4">{error}</h2>
          <button onClick={() => navigate('/')} className="candy-button">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="candy-card max-w-lg w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-candy text-candy-pink mb-2">
            {challenge?.challenge.name || 'Daily Challenge'}
          </h1>
          <div className="flex justify-center items-center gap-4 text-lg">
            <div className="flex items-center gap-2">
              <span className="text-gold-dark">🪙</span>
              <span className="font-bold">{user?.goldBalance || 0}</span>
            </div>
            <div className="text-gray-400">|</div>
            <div>
              <span className="text-sm text-gray-600">Prize Pool:</span>
              <span className="font-bold text-candy-green ml-2">
                🪙 {challenge?.pot || 0}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-candy-yellow/20 rounded-lg p-4">
            <h3 className="font-bold text-candy-orange mb-2">Challenge Objective</h3>
            <p>Collect 100 yellow candies as fast as you can!</p>
          </div>

          <div className="bg-candy-blue/20 rounded-lg p-4">
            <h3 className="font-bold text-candy-blue mb-2">Entry Fee</h3>
            <p className="text-2xl">🪙 {challenge?.challenge.entryFee || 20} Gold Bars</p>
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