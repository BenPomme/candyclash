# Sound Effects Directory

Place game sound effects in this directory. Supported formats:
- .mp3
- .wav
- .ogg (recommended for web games)

## Suggested Sound Effects

### Essential Sounds
- `match.mp3` - When candies match
- `swap.mp3` - When swapping candies
- `invalid-swap.mp3` - When swap is invalid
- `cascade.mp3` - When candies cascade down
- `level-complete.mp3` - When level is completed
- `bonus.mp3` - For special candy effects

### UI Sounds
- `button-click.mp3` - Button press
- `coin-collect.mp3` - When collecting rewards
- `countdown.mp3` - Timer warning

### Special Effects
- `color-bomb.mp3` - Color bomb explosion
- `striped-candy.mp3` - Striped candy activation
- `wrapped-candy.mp3` - Wrapped candy explosion

## Usage in Game

Load sounds in Phaser preload:
```javascript
this.load.audio('match', '/sounds/match.mp3')
```

Play sounds:
```javascript
this.sound.play('match', { volume: 0.5 })
```