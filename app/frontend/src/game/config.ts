import Phaser from 'phaser'
import { Match3Scene } from './Match3Scene'

export const createGameConfig = (parent: string): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent,
  width: 600,
  height: 700,
  backgroundColor: '#1a1a2e',
  scene: [Match3Scene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  }
})