import Phaser from 'phaser'
import { api } from '../api/client'

interface Candy extends Phaser.GameObjects.Sprite {
  row: number
  col: number
  candyType: string
}

export class Match3Scene extends Phaser.Scene {
  private grid: (Candy | null)[][] = []
  private gridWidth = 8  // Default, will be overridden by init
  private gridHeight = 8  // Default, will be overridden by init
  private tileSize = 64
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

    // Center the game board
    const boardX = (this.cameras.main.width - this.gridWidth * this.tileSize) / 2
    const boardY = 100

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
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        if (!this.grid[row][col]) {
          const candyType = Phaser.Math.RND.pick(this.candyTypes)
          const candy = this.createCandy(row, col, candyType, boardX, boardY)
          this.grid[row][col] = candy
        }
      }
    }
  }

  private createCandy(row: number, col: number, type: string, boardX: number, boardY: number): Candy {
    const x = boardX + col * this.tileSize + this.tileSize / 2
    const y = boardY + row * this.tileSize + this.tileSize / 2
    
    const candy = this.add.sprite(x, y, type) as Candy
    candy.row = row
    candy.col = col
    candy.candyType = type
    candy.setInteractive()
    // Scale down the candy images to fit the tile size (64px)
    candy.setDisplaySize(56, 56)
    
    return candy
  }

  private enableInput(boardX: number, boardY: number) {
    let swipeStartCandy: Candy | null = null
    let swipeStartX = 0
    let swipeStartY = 0
    const swipeThreshold = 30 // Minimum distance for a swipe
    
    // Handle both tap and swipe
    this.input.on('gameobjectdown', (pointer: Phaser.Input.Pointer, gameObject: Candy) => {
      if (!this.canMove) return
      
      // Store the candy and position where the touch/click started
      swipeStartCandy = gameObject
      swipeStartX = pointer.x
      swipeStartY = pointer.y
      
      // Visual feedback - make candy glow/pulse
      gameObject.setDisplaySize(64, 64)
      this.tweens.add({
        targets: gameObject,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 100,
        yoyo: true,
        ease: 'Power1'
      })
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
            this.swapCandies(swipeStartCandy, targetCandy, boardX, boardY)
          }
        }
        
        // Reset visual
        swipeStartCandy.setDisplaySize(56, 56)
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
            this.swapCandies(this.selectedCandy, swipeStartCandy, boardX, boardY)
          }
          
          // Reset both candies
          this.selectedCandy.setDisplaySize(56, 56)
          swipeStartCandy.setDisplaySize(56, 56)
          this.selectedCandy = null
        }
      }
      
      // Reset swipe tracking
      swipeStartCandy = null
    })
    
    // Handle pointer leave (when finger leaves the screen without up event)
    this.input.on('pointerout', () => {
      if (swipeStartCandy) {
        swipeStartCandy.setDisplaySize(56, 56)
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
    
    // Animate swap
    const duration = 200
    this.tweens.add({
      targets: candy1,
      x: boardX + candy1.col * this.tileSize + this.tileSize / 2,
      y: boardY + candy1.row * this.tileSize + this.tileSize / 2,
      duration
    })
    
    this.tweens.add({
      targets: candy2,
      x: boardX + candy2.col * this.tileSize + this.tileSize / 2,
      y: boardY + candy2.row * this.tileSize + this.tileSize / 2,
      duration,
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
    
    // Animate swap back
    const duration = 200
    this.tweens.add({
      targets: candy1,
      x: boardX + candy1.col * this.tileSize + this.tileSize / 2,
      y: boardY + candy1.row * this.tileSize + this.tileSize / 2,
      duration
    })
    
    this.tweens.add({
      targets: candy2,
      x: boardX + candy2.col * this.tileSize + this.tileSize / 2,
      y: boardY + candy2.row * this.tileSize + this.tileSize / 2,
      duration,
      onComplete: () => {
        this.canMove = true
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
    
    // Drop candies down
    this.dropCandies(boardX, boardY)
    
    // Fill empty spaces
    setTimeout(() => {
      this.fillGrid(boardX, boardY)
      
      // Check for new matches
      const newMatches = this.findAllMatches()
      if (newMatches.length > 0) {
        this.handleMatches(newMatches, boardX, boardY)
      } else {
        this.canMove = true
        this.checkWinCondition()
      }
    }, 300)
  }

  private dropCandies(_boardX: number, boardY: number) {
    for (let col = 0; col < this.gridWidth; col++) {
      let emptyRow = this.gridHeight - 1
      
      for (let row = this.gridHeight - 1; row >= 0; row--) {
        if (this.grid[row][col]) {
          if (row !== emptyRow) {
            const candy = this.grid[row][col]!
            this.grid[emptyRow][col] = candy
            this.grid[row][col] = null
            candy.row = emptyRow
            
            this.tweens.add({
              targets: candy,
              y: boardY + emptyRow * this.tileSize + this.tileSize / 2,
              duration: 200
            })
          }
          emptyRow--
        }
      }
    }
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