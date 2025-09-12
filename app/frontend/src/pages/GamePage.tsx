import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import Phaser from 'phaser'
import { createGameConfig } from '../game/config'
import { Match3Scene } from '../game/Match3Scene'
import { api } from '../api/client'

export function GamePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const gameState = location.state as any
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false)
  const [levelConfig, setLevelConfig] = useState<any>(null)
  
  // Check if this is test play mode
  const isTestPlay = sessionStorage.getItem('isTestPlay') === 'true'
  const testLevel = isTestPlay ? JSON.parse(sessionStorage.getItem('testLevel') || '{}') : null
  
  const getObjectiveText = () => {
    const config = levelConfig || (isTestPlay ? testLevel : gameState?.level)
    const objectives = config?.objectives
    const primary = objectives?.primary
    
    if (!primary) {
      return 'Complete the challenge!'
    }
    
    switch (primary.type) {
      case 'collect':
        const target = primary.target
        const count = primary.count
        if (!target || !count) return 'Complete the challenge!'
        return `Collect ${count} ${target} candies`
      
      case 'score':
        const score = primary.score
        if (!score) return 'Complete the challenge!'
        return `Score ${score.toLocaleString()} points`
      
      case 'clear':
        return 'Clear all special tiles'
      
      default:
        return 'Complete the challenge!'
    }
  }

  // Function to initialize the game with valid config
  const initializeGame = (config: any) => {
    console.log('Initializing game with config:', config)
    console.log('Candy colors from config:', config?.candies?.colors)
    
    // Create Phaser game instance
    const phaserConfig = createGameConfig('game-container')
    gameRef.current = new Phaser.Game(phaserConfig)
    
    // Add the scene manually (it won't auto-start)
    gameRef.current.scene.add('Match3Scene', Match3Scene, false)
    
    // Parse board seed from attempt token if available
    let boardSeed: string | undefined
    if (!isTestPlay && gameState?.attemptToken) {
      try {
        const tokenData = JSON.parse(atob(gameState.attemptToken))
        boardSeed = tokenData.boardSeed
        if (boardSeed) {
          console.log('Found board seed in attempt token:', boardSeed)
        }
      } catch (err) {
        console.error('Failed to parse attempt token:', err)
      }
    }

    // Start the game scene with validated data
    setTimeout(() => {
      gameRef.current?.scene.start('Match3Scene', {
        attemptId: isTestPlay ? 'test-play' : gameState?.attemptId,
        attemptToken: isTestPlay ? 'test-token' : gameState?.attemptToken,
        targetType: config.objectives.primary.target,
        targetCount: config.objectives.primary.count,
        gridWidth: config?.grid?.width || 8,
        gridHeight: config?.grid?.height || 8,
        candyColors: config?.candies?.colors || ['red', 'blue', 'green', 'yellow', 'purple', 'orange'],
        boardSeed,
        isTestPlay,
        onComplete: () => {
          if (isTestPlay) {
            sessionStorage.removeItem('isTestPlay')
            sessionStorage.removeItem('testLevel')
            navigate('/editor')
          } else {
            navigate('/leaderboard')
          }
        }
      })
    }, 100)
  }

  useEffect(() => {
    // Check authentication
    if (!user) {
      navigate('/entry')
      return
    }
    
    // Check if we have required game state
    if (!isTestPlay && !gameState?.attemptId) {
      navigate('/entry')
      return
    }

    // Determine level config
    let config = isTestPlay ? testLevel : gameState?.level
    
    // If we don't have level config, try to fetch the challenge data
    if (!config || !config.objectives || !config.objectives.primary) {
      console.log('Level config missing, fetching challenge data...')
      setIsLoadingChallenge(true)
      
      api.challenge.getToday()
        .then(data => {
          console.log('Fetched challenge data:', data)
          config = data.level
          setLevelConfig(config)
          setIsLoadingChallenge(false)
          
          // Now start the game with fetched data
          if (config && config.objectives && config.objectives.primary) {
            initializeGame(config)
          } else {
            console.error('Still no valid level config after fetch:', config)
            navigate('/entry')
          }
        })
        .catch(err => {
          console.error('Failed to fetch challenge:', err)
          setIsLoadingChallenge(false)
          navigate('/entry')
        })
      return
    }
    
    // We have valid config, initialize the game
    setLevelConfig(config)
    initializeGame(config)
  }, [user, navigate, gameState, isTestPlay])

  // Cleanup effect for Phaser
  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
      }
    }
  }, [])

  // Don't render a separate loading screen - we'll show loading in the game container

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-purple-100 to-pink-100">
      {isTestPlay && (
        <div className="absolute top-2 left-2 md:top-4 md:left-4 px-3 py-1 md:px-4 md:py-2 text-sm md:text-base bg-yellow-500 text-white rounded-lg z-10">
          TEST PLAY
        </div>
      )}
      <button
        onClick={() => {
          if (isTestPlay) {
            sessionStorage.removeItem('isTestPlay')
            sessionStorage.removeItem('testLevel')
            navigate('/editor')
          } else {
            logout()
          }
        }}
        className="absolute top-2 right-2 md:top-4 md:right-4 px-3 py-1 md:px-4 md:py-2 text-sm md:text-base bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors z-10"
      >
        {isTestPlay ? 'Exit' : 'Quit'}
      </button>
      
      <div className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        <div className="text-center mb-2 md:mb-4">
          <div className="bg-gradient-to-r from-candy-yellow to-candy-orange rounded-full px-4 py-2 md:px-6 md:py-3 inline-block mb-1 md:mb-2">
            <h2 className="text-base md:text-xl font-bold text-white">{getObjectiveText()}</h2>
          </div>
          <h1 className="text-xl md:text-3xl font-candy text-candy-pink hidden md:block">Game In Progress</h1>
        </div>
        
        <div className="flex justify-center">
          <div className="bg-white rounded-lg shadow-2xl p-2 md:p-4">
            <div id="game-container" className="mx-auto relative" ref={gameContainerRef}>
              {isLoadingChallenge && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 rounded">
                  <div className="text-center">
                    <div className="text-2xl font-candy text-white animate-pulse mb-2">Loading Challenge...</div>
                    <div className="text-sm text-gray-300">Please wait while we fetch the game data</div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-2 md:mt-4 flex justify-center">
              
              <button
                onClick={() => navigate('/entry')}
                className="px-3 py-1 md:px-4 md:py-2 text-sm md:text-base bg-red-500 text-white rounded-lg hover:bg-red-600"
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