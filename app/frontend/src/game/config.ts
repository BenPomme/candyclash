import Phaser from 'phaser'

export const createGameConfig = (parent: string): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent,
  width: 600,
  height: 700,
  backgroundColor: '#1a1a2e',
  scene: [], // Don't auto-start any scenes - we'll add and start them manually
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  }
})