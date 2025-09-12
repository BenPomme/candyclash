import Phaser from 'phaser'
import { api } from '../api/client'

interface Candy extends Phaser.GameObjects.Sprite {
  row: number
  col: number
  candyType: string
}

// Seeded Random Number Generator for deterministic board generation
class SeededRandom {
  private seed: number

  constructor(seedString: string) {
    // Convert string seed to number using simple hash
    this.seed = 0
    for (let i = 0; i < seedString.length; i++) {
      const char = seedString.charCodeAt(i)
      this.seed = ((this.seed << 5) - this.seed) + char
      this.seed = this.seed & this.seed // Convert to 32-bit integer
    }
    // Ensure positive seed
    if (this.seed <= 0) this.seed = Math.abs(this.seed) + 1
  }

  // Linear Congruential Generator (LCG)
  next(): number {
    // Parameters from Numerical Recipes
    const a = 1664525
    const c = 1013904223
    const m = Math.pow(2, 32)
    
    this.seed = (a * this.seed + c) % m
    return this.seed / m
  }

  // Pick a random element from an array
  pick<T>(array: T[]): T {
    const index = Math.floor(this.next() * array.length)
    return array[index]
  }

  // Generate integer between min and max (inclusive)
  between(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }
}

export class Match3Scene extends Phaser.Scene {
  private grid: (Candy | null)[][] = []
  private gridWidth = 8  // Default, will be overridden by init
  private gridHeight = 8  // Default, will be overridden by init
  private tileSize = 64  // Will be calculated dynamically in create()
  private candyTypes = ['red', 'blue', 'green', 'yellow', 'purple', 'orange']  // Default with all 6 colors
  private selectedCandy: Candy | null = null
  private canMove = false  // Start with moves disabled until data loads
  private score = 0
  private collected: Record<string, number> = {}
  private targetCount: number | null = null  // No default - must be set from data
  private targetType: string | null = null   // No default - must be set from data
  private moveCount = 0
  private startTime = 0
  private dataLoaded = false  // Track if challenge data has been loaded
  private timerText!: Phaser.GameObjects.Text
  private scoreText!: Phaser.GameObjects.Text
  private progressText!: Phaser.GameObjects.Text
  private attemptId: string = ''
  private attemptToken: string = ''
  private onComplete?: () => void
  private isTestPlay = false
  private boardSeed: string | null = null
  private rng: SeededRandom | null = null

  constructor() {
    super({ key: 'Match3Scene' })
  }

  init(data: { 
    attemptId: string; 
    attemptToken: string; 
    targetType: string; 
    targetCount: number; 
    gridWidth?: number;
    gridHeight?: number;
    candyColors?: string[];
    isTestPlay?: boolean;
    boardSeed?: string;
    onComplete?: () => void 
  }) {
    this.attemptId = data.attemptId
    this.attemptToken = data.attemptToken
    // No defaults - if data is missing, the game should not start
    this.targetType = data.targetType
    this.targetCount = data.targetCount
    
    // Set grid dimensions from data or use defaults
    this.gridWidth = data.gridWidth || 8
    this.gridHeight = data.gridHeight || 8
    
    // Set candy colors from data or use defaults
    if (data.candyColors && data.candyColors.length >= 3) {
      this.candyTypes = data.candyColors
      console.log('Using custom candy colors:', this.candyTypes)
    } else if (data.candyColors && data.candyColors.length > 0) {
      console.warn('Not enough candy colors provided (need at least 3):', data.candyColors)
      // Still use defaults if less than 3 colors
    } else {
      console.log('No candy colors provided, using defaults:', this.candyTypes)
    }
    
    // Set test play flag
    this.isTestPlay = data.isTestPlay || false
    
    // Initialize seeded RNG if seed provided
    this.boardSeed = data.boardSeed || null
    if (this.boardSeed) {
      this.rng = new SeededRandom(this.boardSeed)
      console.log('Using deterministic board with seed:', this.boardSeed)
    } else {
      console.log('No board seed provided, using random generation')
    }
    
    // Adjust tile size based on grid dimensions to fit the screen
    const maxBoardWidth = 550
    const maxBoardHeight = 550
    this.tileSize = Math.min(
      Math.floor(maxBoardWidth / this.gridWidth),
      Math.floor(maxBoardHeight / this.gridHeight),
      64  // Maximum tile size
    )
    
    console.log('Game configuration:', {
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      tileSize: this.tileSize,
      candyTypes: this.candyTypes,
      targetType: this.targetType,
      targetCount: this.targetCount,
      isTestPlay: this.isTestPlay
    })
    
    if (!this.targetType || !this.targetCount) {
      console.error('ERROR: Challenge data missing!', { targetType: this.targetType, targetCount: this.targetCount })
      this.dataLoaded = false
    } else {
      this.dataLoaded = true
      console.log('Challenge data loaded:', { targetType: this.targetType, targetCount: this.targetCount })
    }
    
    this.startTime = Date.now()
    // Initialize collected object for all candy types
    this.collected = {}
    this.candyTypes.forEach(color => {
      this.collected[color] = 0
    })
    this.onComplete = data.onComplete
  }

