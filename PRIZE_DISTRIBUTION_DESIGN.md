# Flexible Prize Distribution System Design

## Overview
This document outlines the design for a flexible, parameterizable prize distribution system for Candy Clash challenges. The system allows administrators to configure custom prize distributions, rake percentages, and payout rules for different challenge types.

## Database Schema

### Challenge Table Enhancement
Add a `prize_distribution` JSON field to store distribution rules:

```json
{
  "type": "percentage" | "fixed" | "hybrid",
  "rules": [
    {
      "position": 1,
      "amount": 40,
      "type": "percentage"
    },
    {
      "position": 2,
      "amount": 25,
      "type": "percentage"
    },
    {
      "position": 3,
      "amount": 15,
      "type": "percentage"
    },
    {
      "range": [4, 10],
      "amount": 10,
      "type": "percentage",
      "split": true
    },
    {
      "range": [11, 50],
      "amount": 5,
      "type": "percentage",
      "split": true
    }
  ],
  "rake": 5,  // percentage taken by house
  "minimum_pot": 100,  // minimum pot required to distribute prizes
  "minimum_players": 3  // minimum players required to distribute prizes
}
```

### Prize Distribution Templates Table
New table for reusable distribution templates:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Template name (e.g., "Winner Takes All") |
| description | TEXT | Template description |
| rules | JSON | Distribution rules configuration |
| is_default | BOOLEAN | Whether this is a default template |
| created_by | UUID | Admin who created the template |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

## Distribution Types

### 1. Percentage Distribution
Winners receive a percentage of the total pot.
```json
{
  "type": "percentage",
  "rules": [
    {"position": 1, "amount": 40, "type": "percentage"}
  ]
}
```

### 2. Fixed Distribution
Winners receive fixed gold amounts (requires sponsor/guarantee).
```json
{
  "type": "fixed",
  "rules": [
    {"position": 1, "amount": 1000, "type": "fixed"}
  ],
  "sponsor_fund": 1000
}
```

### 3. Hybrid Distribution
Combination of fixed and percentage-based rewards.
```json
{
  "type": "hybrid",
  "rules": [
    {"position": 1, "amount": 500, "type": "fixed", "bonus": 20, "bonus_type": "percentage"}
  ]
}
```

## Rule Types

### Single Position
Reward for a specific position:
```json
{"position": 1, "amount": 40, "type": "percentage"}
```

### Range with Split
Total amount split among range:
```json
{"range": [4, 10], "amount": 10, "type": "percentage", "split": true}
```

### Range without Split
Each position gets the full amount:
```json
{"range": [4, 10], "amount": 100, "type": "fixed", "split": false}
```

### Top Percentage
Top X% of players share the reward:
```json
{"top_percent": 10, "amount": 20, "type": "percentage"}
```

## Rake Configuration Options

1. **Percentage Rake**: X% of entry fees
2. **Fixed Rake**: Flat fee per entry
3. **Progressive Rake**: Changes based on pot size
4. **No Rake**: For promotional challenges

### Progressive Rake Example
```json
{
  "rake_type": "progressive",
  "rake_tiers": [
    {"min": 0, "max": 1000, "rate": 0},
    {"min": 1001, "max": 5000, "rate": 3},
    {"min": 5001, "max": 10000, "rate": 5},
    {"min": 10001, "max": null, "rate": 7}
  ]
}
```

## Safety Rules and Constraints

### Validation Rules
- Total percentage distribution cannot exceed 100%
- Fixed distributions require sufficient sponsor funds
- Minimum players check before distribution
- Maximum individual payout caps

### Fallback Mechanisms
- If insufficient players: refund all entries
- If position unfilled: redistribute to next tier
- If tie at position: split reward equally
- If total < 100%: remainder goes to house

## Example Configurations

### Winner Takes All
```json
{
  "name": "Winner Takes All",
  "type": "percentage",
  "rules": [
    {"position": 1, "amount": 95, "type": "percentage"}
  ],
  "rake": 5,
  "minimum_players": 2
}
```

### Top Heavy Distribution
```json
{
  "name": "Top Heavy",
  "type": "percentage",
  "rules": [
    {"position": 1, "amount": 50, "type": "percentage"},
    {"position": 2, "amount": 30, "type": "percentage"},
    {"position": 3, "amount": 10, "type": "percentage"}
  ],
  "rake": 10,
  "minimum_players": 5
}
```

