import { z } from 'zod'

// Distribution rule types
export const DistributionRuleSchema = z.object({
  // Position-based rules
  position: z.number().int().positive().optional(),
  
  // Range-based rules
  range: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
  
  // Percentage-based rules (top X% of players)
  top_percent: z.number().min(0).max(100).optional(),
  
  // Amount configuration
  amount: z.number().positive(),
  type: z.enum(['percentage', 'fixed']),
  
  // Split behavior for ranges
  split: z.boolean().optional(), // If true, amount is split among range; if false, each gets full amount
  
  // Bonus configuration for hybrid distributions
  bonus: z.number().optional(),
  bonus_type: z.enum(['percentage', 'fixed']).optional(),
}).refine(data => {
  // Must have exactly one of: position, range, or top_percent
  const hasPosition = data.position !== undefined
  const hasRange = data.range !== undefined
  const hasTopPercent = data.top_percent !== undefined
  return (hasPosition ? 1 : 0) + (hasRange ? 1 : 0) + (hasTopPercent ? 1 : 0) === 1
}, { message: "Must specify exactly one of: position, range, or top_percent" })

// Rake tier for progressive rake
export const RakeTierSchema = z.object({
  min: z.number().min(0),
  max: z.number().positive().nullable(),
  rate: z.number().min(0).max(100),
})

// Complete distribution configuration
export const DistributionConfigSchema = z.object({
  // Distribution type
  type: z.enum(['percentage', 'fixed', 'hybrid']),
  
  // Distribution rules
  rules: z.array(DistributionRuleSchema).min(1),
  
  // Rake configuration
  rake: z.number().min(0).max(100).default(5),
  rake_type: z.enum(['percentage', 'fixed', 'progressive']).default('percentage'),
  rake_tiers: z.array(RakeTierSchema).optional(),
  
  // Safety thresholds
  minimum_pot: z.number().min(0).optional(),
  minimum_players: z.number().int().positive().optional(),
  maximum_payout: z.number().positive().optional(), // Max payout per player
  
  // Sponsor fund for guaranteed prizes
  sponsor_fund: z.number().min(0).optional(),
  
  // Fallback behavior
  refund_on_insufficient: z.boolean().default(true), // Refund if can't meet distribution requirements
}).refine(data => {
  // Validate percentage distributions don't exceed 100%
  if (data.type === 'percentage') {
    const totalPercentage = data.rules.reduce((sum, rule) => {
      if (rule.type === 'percentage' && !rule.split) {
        return sum + rule.amount
      }
      return sum
    }, 0)
    
    // For split rules, we can't calculate easily without knowing player count
    // So we'll validate this at runtime
    return totalPercentage <= 100
  }
  return true
}, { message: "Total percentage distribution cannot exceed 100%" })

// Predefined distribution templates
export const DistributionTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  config: DistributionConfigSchema,
  is_default: z.boolean().default(false),
  created_by: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
})

// Types
export type DistributionRule = z.infer<typeof DistributionRuleSchema>
export type RakeTier = z.infer<typeof RakeTierSchema>
export type DistributionConfig = z.infer<typeof DistributionConfigSchema>
export type DistributionTemplate = z.infer<typeof DistributionTemplateSchema>

// Default templates
export const DEFAULT_TEMPLATES: Omit<DistributionTemplate, 'id' | 'created_by' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Standard Distribution',
    description: 'Top 3 players win: 40%, 25%, 15%',
    config: {
      type: 'percentage',
      rules: [
        { position: 1, amount: 40, type: 'percentage' },
        { position: 2, amount: 25, type: 'percentage' },
        { position: 3, amount: 15, type: 'percentage' },
      ],
      rake: 5,
      rake_type: 'percentage',
      minimum_players: 3,
      refund_on_insufficient: true,
    },
    is_default: true,
  },
  {
    name: 'Winner Takes All',
    description: 'First place wins 95% of the pot',
    config: {
      type: 'percentage',
      rules: [
        { position: 1, amount: 95, type: 'percentage' },
      ],
      rake: 5,
      rake_type: 'percentage',
      minimum_players: 2,
      refund_on_insufficient: true,
    },
    is_default: false,
  },
  {
    name: 'Top Heavy',
    description: 'Rewards excellence: 50%, 30%, 10%',
    config: {
      type: 'percentage',
      rules: [
        { position: 1, amount: 50, type: 'percentage' },
        { position: 2, amount: 30, type: 'percentage' },
        { position: 3, amount: 10, type: 'percentage' },
      ],
      rake: 10,
      rake_type: 'percentage',
      minimum_players: 5,
      refund_on_insufficient: true,
    },
    is_default: false,
  },
  {
    name: 'Participation Rewards',
    description: 'Top 3 win big, everyone else shares remaining pot',
    config: {
      type: 'percentage',
      rules: [
        { position: 1, amount: 30, type: 'percentage' },
        { position: 2, amount: 20, type: 'percentage' },
        { position: 3, amount: 15, type: 'percentage' },
        { range: [4, 999], amount: 30, type: 'percentage', split: true },
      ],
      rake: 5,
      rake_type: 'percentage',
      minimum_players: 10,
      refund_on_insufficient: true,
    },
    is_default: false,
  },
]

module.exports = {
  DistributionConfigSchema,
  DistributionRuleSchema,
  DistributionTemplateSchema,
  DEFAULT_TEMPLATES
}