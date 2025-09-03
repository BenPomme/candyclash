import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../api/client'

export function LevelEditorPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [levelName, setLevelName] = useState('New Level')
  const [gridSize, setGridSize] = useState({ width: 8, height: 8 })
  const [objective, setObjective] = useState({ type: 'collect', target: 'yellow', count: 100 })
  const [entryFee, setEntryFee] = useState(20)
  const [candyColors, setCandyColors] = useState(['red', 'yellow', 'green', 'blue', 'purple'])

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/')
    }
  }, [user, navigate])

  if (!user?.isAdmin) {
    return null
  }

  const handleSave = async () => {
    const levelConfig = {
      name: levelName,
      config: {
        grid: {
          width: gridSize.width,
          height: gridSize.height,
        },
        objectives: {
          primary: objective,
          timeLimit: 180, // 3 minutes default
        },
        candies: {
          colors: candyColors,
        },
        difficulty: {
          entryFee,
          attemptsPerDay: 2,
          prizeDistribution: {
            '1st': 40,
            '2nd': 25,
            '3rd': 15,
          },
        },
      },
    }
    
    try {
      console.log('Saving level:', levelConfig)
      const response = await api.levels.create(levelConfig)
      console.log('Level saved:', response)
      alert(`Level "${levelName}" saved successfully!`)
      navigate('/admin')
    } catch (error: any) {
      console.error('Failed to save level:', error)
      alert('Failed to save level: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleTestPlay = () => {
    // Store the level config in sessionStorage for test play
    const testLevel = {
      grid: {
        width: gridSize.width,
        height: gridSize.height,
      },
      objectives: {
        primary: objective,
        timeLimit: 180, // 3 minutes for testing
      },
      candies: {
        colors: candyColors,
      },
    }
    
    console.log('Test play configuration:', testLevel)
    console.log('Selected candy colors:', candyColors)
    
    // Store as test level
    sessionStorage.setItem('testLevel', JSON.stringify(testLevel))
    sessionStorage.setItem('isTestPlay', 'true')
    
    // Navigate to game page
    navigate('/game')
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="candy-card">
          <h1 className="text-3xl font-candy text-candy-pink mb-6">Level Editor</h1>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Level Name
              </label>
              <input
                type="text"
                value={levelName}
                onChange={(e) => setLevelName(e.target.value)}
                className="w-full px-4 py-2 border-2 border-candy-pink rounded-lg focus:outline-none focus:border-candy-orange"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grid Width
                </label>
                <input
                  type="number"
                  min="6"
                  max="10"
                  value={gridSize.width}
                  onChange={(e) => setGridSize({ ...gridSize, width: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border-2 border-candy-pink rounded-lg focus:outline-none focus:border-candy-orange"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grid Height
                </label>
                <input
                  type="number"
                  min="6"
                  max="10"
                  value={gridSize.height}
                  onChange={(e) => setGridSize({ ...gridSize, height: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border-2 border-candy-pink rounded-lg focus:outline-none focus:border-candy-orange"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Objective Type
              </label>
              <select
                value={objective.type}
                onChange={(e) => setObjective({ ...objective, type: e.target.value })}
                className="w-full px-4 py-2 border-2 border-candy-pink rounded-lg focus:outline-none focus:border-candy-orange"
              >
                <option value="collect">Collect Candies</option>
                <option value="score">Reach Score</option>
                <option value="clear">Clear Board</option>
              </select>
            </div>

            {objective.type === 'collect' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Candy Color
                  </label>
                  <select
                    value={objective.target}
                    onChange={(e) => setObjective({ ...objective, target: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-candy-pink rounded-lg focus:outline-none focus:border-candy-orange"
                  >
                    {candyColors.map((color) => (
                      <option key={color} value={color}>
                        {color.charAt(0).toUpperCase() + color.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Count
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={objective.count}
                    onChange={(e) => setObjective({ ...objective, count: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border-2 border-candy-pink rounded-lg focus:outline-none focus:border-candy-orange"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entry Fee (Gold Bars)
              </label>
              <input
                type="number"
                min="5"
                max="100"
                value={entryFee}
                onChange={(e) => setEntryFee(parseInt(e.target.value))}
                className="w-full px-4 py-2 border-2 border-candy-pink rounded-lg focus:outline-none focus:border-candy-orange"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Candy Colors (Select at least 3, currently {candyColors.length} selected)
              </label>
              <div className="flex flex-wrap gap-2">
                {['red', 'yellow', 'green', 'blue', 'purple', 'orange'].map((color) => (
                  <label key={color} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={candyColors.includes(color)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCandyColors([...candyColors, color])
                        } else {
                          // Prevent unchecking if it would leave less than 3 colors
                          const newColors = candyColors.filter((c) => c !== color)
                          if (newColors.length >= 3) {
                            setCandyColors(newColors)
                          } else {
                            alert('You must select at least 3 candy colors!')
                          }
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="capitalize">{color}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-gray-100 rounded-lg p-4">
              <h3 className="font-bold mb-2">Grid Preview</h3>
              <div
                className="grid gap-1 mx-auto"
                style={{
                  gridTemplateColumns: `repeat(${gridSize.width}, 1fr)`,
                  width: `${gridSize.width * 30}px`,
                }}
              >
                {Array.from({ length: gridSize.width * gridSize.height }).map((_, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 bg-white border border-gray-300 rounded"
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={handleSave} className="flex-1 gold-button">
                Save Level
              </button>
              <button onClick={handleTestPlay} className="flex-1 candy-button">
                Test Play
              </button>
              <button
                onClick={() => navigate('/admin')}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-full hover:bg-gray-300"
              >
                Back to Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}