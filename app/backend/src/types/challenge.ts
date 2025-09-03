import { z } from 'zod'
import { DistributionConfigSchema } from './distribution'

// Legacy prize distribution schema (for backward compatibility)
export const LegacyPrizeDistributionSchema = z.record(z.string(), z.number().min(0).max(100))
  .refine(data => {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0)
    return total <= 100
  }, { message: "Prize distribution cannot exceed 100%" })

export const AttemptsConfigSchema = z.object({
  type: z.enum(['per_day', 'total_per_user', 'unlimited']),
  limit: z.number().min(1).max(100),
})

const BaseChallengeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  level_id: z.string(),
  entry_fee: z.number().min(0).max(1000),
  starts_at: z.string().datetime().optional(),
  duration_hours: z.number().min(1).max(168).optional(), // Max 1 week
  ends_at: z.string().datetime().optional(),
  attempts_config: AttemptsConfigSchema.optional(), // Made optional for backward compatibility
  
  // Prize distribution - support both legacy and new format
  prize_distribution: z.union([
    LegacyPrizeDistributionSchema,
    DistributionConfigSchema
  ]).optional(),
  
  // Legacy rake field (basis points)
  rake_bps: z.number().min(0).max(5000).optional(), // Max 50% rake
  
  min_players: z.number().min(2).optional(),
  max_players: z.number().min(2).max(10000).optional(),
  featured: z.boolean().default(false),
  category: z.enum(['daily', 'weekly', 'special', 'tournament']).optional(),
})

export const CreateChallengeSchema = BaseChallengeSchema.refine(data => {
  // Must have either ends_at or duration_hours
  return data.ends_at || data.duration_hours
}, { message: "Must provide either ends_at or duration_hours" })

export const UpdateChallengeSchema = BaseChallengeSchema.partial()

export interface Challenge {
  id: string
  name: string
  description?: string
  level_id: string
  entry_fee: number
  starts_at: Date
  ends_at: Date
  attempts_config: {
    type: 'per_day' | 'total_per_user' | 'unlimited'
    limit: number
  }
  prize_distribution: Record<string, number>
  rake_bps: number
  min_players?: number
  max_players?: number
  status: 'draft' | 'active' | 'closing' | 'closed'
  featured: boolean
  category?: 'daily' | 'weekly' | 'special' | 'tournament'
  created_by: string
  created_at: Date
  updated_at: Date
  
  // Computed fields
  current_pot?: number
  player_count?: number
  attempts_count?: number
}

export interface ChallengeWithStats extends Challenge {
  current_pot: number
  player_count: number
  attempts_count: number
  user_attempts?: number
  user_best_score?: number
  user_rank?: number
}