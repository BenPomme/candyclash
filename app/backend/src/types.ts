const { z } = require('zod')

interface Database {
  users: UsersTable
  levels: LevelsTable
  challenges: ChallengesTable
  attempts: AttemptsTable
  transactions: TransactionsTable
  boosters: BoostersTable
}

interface UsersTable {
  id: string
  email: string
  display_name: string | null
  gold_balance: number
  created_at: Date
  is_admin: boolean
}

interface LevelsTable {
  id: string
  name: string
  config: LevelConfig
  created_by: string
  created_at: Date
  updated_at: Date
  is_active: boolean
}

interface ChallengesTable {
  id: string
  name: string
  level_id: string
  entry_fee: number
  attempts_per_day: number
  starts_at: Date
  ends_at: Date
  rake_bps: number
}

interface AttemptsTable {
  id: string
  user_id: string
  challenge_id: string
  started_at: Date
  ended_at: Date | null
  time_ms: number | null
  collected: Record<string, number> | null
  valid: boolean
  attempt_no: number
  moves_made: number | null
}

interface TransactionsTable {
  id: string
  user_id: string
  challenge_id: string | null
  type: 'seed' | 'entry_fee' | 'payout' | 'refund' | 'admin_adjust'
  amount: number
  created_at: Date
  meta: Record<string, any> | null
}

interface BoostersTable {
  id: string
  user_id: string
  challenge_id: string | null
  type: string
  expires_at: Date
  created_at: Date
}

interface LevelConfig {
  grid: {
    width: number
    height: number
    blockedTiles?: Array<[number, number]>
    specialTiles?: {
      jelly?: Array<[number, number]>
      chocolate?: Array<[number, number]>
    }
  }
  objectives: {
    primary: {
      type: 'collect' | 'score' | 'clear'
      target?: string
      count?: number
      score?: number
    }
    timeLimit?: number
    moveLimit?: number
  }
  candies: {
    colors: string[]
    spawnWeights?: Record<string, number>
  }
  difficulty: {
    entryFee: number
    attemptsPerDay: number
    prizeDistribution: {
      '1st': number
      '2nd': number
      '3rd': number
    }
  }
}

const LoginSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
})

const JoinChallengeSchema = z.object({
  challengeId: z.string().uuid(),
})

const CompleteAttemptSchema = z.object({
  timeMs: z.number().positive(),
  collected: z.record(z.string(), z.number()),
  moves: z.number().int().positive(),
  attemptToken: z.string(),
})

const CreateLevelSchema = z.object({
  name: z.string().min(1).max(100),
  config: z.object({
    grid: z.object({
      width: z.number().int().min(6).max(10),
      height: z.number().int().min(6).max(10),
      blockedTiles: z.array(z.tuple([z.number(), z.number()])).optional(),
      specialTiles: z.object({
        jelly: z.array(z.tuple([z.number(), z.number()])).optional(),
        chocolate: z.array(z.tuple([z.number(), z.number()])).optional(),
      }).optional(),
    }),
    objectives: z.object({
      primary: z.object({
        type: z.enum(['collect', 'score', 'clear']),
        target: z.string().optional(),
        count: z.number().int().positive().optional(),
        score: z.number().int().positive().optional(),
      }),
      timeLimit: z.number().positive().optional(),
      moveLimit: z.number().int().positive().optional(),
    }),
    candies: z.object({
      colors: z.array(z.string()).min(3).max(6),
      spawnWeights: z.record(z.string(), z.number()).optional(),
    }),
    difficulty: z.object({
      entryFee: z.number().int().positive(),
      attemptsPerDay: z.number().int().positive().max(10),
      prizeDistribution: z.object({
        '1st': z.number().int().min(0).max(100),
        '2nd': z.number().int().min(0).max(100),
        '3rd': z.number().int().min(0).max(100),
      }),
    }),
  }),
})

const CreateChallengeSchema = z.object({
  name: z.string().min(1).max(100),
  levelId: z.string().uuid(),
  entryFee: z.number().int().positive(),
  attemptsPerDay: z.number().int().positive().max(10),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
})

interface JWTPayload {
  userId: string
  email: string
  isAdmin: boolean
}

interface AttemptToken {
  userId: string
  challengeId: string
  attemptId: string
  startTs: number
}

module.exports = {
  LoginSchema,
  JoinChallengeSchema,
  CompleteAttemptSchema,
  CreateLevelSchema,
  CreateChallengeSchema
}
export {}
