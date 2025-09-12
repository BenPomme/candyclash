// Test deterministic board generation
class SeededRandom {
  constructor(seedString) {
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
  next() {
    // Parameters from Numerical Recipes
    const a = 1664525
    const c = 1013904223
    const m = Math.pow(2, 32)
    
    this.seed = (a * this.seed + c) % m
    return this.seed / m
  }

  // Pick a random element from an array
  pick(array) {
    const index = Math.floor(this.next() * array.length)
    return array[index]
  }
}

// Test with the same seed twice
const testSeed = "test-seed-123"
const candyTypes = ['red', 'blue', 'green', 'yellow', 'purple']

console.log('Testing deterministic board generation with seed:', testSeed)
console.log('---')

// Generate first board
const rng1 = new SeededRandom(testSeed)
const board1 = []
for (let row = 0; row < 3; row++) {
  const rowCandies = []
  for (let col = 0; col < 3; col++) {
    rowCandies.push(rng1.pick(candyTypes))
  }
  board1.push(rowCandies)
}

console.log('Board 1:')
board1.forEach(row => console.log(row.join(' ')))
console.log('---')

// Generate second board with same seed
const rng2 = new SeededRandom(testSeed)
const board2 = []
for (let row = 0; row < 3; row++) {
  const rowCandies = []
  for (let col = 0; col < 3; col++) {
    rowCandies.push(rng2.pick(candyTypes))
  }
  board2.push(rowCandies)
}

console.log('Board 2:')
board2.forEach(row => console.log(row.join(' ')))
console.log('---')

// Check if boards are identical
let identical = true
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) {
    if (board1[row][col] !== board2[row][col]) {
      identical = false
      break
    }
  }
}

console.log('Boards are identical:', identical)

// Test with different seed
const differentSeed = "different-seed-456"
const rng3 = new SeededRandom(differentSeed)
const board3 = []
for (let row = 0; row < 3; row++) {
  const rowCandies = []
  for (let col = 0; col < 3; col++) {
    rowCandies.push(rng3.pick(candyTypes))
  }
  board3.push(rowCandies)
}

console.log('\nBoard 3 (different seed:', differentSeed + '):')
board3.forEach(row => console.log(row.join(' ')))

// Check if board3 is different from board1
let different = false
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) {
    if (board1[row][col] !== board3[row][col]) {
      different = true
      break
    }
  }
}

console.log('Board 3 is different from Board 1:', different)