  preload() {
    // Load candy images - all are PNG files now
    const candyFiles: Record<string, string> = {
      'red': '/candies/red.png',
      'blue': '/candies/blue.png', 
      'green': '/candies/green.png',
      'yellow': '/candies/yellow.png',
      'purple': '/candies/purple.png',
      'orange': '/candies/orange.png'
    }
    
    // Only load the candy types we're actually using
    this.candyTypes.forEach(color => {
      if (candyFiles[color]) {
        this.load.image(color, candyFiles[color])
        console.log('Loading candy:', color, 'from', candyFiles[color])
      } else {
        console.warn('No image file mapped for candy color:', color)
        // Use a fallback image if color not mapped
        this.load.image(color, candyFiles['red'])  // Use red as fallback
      }
    })
    
    // Load sound effects
    this.load.audio('drop', '/sounds/click.wav')
    this.load.audio('complete', '/sounds/Sweet.mp3')
    
    // Add error handling for image loading
    this.load.on('loaderror', (file: any) => {
      console.error('Failed to load:', file.key, file.src)
    })
    
    this.load.on('filecomplete', (key: string) => {
      console.log('Loaded:', key)
    })
  }

  create() {
    // Check if data was loaded properly
    if (!this.dataLoaded || !this.targetType || !this.targetCount) {
      // Show error state
      this.add.rectangle(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2,
        this.cameras.main.width,
        this.cameras.main.height,
        0x1a1a2e
      )
      
      this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2,
        'ERROR: Challenge data not loaded!\nPlease refresh the page.',
        { 
          fontSize: '24px', 
          color: '#ff0000', 
          fontFamily: 'Arial',
          align: 'center',
          stroke: '#000000',
          strokeThickness: 2
        }
      ).setOrigin(0.5)
      
      console.error('Cannot start game - missing challenge data')
      return // Stop initialization here
    }

    // Calculate tile size dynamically based on screen size
    const screenWidth = this.cameras.main.width
    const screenHeight = this.cameras.main.height
    const maxBoardWidth = screenWidth - 40 // Leave 20px padding on each side
    const maxBoardHeight = screenHeight - 200 // Leave space for UI elements
    
    // Calculate the tile size that fits both width and height
    const tileSizeByWidth = Math.floor(maxBoardWidth / this.gridWidth)
    const tileSizeByHeight = Math.floor(maxBoardHeight / this.gridHeight)
    
    // Use the smaller size to ensure the board fits
    this.tileSize = Math.min(tileSizeByWidth, tileSizeByHeight, 64) // Cap at 64 for desktop
    
    // For very small screens, ensure minimum playable size
    this.tileSize = Math.max(this.tileSize, 32)
    
    // Center the game board
    const boardWidth = this.gridWidth * this.tileSize
    const boardHeight = this.gridHeight * this.tileSize
    const boardX = (screenWidth - boardWidth) / 2
    const boardY = Math.min(120, (screenHeight - boardHeight) / 2)