### Participation Rewards
```json
{
  "name": "Everyone Wins",
  "type": "percentage",
  "rules": [
    {"position": 1, "amount": 30, "type": "percentage"},
    {"position": 2, "amount": 20, "type": "percentage"},
    {"position": 3, "amount": 15, "type": "percentage"},
    {"range": [4, 999], "amount": 30, "type": "percentage", "split": true}
  ],
  "rake": 5,
  "minimum_players": 10
}
```

### Guaranteed Tournament
```json
{
  "name": "Guaranteed Prize Pool",
  "type": "fixed",
  "rules": [
    {"position": 1, "amount": 1000, "type": "fixed"},
    {"position": 2, "amount": 500, "type": "fixed"},
    {"position": 3, "amount": 250, "type": "fixed"},
    {"range": [4, 10], "amount": 100, "type": "fixed", "split": false}
  ],
  "rake": 0,
  "sponsor_fund": 2550,
  "minimum_players": 10
}
```

## Implementation Components

### Backend Functions

```typescript
interface DistributionRule {
  position?: number;
  range?: [number, number];
  top_percent?: number;
  amount: number;
  type: 'percentage' | 'fixed';
  split?: boolean;
  bonus?: number;
  bonus_type?: 'percentage' | 'fixed';
}

interface DistributionConfig {
  type: 'percentage' | 'fixed' | 'hybrid';
  rules: DistributionRule[];
  rake: number;
  rake_type?: 'percentage' | 'fixed' | 'progressive';
  rake_tiers?: RakeTier[];
  minimum_pot?: number;
  minimum_players?: number;
  sponsor_fund?: number;
}

function calculatePayouts(
  leaderboard: LeaderboardEntry[],
  config: DistributionConfig,
  pot: number
): Payout[] {
  // Implementation logic
}

function validateDistributionConfig(
  config: DistributionConfig
): ValidationResult {
  // Validation logic
}

function calculateEffectiveRake(
  pot: number,
  config: DistributionConfig
): number {
  // Rake calculation logic
}
```

### Admin Interface Components

1. **Distribution Builder**
   - Visual drag-and-drop interface for positions
   - Real-time validation and warnings
   - Preview payout calculations

2. **Template Manager**
   - Save custom distributions as templates
   - Load and modify existing templates
   - Clone and edit default templates

3. **Simulation Tool**
   - Test distributions with various player counts
   - Preview payout tables
   - Calculate expected house revenue

## Migration Strategy

1. **Phase 1**: Add new schema fields with defaults matching current system
2. **Phase 2**: Implement backend calculation functions
3. **Phase 3**: Deploy admin interface for configuration
4. **Phase 4**: Enable custom distributions for new challenges
5. **Phase 5**: Migrate existing challenges to new system

## Edge Cases and Handling

### Tie Breaking
- Players with identical scores at boundary positions
- Solution: Split the combined rewards equally

### Insufficient Pot
- Fixed payouts exceed available pot
- Solution: Pro-rate fixed amounts or use sponsor funds

### No Qualifiers
- No players meet minimum requirements
- Solution: Refund all entries or redistribute

### Single Player
- Only one player in challenge
- Solution: Return entry fee minus rake

## Security Considerations

1. **Validation**: Strict server-side validation of all distribution configs
2. **Atomicity**: Use database transactions for all payout operations
3. **Audit Trail**: Log all distribution calculations and payouts
4. **Rate Limiting**: Prevent rapid configuration changes
5. **Access Control**: Only authorized admins can modify distributions

## Future Enhancements

1. **Dynamic Distributions**: Rules that change based on player count
2. **Bonus Multipliers**: Special events with increased payouts
3. **Loyalty Rewards**: Extra percentages for frequent players
4. **Team Distributions**: Split rewards among team members
5. **NFT/Badge Rewards**: Non-monetary prizes for positions
6. **Seasonal Themes**: Time-based distribution templates

## Conclusion

This flexible prize distribution system provides administrators with complete control over challenge economics while maintaining fairness and transparency. The modular design allows for easy extension and customization as the game evolves.