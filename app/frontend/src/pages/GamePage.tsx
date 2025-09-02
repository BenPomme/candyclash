import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import Phaser from 'phaser'
import { createGameConfig } from '../game/config'

export function GamePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const gameState = location.state as any

  useEffect(() => {
    if (!user || !gameState?.attemptId) {
      navigate('/entry')
      return
    }

    // Initialize Phaser game
    const config = createGameConfig('game-container')
    gameRef.current = new Phaser.Game(config)
    
    // Start the game scene with attempt data
    setTimeout(() => {
      gameRef.current?.scene.start('Match3Scene', {
        attemptId: gameState.attemptId,
        attemptToken: gameState.attemptToken,
        targetType: gameState.level?.objectives?.primary?.target || 'yellow',
        targetCount: gameState.level?.objectives?.primary?.count || 100
      })
    }, 100)

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
      }
    }
  }, [user, navigate, gameState])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-candy text-candy-pink">Game In Progress</h1>
        </div>
        
        <div className="flex justify-center">
          <div className="bg-white rounded-lg shadow-2xl p-4">
            <div id="game-container" className="mx-auto" ref={gameContainerRef} />
            
            <div className="mt-4 flex justify-center">
              
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