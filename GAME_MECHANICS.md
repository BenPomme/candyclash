# Candy Clash Game Mechanics Documentation

## Core Match-3 Mechanics

### Basic Gameplay
- **Grid:** 8×8 board with candies of 5-6 different colors
- **Basic Move:** Swap two adjacent candies (horizontal or vertical only)
- **Valid Move:** Swap must create a match of 3 or more candies of the same color
- **Invalid Move:** If no match is created, candies swap back
- **Gravity:** After matches are cleared, candies fall down to fill empty spaces
- **Cascade:** New candies spawn from the top to fill the board
- **Chain Reactions:** Falling candies can create new matches automatically

### Basic Matches
1. **Match-3:** Line up 3 candies of the same color (horizontal or vertical)
   - Clears the 3 candies
   - Awards base points (60 points)

2. **Match-4:** Line up 4 candies of the same color
   - Creates a Striped Candy
   - Awards 120 points

3. **Match-5:** Line up 5 candies in a straight line
   - Creates a Color Bomb
   - Awards 200 points

4. **L-Shape Match:** Match 5 candies in L or T formation
   - Creates a Wrapped Candy
   - Awards 200 points

## Special Candies

### 1. Striped Candy
**Creation:** Match 4 candies in a line
**Types:**
- Horizontal stripes: Clears entire row when activated
- Vertical stripes: Clears entire column when activated
**Activation:** Match with 2+ candies of the same color or swap with another special candy
**Points:** 540 points for line clear (9 candies × 60)

### 2. Wrapped Candy
**Creation:** Match 5 candies in L or T shape
**Effect:** Explodes twice in a 3×3 area
**Activation:** Match with 2+ candies of the same color
**Points:** 1080 points (18 candies × 60)

### 3. Color Bomb
**Creation:** Match 5 candies in a straight line
**Effect:** Removes all candies of the swapped candy's color
**Activation:** Swap with any regular candy
**Points:** Varies based on number of candies cleared

### 4. Fish Candy (Optional for prototype)
**Creation:** Match 4 candies in a 2×2 square
**Effect:** Swims to random targets (usually objectives or blockers)
**Activation:** Match with 2+ candies of the same color

## Special Combinations

### Tier 1 Combinations (Two Special Candies)

1. **Striped + Striped**
   - Creates a cross explosion (one horizontal, one vertical line)
   - Clears full row and column from swap point
   - ~1080 points

2. **Striped + Wrapped**
   - Creates a giant candy that clears 3 rows and 3 columns
   - Most powerful area-clearing combo
   - ~1620 points

3. **Wrapped + Wrapped**
   - Creates an enhanced explosion with 5×5 area (twice)
   - ~2400 points

4. **Striped + Color Bomb**
   - Transforms all candies of the striped candy's color into striped candies
   - All created stripes activate immediately
   - Massive board clear potential

5. **Wrapped + Color Bomb**
   - Transforms all candies of the wrapped candy's color into wrapped candies
   - All created wrapped candies explode
   - Excellent for clearing blockers

6. **Color Bomb + Color Bomb**
   - Clears the entire board
   - All candies removed, all blockers lose one layer
   - Maximum points possible

## Scoring System

### Base Points
- Regular candy clear: 60 points
- Special candy creation bonus: +60 points
- Cascade bonus: ×1.5 for each subsequent cascade

### Multipliers
- Time bonus: Faster completion = higher multiplier
- Combo multiplier: Consecutive special candy activations
- Perfect clear bonus: No moves wasted

### Score Calculation
```
Total Score = (Base Points × Cascade Multiplier × Combo Multiplier) + Time Bonus
```

## Level Objectives

### Primary Objectives
1. **Collect X Candies:** Collect specific number of candies of certain color(s)
2. **Score Target:** Reach minimum score threshold
3. **Clear Jellies:** Clear all jelly-covered tiles (if implemented)
4. **Bring Down Ingredients:** Move special pieces to bottom (if implemented)
5. **Time Challenge:** Complete objective within time limit

### Challenge Modifiers
- **Limited Moves:** Complete objective within move limit
- **Time Pressure:** Complete as fast as possible (for competitive mode)
- **Cascade Master:** Achieve X cascades in single level
- **Special Candy Goals:** Create X special candies

## Level Editor Requirements

### Core Features
1. **Grid Configuration**
   - Set board dimensions (6×6 to 10×10)
   - Define playable tiles vs blocked spaces
   - Set candy colors available (3-6 colors)

2. **Objective Settings**
   - Primary objective type and target
   - Secondary objectives (optional)
   - Move/time limits
   - Target score thresholds

3. **Candy Distribution**
   - Starting board layout
   - Spawn weights for each candy color
   - Special candy spawn rules
   - Locked candies or special tiles

4. **Blocker Placement**
   - Chocolate blocks (spreads if not cleared)
   - Licorice locks (blocks candy movement)
   - Meringue blocks (multi-hit blocks)
   - Jelly tiles (objective tiles)

5. **Difficulty Tuning**
   - Entry fee (Gold Bars)
   - Prize pool distribution
   - Attempts per day limit
   - Booster availability

### Level Data Structure
```json
{
  "id": "level_001",
  "name": "Yellow Rush",
  "grid": {
    "width": 8,
    "height": 8,
    "blockedTiles": [[0,0], [7,7]],
    "specialTiles": {
      "jelly": [[3,3], [3,4], [4,3], [4,4]]
    }
  },
  "objectives": {
    "primary": {
      "type": "collect",
      "target": "yellow",
      "count": 100
    },
    "timeLimit": null,
    "moveLimit": null
  },
  "candies": {
    "colors": ["red", "yellow", "green", "blue", "purple"],
    "spawnWeights": {
      "red": 20,
      "yellow": 20,
      "green": 20,
      "blue": 20,
      "purple": 20
    }
  },
  "difficulty": {
    "entryFee": 20,
    "attemptsPerDay": 2,
    "prizeDistribution": {
      "1st": 40,
      "2nd": 25,
      "3rd": 15
    }
  }
}
```

## Competition Balance

### Skill vs Luck
- **Skill Elements:**
  - Planning moves ahead
  - Recognizing special candy opportunities
  - Optimizing special combinations
  - Time management
  
- **Luck Mitigation:**
  - Guaranteed special candy spawns after X moves without specials
  - Shuffle board if no valid moves
  - Consistent candy spawn rates
  - Multiple attempts to reduce RNG impact

### Anti-Cheat Measures
1. **Server Validation:**
   - Move sequence recording
   - Time stamps for each move
   - Physics validation (gravity, cascades)
   - Maximum theoretical score limits

2. **Client Restrictions:**
   - Obfuscated game logic
   - Server-authoritative timer
   - Encrypted move submissions
   - Rate limiting on API calls

## Performance Optimizations

### Rendering
- Object pooling for candy sprites
- Batch rendering for animations
- Texture atlases for all candy graphics
- Reduced particle effects on mobile

### Game Logic
- Efficient match detection algorithms
- Optimized cascade calculations
- Predictive loading for next moves
- Background preloading of assets

## Mobile Optimizations
- Touch-friendly candy size (minimum 48px)
- Swipe gestures for moves
- Haptic feedback for matches
- Responsive UI scaling
- Reduced animation complexity
- Battery-conscious rendering