    // Create background
    this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0x1a1a2e
    )

    // Create game board background
    this.add.rectangle(
      boardX + (this.gridWidth * this.tileSize) / 2,
      boardY + (this.gridHeight * this.tileSize) / 2,
      this.gridWidth * this.tileSize + 10,
      this.gridHeight * this.tileSize + 10,
      0x16213e
    )

    // Initialize grid
    for (let row = 0; row < this.gridHeight; row++) {
      this.grid[row] = []
      for (let col = 0; col < this.gridWidth; col++) {
        this.grid[row][col] = null
      }
    }

    // Fill grid with initial candies
    this.fillGrid(boardX, boardY)

    // Remove initial matches
    while (this.findAllMatches().length > 0) {
      this.removeMatches()
      this.fillGrid(boardX, boardY)
    }

    // Create UI
    this.createUI()

    // Enable input
    this.enableInput(boardX, boardY)
  }

  private createUI() {
    const style = { fontSize: '24px', color: '#ffffff', fontFamily: 'Arial' }
    
    // Timer
    this.timerText = this.add.text(20, 20, 'Time: 0:00', style)
    
    // Score
    this.scoreText = this.add.text(20, 50, 'Moves: 0', style)
    
    // Progress - only show if we have valid data
    if (this.targetType && this.targetCount) {
      const targetColor = this.targetType === 'yellow' ? '#ffff00' : 
                         this.targetType === 'blue' ? '#0099ff' :
                         this.targetType === 'red' ? '#ff3333' :
                         this.targetType === 'green' ? '#00ff00' :
                         this.targetType === 'purple' ? '#cc00ff' : '#ffffff'
      
      this.progressText = this.add.text(
        20,
        80,
        `${this.targetType.charAt(0).toUpperCase() + this.targetType.slice(1)}: 0/${this.targetCount}`,
        { ...style, color: targetColor }
      )
      
      // Only enable moves if we have valid data
      this.canMove = true
      console.log('Game ready - moves enabled for:', this.targetType, this.targetCount)
    } else {
      // Show loading or error state
      this.progressText = this.add.text(
        20,
        80,
        'ERROR: Challenge data missing!',
        { ...style, color: '#ff0000' }
      )
      this.canMove = false
      console.error('Cannot enable moves - missing challenge data')
    }
  }

  private fillGrid(boardX: number, boardY: number) {
    // Only used for initial grid setup
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        if (!this.grid[row][col]) {
          const candyType = this.rng ? this.rng.pick(this.candyTypes) : Phaser.Math.RND.pick(this.candyTypes)
          const candy = this.createCandy(row, col, candyType, boardX, boardY, false) // false = not from above
          this.grid[row][col] = candy
        }
      }
    }
  }

  private createCandy(row: number, col: number, type: string, boardX: number, boardY: number, spawnFromAbove: boolean = false): Candy {
    const x = boardX + col * this.tileSize + this.tileSize / 2
    // If spawning from above, start the candy above the board
    const y = spawnFromAbove 
      ? boardY - this.tileSize * 2 // Start 2 tiles above the board
      : boardY + row * this.tileSize + this.tileSize / 2
    
    const candy = this.add.sprite(x, y, type) as Candy
    candy.row = row
    candy.col = col
    candy.candyType = type
    candy.setInteractive()
    // Scale candy to fit the dynamic tile size (leaving small padding)
    const candySize = this.tileSize - 8
    candy.setDisplaySize(candySize, candySize)
    
    return candy
  }

  private createCandyAtPosition(row: number, col: number, type: string, boardX: number, yPosition: number): Candy {
    const x = boardX + col * this.tileSize + this.tileSize / 2
    
    const candy = this.add.sprite(x, yPosition, type) as Candy
    candy.row = row
    candy.col = col
    candy.candyType = type
    candy.setInteractive()
    // Scale candy to fit the dynamic tile size (leaving small padding)
    const candySize = this.tileSize - 8
    candy.setDisplaySize(candySize, candySize)
    
    return candy
  }

  private enableInput(boardX: number, boardY: number) {
    let swipeStartCandy: Candy | null = null
    let swipeStartX = 0
    let swipeStartY = 0
    const swipeThreshold = 30 // Minimum distance for a swipe
    
    // Store board position for use in event handlers
    const boardOffsetX = boardX
    const boardOffsetY = boardY
    
    // Handle both tap and swipe
    this.input.on('gameobjectdown', (pointer: Phaser.Input.Pointer, gameObject: Candy) => {
      if (!this.canMove) return
      
      // Store the candy and position where the touch/click started
      swipeStartCandy = gameObject
      swipeStartX = pointer.x
      swipeStartY = pointer.y
      
      // Visual feedback - subtle scale increase
      const originalSize = this.tileSize - 8
      const selectedSize = originalSize * 1.1
      gameObject.setDisplaySize(selectedSize, selectedSize)
    })
    
    // Handle swipe/drag end
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.canMove || !swipeStartCandy) return
      
      const swipeEndX = pointer.x
      const swipeEndY = pointer.y
      const deltaX = swipeEndX - swipeStartX
      const deltaY = swipeEndY - swipeStartY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      
      // Check if it was a swipe (moved enough distance)
      if (distance > swipeThreshold) {
        // Determine swipe direction
        let targetRow = swipeStartCandy.row
        let targetCol = swipeStartCandy.col
        
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal swipe
          targetCol += deltaX > 0 ? 1 : -1
        } else {
          // Vertical swipe
          targetRow += deltaY > 0 ? 1 : -1
        }
        
        // Check if target is valid
        if (targetRow >= 0 && targetRow < this.gridHeight && 
            targetCol >= 0 && targetCol < this.gridWidth) {
          const targetCandy = this.grid[targetRow][targetCol]
          if (targetCandy) {
            this.swapCandies(swipeStartCandy, targetCandy, boardOffsetX, boardOffsetY)
          }
        }
        
        // Reset visual
        const candySize = this.tileSize - 8
        swipeStartCandy.setDisplaySize(candySize, candySize)
      } else {
        // It was a tap - handle old click logic for desktop
        if (!this.selectedCandy || this.selectedCandy === swipeStartCandy) {
          this.selectedCandy = swipeStartCandy
          // Keep it selected (larger size)
        } else {
          // Check if adjacent to selected candy
          const rowDiff = Math.abs(this.selectedCandy.row - swipeStartCandy.row)
          const colDiff = Math.abs(this.selectedCandy.col - swipeStartCandy.col)
          
          if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
            this.swapCandies(this.selectedCandy, swipeStartCandy, boardOffsetX, boardOffsetY)
          }
          
          // Reset both candies
          const candySize = this.tileSize - 8
          this.selectedCandy.setDisplaySize(candySize, candySize)
          swipeStartCandy.setDisplaySize(candySize, candySize)
          this.selectedCandy = null
        }
      }
      
      // Reset swipe tracking
      swipeStartCandy = null
    })
    
    // Handle pointer leave (when finger leaves the screen without up event)
    this.input.on('pointerout', () => {
      if (swipeStartCandy) {
        const candySize = this.tileSize - 8
        swipeStartCandy.setDisplaySize(candySize, candySize)
        swipeStartCandy = null
      }
    })
  }

  private async swapCandies(candy1: Candy, candy2: Candy, boardX: number, boardY: number) {
    this.canMove = false
    this.moveCount++
    
    // Swap positions in grid
    this.grid[candy1.row][candy1.col] = candy2
    this.grid[candy2.row][candy2.col] = candy1
    
    // Swap row/col properties
    const tempRow = candy1.row
    const tempCol = candy1.col
    candy1.row = candy2.row
    candy1.col = candy2.col
    candy2.row = tempRow
    candy2.col = tempCol
    
    // Animate swap with smooth easing
    const duration = 180
    
    this.tweens.add({
      targets: candy1,
      x: boardX + candy1.col * this.tileSize + this.tileSize / 2,
      y: boardY + candy1.row * this.tileSize + this.tileSize / 2,
      duration,
      ease: 'Cubic.easeInOut'
    })
    
    this.tweens.add({
      targets: candy2,
      x: boardX + candy2.col * this.tileSize + this.tileSize / 2,
      y: boardY + candy2.row * this.tileSize + this.tileSize / 2,
      duration,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        const matches = this.findAllMatches()
        if (matches.length > 0) {
          this.handleMatches(matches, boardX, boardY)
        } else {
          // Swap back if no matches
          this.swapBack(candy1, candy2, boardX, boardY)
        }
      }
    })
  }

  private swapBack(candy1: Candy, candy2: Candy, boardX: number, boardY: number) {
    // Swap positions in grid back
    this.grid[candy1.row][candy1.col] = candy2
    this.grid[candy2.row][candy2.col] = candy1
    
    // Swap row/col properties back
    const tempRow = candy1.row
    const tempCol = candy1.col
    candy1.row = candy2.row
    candy1.col = candy2.col
    candy2.row = tempRow
    candy2.col = tempCol
    
    // Animate swap back with a "shake" effect to show invalid move
    const duration = 150
    
    // Add a shake effect before swapping back
    this.tweens.add({
      targets: [candy1, candy2],
      x: '+=5',
      duration: 50,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Then swap back with smooth animation
        this.tweens.add({
          targets: candy1,
          x: boardX + candy1.col * this.tileSize + this.tileSize / 2,
          y: boardY + candy1.row * this.tileSize + this.tileSize / 2,
          duration,
          ease: 'Back.easeOut'
        })
        
        this.tweens.add({
          targets: candy2,
          x: boardX + candy2.col * this.tileSize + this.tileSize / 2,
          y: boardY + candy2.row * this.tileSize + this.tileSize / 2,
          duration,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.canMove = true
          }
        })
      }
    })
  }

  private findAllMatches(): Candy[] {
    const matches: Candy[] = []
    const processed = new Set<Candy>()
    
    // Check horizontal matches
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth - 2; col++) {
        const candy1 = this.grid[row][col]
        const candy2 = this.grid[row][col + 1]
        const candy3 = this.grid[row][col + 2]
        
        if (candy1 && candy2 && candy3 && 
            candy1.candyType === candy2.candyType && 
            candy2.candyType === candy3.candyType) {
          
          if (!processed.has(candy1)) {
            matches.push(candy1)
            processed.add(candy1)
          }
          if (!processed.has(candy2)) {
            matches.push(candy2)
            processed.add(candy2)
          }
          if (!processed.has(candy3)) {
            matches.push(candy3)
            processed.add(candy3)
          }
        }
      }
    }
    
    // Check vertical matches
    for (let row = 0; row < this.gridHeight - 2; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        const candy1 = this.grid[row][col]
        const candy2 = this.grid[row + 1][col]
        const candy3 = this.grid[row + 2][col]
        
        if (candy1 && candy2 && candy3 && 
            candy1.candyType === candy2.candyType && 
            candy2.candyType === candy3.candyType) {
          
          if (!processed.has(candy1)) {
            matches.push(candy1)
            processed.add(candy1)
          }
          if (!processed.has(candy2)) {
            matches.push(candy2)
            processed.add(candy2)
          }
          if (!processed.has(candy3)) {
            matches.push(candy3)
            processed.add(candy3)
          }
        }
      }
    }
    
    return matches
  }

  private handleMatches(matches: Candy[], boardX: number, boardY: number) {
    // Count collected candies
    matches.forEach(candy => {
      this.collected[candy.candyType] = (this.collected[candy.candyType] || 0) + 1
      this.score += 10
    })
    
    // Remove matched candies
    matches.forEach(candy => {
      this.grid[candy.row][candy.col] = null
      candy.destroy()
    })
    
    // Drop candies down and fill empty spaces
    this.dropCandies(boardX, boardY)
    
    // Wait for animations to complete before checking for new matches
    setTimeout(() => {
      // Check for new matches
      const newMatches = this.findAllMatches()
      if (newMatches.length > 0) {
        this.handleMatches(newMatches, boardX, boardY)
      } else {
        this.canMove = true
        this.checkWinCondition()
      }
    }, 500) // Increased delay to ensure animations complete
  }

  private dropCandies(boardX: number, boardY: number) {
    // First, drop existing candies down to fill empty spaces
    let droppedCandies: Array<{candy: any, targetY: number, distance: number}> = []
    
    for (let col = 0; col < this.gridWidth; col++) {
      let emptyRow = this.gridHeight - 1
      
      for (let row = this.gridHeight - 1; row >= 0; row--) {
        if (this.grid[row][col]) {
          if (row !== emptyRow) {
            const candy = this.grid[row][col]!
            this.grid[emptyRow][col] = candy
            this.grid[row][col] = null
            
            const targetY = boardY + emptyRow * this.tileSize + this.tileSize / 2
            const currentY = candy.y
            const distance = targetY - currentY
            
            candy.row = emptyRow
            
            droppedCandies.push({
              candy,
              targetY,
              distance
            })
          }
          emptyRow--
        }
      }
      
      // Now fill the remaining empty spaces in this column with new candies
      for (let row = emptyRow; row >= 0; row--) {
        const candyType = this.rng ? this.rng.pick(this.candyTypes) : Phaser.Math.RND.pick(this.candyTypes)
        // Create candy starting from above the board
        const startY = boardY - (this.tileSize * (emptyRow - row + 2)) // Start higher for top candies
        const candy = this.createCandyAtPosition(row, col, candyType, boardX, startY)
        this.grid[row][col] = candy
        
        const targetY = boardY + row * this.tileSize + this.tileSize / 2
        
        droppedCandies.push({
          candy,
          targetY,
          distance: targetY - startY
        })
      }
    }
    
    // Animate all dropped candies with bounce effect
    droppedCandies.forEach(({candy, targetY, distance}, index) => {
      // Calculate drop duration based on distance (more distance = longer duration)
      const baseDuration = 100
      const durationPerTile = 50
      const tiles = Math.abs(distance / this.tileSize)
      const dropDuration = baseDuration + (tiles * durationPerTile)
      
      // Add slight delay for cascade effect (candies at top drop slightly later)
      const cascadeDelay = index * 10
      
      // Create the drop animation with bounce
      this.tweens.add({
        targets: candy,
        y: targetY,
        duration: dropDuration,
        delay: cascadeDelay,
        ease: 'Bounce.easeOut', // This creates the bounce effect at the end
        onComplete: () => {
          // Play drop sound when candy lands
          this.sound.play('drop', { 
            volume: 0.3,  // Lower volume since multiple candies might drop
            detune: Phaser.Math.Between(-200, 200) // Slight pitch variation for variety
          })
        }
      })
    })
  }

  private removeMatches() {
    const matches = this.findAllMatches()
    matches.forEach(candy => {
      this.grid[candy.row][candy.col] = null
      candy.destroy()
    })
  }

  private async checkWinCondition() {
    // Safety check - don't check win condition without valid data
    if (!this.targetType || !this.targetCount) {
      console.error('Cannot check win condition - missing challenge data')
      return
    }
    
    const targetCollected = this.collected[this.targetType] || 0
    
    if (targetCollected >= this.targetCount && this.canMove) {
      // Disable further moves
      this.canMove = false
      
      const timeMs = Date.now() - this.startTime
      
      // Play completion sound
      this.sound.play('complete', { 
        volume: 0.5,
        delay: 0.2 // Small delay for dramatic effect
      })
      
      // Show success message immediately
      this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2,
        'LEVEL COMPLETE!',
        { fontSize: '48px', color: '#00ff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 4 }
      ).setOrigin(0.5).setDepth(1000)
      
      // Complete attempt - skip API call for test play
      if (this.isTestPlay) {
        console.log('Test play completed:', {
          timeMs,
          collected: this.collected,
          moves: this.moveCount
        })
        
        // Show test play results
        this.add.text(
          this.cameras.main.width / 2,
          this.cameras.main.height / 2 + 60,
          `Time: ${(timeMs / 1000).toFixed(1)}s | Moves: ${this.moveCount}`,
          { fontSize: '24px', color: '#ffffff', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(1000)
        
        setTimeout(() => {
          if (this.onComplete) {
            this.onComplete()
          }
        }, 3000)
      } else {
        // Regular game - submit to API
        try {
          const result = await api.attempt.complete(this.attemptId, {
            timeMs,
            collected: this.collected,
            moves: this.moveCount,
            attemptToken: this.attemptToken
          })
          
          console.log('Attempt completed successfully:', result)
          
          setTimeout(() => {
            if (this.onComplete) {
              this.onComplete()
            } else {
              window.location.href = '/leaderboard'
            }
          }, 2000)
        } catch (error) {
          console.error('Failed to complete attempt:', error)
          // Still navigate to leaderboard even if completion fails
          setTimeout(() => {
            if (this.onComplete) {
              this.onComplete()
            } else {
              window.location.href = '/leaderboard'
            }
          }, 2000)
        }
      }
    }
  }

  update() {
    // Don't update if data isn't loaded
    if (!this.dataLoaded || !this.targetType || !this.targetCount) {
      return
    }
    
    // Update timer
    const elapsed = Date.now() - this.startTime
    const minutes = Math.floor(elapsed / 60000)
    const seconds = Math.floor((elapsed % 60000) / 1000)
    this.timerText.setText(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}`)
    
    // Update score
    this.scoreText.setText(`Moves: ${this.moveCount}`)
    
    // Update progress - safe with null check
    if (this.targetType && this.targetCount) {
      const targetCollected = this.collected[this.targetType] || 0
      this.progressText.setText(
        `${this.targetType.charAt(0).toUpperCase() + this.targetType.slice(1)}: ${targetCollected}/${this.targetCount}`
      )
    }
  }
}