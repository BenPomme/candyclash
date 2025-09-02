import { FastifyPluginAsync } from 'fastify'
import { db } from './db'
import { redis } from './redis'
import dayjs from 'dayjs'

const challengeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/challenge/today', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const now = new Date()
    const challenge = await db
      .selectFrom('challenges')
      .innerJoin('levels', 'challenges.level_id', 'levels.id')
      .select([
        'challenges.id',
        'challenges.name',
        'challenges.entry_fee',
        'challenges.attempts_per_day',
        'challenges.ends_at',
        'levels.config',
      ])
      .where('challenges.starts_at', '<=', now)
      .where('challenges.ends_at', '>=', now)
      .executeTakeFirst()

    if (!challenge) {
      return reply.code(404).send({ error: 'No active challenge found' })
    }

    const attemptCount = await db
      .selectFrom('attempts')
      .where('user_id', '=', request.user.userId)
      .where('challenge_id', '=', challenge.id)
      .where('started_at', '>=', dayjs().startOf('day').toDate())
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst()

    const user = await db
      .selectFrom('users')
      .select('gold_balance')
      .where('id', '=', request.user.userId)
      .executeTakeFirstOrThrow()

    const potKey = `pot:${challenge.id}:${dayjs().format('YYYYMMDD')}`
    const pot = parseInt((await redis.get(potKey)) || '0', 10)

    return reply.send({
      challenge: {
        id: challenge.id,
        name: challenge.name,
        entryFee: challenge.entry_fee,
        endsAt: challenge.ends_at,
      },
      level: challenge.config,
      pot,
      closesAt: challenge.ends_at,
      attemptsLeft: challenge.attempts_per_day - Number(attemptCount?.count || 0),
      userBalance: user.gold_balance,
    })
  })

  fastify.post('/api/challenge/:id/join', async (request, reply) => {
    return reply.code(501).send({ error: 'Not implemented yet' })
  })
}

export default challengeRoutes