import Phaser from 'phaser'

export const createGameConfig = (parent: string): Phaser.Types.Core.GameConfig => {
  // Calculate game dimensions based on window size
  const maxWidth = 600
  const maxHeight = 700
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight - 100 // Leave space for UI elements
  
  // Calculate scale to fit the screen while maintaining aspect ratio
  const scaleX = windowWidth / maxWidth
  const scaleY = windowHeight / maxHeight
  const scale = Math.min(scaleX, scaleY, 1) // Don't scale up beyond original size
  
  const gameWidth = Math.floor(maxWidth * scale)
  const gameHeight = Math.floor(maxHeight * scale)
  
  return {
    type: Phaser.AUTO,
    parent,
    width: gameWidth,
    height: gameHeight,
    backgroundColor: '#1a1a2e',
    scene: [], // Don't auto-start any scenes - we'll add and start them manually
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: maxWidth,
      height: maxHeight,
      min: {
        width: 320,
        height: 400
      },
      max: {
        width: maxWidth,
        height: maxHeight
      }
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false
      }
    },
    input: {
      activePointers: 3 // Support multi-touch for mobile
    }
  }
}