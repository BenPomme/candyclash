import { DistributionConfig, DistributionRule } from '../types/distribution'

export interface LeaderboardEntry {
  attemptId: string
  userId: string
  displayName: string
  timeMs: number
  completedAt: number
}

export interface Payout {
  userId: string
  displayName: string
  position: number
  amount: number
  percentage?: number
}

export class PayoutCalculator {
  /**
   * Calculate payouts based on distribution configuration
   */
  static calculatePayouts(
    leaderboard: LeaderboardEntry[],
    config: DistributionConfig,
    grossPot: number,
    entryFee: number
  ): {
    payouts: Payout[]
    rake: number
    netPot: number
    refund: boolean
  } {
    // Check minimum requirements
    if (config.minimum_players && leaderboard.length < config.minimum_players) {
      if (config.refund_on_insufficient) {
        // Refund all players
        return {
          payouts: leaderboard.map((entry, index) => ({
            userId: entry.userId,
            displayName: entry.displayName,
            position: index + 1,
            amount: entryFee,
          })),
          rake: 0,
          netPot: grossPot,
          refund: true,
        }
      }
    }

    // Calculate rake
    const rake = this.calculateRake(grossPot, config)
    const netPot = grossPot - rake

    // Check minimum pot
    if (config.minimum_pot && netPot < config.minimum_pot) {
      if (config.refund_on_insufficient) {
        return {
          payouts: leaderboard.map((entry, index) => ({
            userId: entry.userId,
            displayName: entry.displayName,
            position: index + 1,
            amount: entryFee,
          })),
          rake: 0,
          netPot: grossPot,
          refund: true,
        }
      }
    }

    // Calculate payouts based on rules
    const payouts: Payout[] = []
    const processedPositions = new Set<number>()

    for (const rule of config.rules) {
      const rulePayout = this.applyRule(
        rule,
        leaderboard,
        netPot,
        config.sponsor_fund || 0,
        processedPositions
      )
      payouts.push(...rulePayout)
    }

    // Apply maximum payout cap if configured
    if (config.maximum_payout) {
      payouts.forEach(payout => {
        if (payout.amount > config.maximum_payout!) {
          payout.amount = config.maximum_payout!
        }
      })
    }

    // Sort payouts by position
    payouts.sort((a, b) => a.position - b.position)

    return {
      payouts,
      rake,
      netPot,
      refund: false,
    }
  }

  /**
   * Calculate rake amount based on configuration
   */
  private static calculateRake(pot: number, config: DistributionConfig): number {
    switch (config.rake_type) {
      case 'fixed':
        return config.rake

      case 'percentage':
        return (pot * config.rake) / 100

      case 'progressive':
        if (!config.rake_tiers || config.rake_tiers.length === 0) {
          return (pot * config.rake) / 100
        }
        
        // Find applicable tier
        const tier = config.rake_tiers.find(
          t => pot >= t.min && (t.max === null || pot <= t.max)
        )
        
        if (tier) {
          return (pot * tier.rate) / 100
        }
        
        return (pot * config.rake) / 100

      default:
        return 0
    }
  }

  /**
   * Apply a single distribution rule
   */
  private static applyRule(
    rule: DistributionRule,
    leaderboard: LeaderboardEntry[],
    netPot: number,
    sponsorFund: number,
    processedPositions: Set<number>
  ): Payout[] {
    const payouts: Payout[] = []

    // Position-based rule
    if (rule.position !== undefined) {
      const position = rule.position
      if (position <= leaderboard.length && !processedPositions.has(position)) {
        const entry = leaderboard[position - 1]
        const amount = this.calculateAmount(rule, netPot, sponsorFund, 1)
        
        payouts.push({
          userId: entry.userId,
          displayName: entry.displayName,
          position,
          amount,
          percentage: rule.type === 'percentage' ? rule.amount : undefined,
        })
        
        processedPositions.add(position)
      }
    }

    // Range-based rule
    if (rule.range !== undefined) {
      const [start, end] = rule.range
      const eligibleEntries: { entry: LeaderboardEntry; position: number }[] = []
      
      for (let pos = start; pos <= Math.min(end, leaderboard.length); pos++) {
        if (!processedPositions.has(pos)) {
          eligibleEntries.push({
            entry: leaderboard[pos - 1],
            position: pos,
          })
          processedPositions.add(pos)
        }
      }
      
      if (eligibleEntries.length > 0) {
        const amountPerPlayer = this.calculateAmount(
          rule,
          netPot,
          sponsorFund,
          rule.split ? eligibleEntries.length : 1
        )
        
        eligibleEntries.forEach(({ entry, position }) => {
          payouts.push({
            userId: entry.userId,
            displayName: entry.displayName,
            position,
            amount: amountPerPlayer,
            percentage: rule.type === 'percentage' ? rule.amount / eligibleEntries.length : undefined,
          })
        })
      }
    }

    // Top percentage rule
    if (rule.top_percent !== undefined) {
      const topCount = Math.max(1, Math.floor((leaderboard.length * rule.top_percent) / 100))
      const eligibleEntries: { entry: LeaderboardEntry; position: number }[] = []
      
      for (let pos = 1; pos <= Math.min(topCount, leaderboard.length); pos++) {
        if (!processedPositions.has(pos)) {
          eligibleEntries.push({
            entry: leaderboard[pos - 1],
            position: pos,
          })
          processedPositions.add(pos)
        }
      }
      
      if (eligibleEntries.length > 0) {
        const amountPerPlayer = this.calculateAmount(
          rule,
          netPot,
          sponsorFund,
          eligibleEntries.length
        )
        
        eligibleEntries.forEach(({ entry, position }) => {
          payouts.push({
            userId: entry.userId,
            displayName: entry.displayName,
            position,
            amount: amountPerPlayer,
            percentage: rule.type === 'percentage' ? rule.amount / eligibleEntries.length : undefined,
          })
        })
      }
    }

    return payouts
  }

  /**
   * Calculate amount for a rule
   */
  private static calculateAmount(
    rule: DistributionRule,
    netPot: number,
    sponsorFund: number,
    splitCount: number
  ): number {
    let baseAmount: number
    
    if (rule.type === 'percentage') {
      baseAmount = (netPot * rule.amount) / 100
    } else {
      // Fixed amount - use sponsor fund if available
      baseAmount = Math.min(rule.amount, sponsorFund)
    }
    
    // Apply bonus if configured
    if (rule.bonus !== undefined && rule.bonus_type !== undefined) {
      if (rule.bonus_type === 'percentage') {
        baseAmount += (netPot * rule.bonus) / 100
      } else {
        baseAmount += rule.bonus
      }
    }
    
    // Split among eligible players if needed
    if (splitCount > 1) {
      return Math.floor(baseAmount / splitCount)
    }
    
    return Math.floor(baseAmount)
  }

  /**
   * Validate that a distribution configuration is valid
   */
  static validateConfig(config: DistributionConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    // Check total percentage doesn't exceed 100%
    if (config.type === 'percentage') {
      let totalPercentage = 0
      
      for (const rule of config.rules) {
        if (rule.type === 'percentage') {
          if (rule.position !== undefined || (rule.range && !rule.split)) {
            totalPercentage += rule.amount
          }
          // For split ranges, we can't validate without knowing player count
        }
      }
      
      if (totalPercentage > 100) {
        errors.push(`Total percentage exceeds 100% (${totalPercentage}%)`)
      }
    }
    
    // Check fixed amounts vs sponsor fund
    if (config.type === 'fixed') {
      let totalFixed = 0
      
      for (const rule of config.rules) {
        if (rule.type === 'fixed') {
          if (rule.position !== undefined) {
            totalFixed += rule.amount
          }
          if (rule.range !== undefined && !rule.split) {
            const [start, end] = rule.range
            totalFixed += rule.amount * (end - start + 1)
          }
        }
      }
      
      if (totalFixed > (config.sponsor_fund || 0)) {
        errors.push(`Total fixed payouts (${totalFixed}) exceed sponsor fund (${config.sponsor_fund || 0})`)
      }
    }
    
    // Check for position conflicts
    const positions = new Set<number>()
    const ranges: Array<[number, number]> = []
    
    for (const rule of config.rules) {
      if (rule.position !== undefined) {
        if (positions.has(rule.position)) {
          errors.push(`Duplicate position: ${rule.position}`)
        }
        positions.add(rule.position)
      }
      
      if (rule.range !== undefined) {
        ranges.push(rule.range as [number, number])
      }
    }
    
    // Check for overlapping ranges
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const [start1, end1] = ranges[i]
        const [start2, end2] = ranges[j]
        
        if ((start1 <= end2 && end1 >= start2)) {
          errors.push(`Overlapping ranges: [${start1}-${end1}] and [${start2}-${end2}]`)
        }
      }
    }
    
    // Check position vs range conflicts
    for (const pos of positions) {
      for (const [start, end] of ranges) {
        if (pos >= start && pos <= end) {
          errors.push(`Position ${pos} conflicts with range [${start}-${end}]`)
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

module.exports = { PayoutCalculator }