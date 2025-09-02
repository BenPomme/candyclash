import { FastifyPluginAsync } from 'fastify'
import { collections, getPot } from './firebase'
import dayjs from 'dayjs'

const challengeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/challenge/today', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const now = new Date()
    const challengesSnapshot = await collections.challenges
      .where('starts_at', '<=', now)
      .where('ends_at', '>=', now)
      .limit(1)
      .get()

    if (challengesSnapshot.empty) {
      return reply.code(404).send({ error: 'No active challenge found' })
    }

    const challengeDoc = challengesSnapshot.docs[0]
    const challenge = { id: challengeDoc.id, ...challengeDoc.data() } as any

    // Get level config
    const levelDoc = await collections.levels.doc(challenge.level_id).get()
    const level = levelDoc.exists ? levelDoc.data() : null

    if (!level) {
      return reply.code(404).send({ error: 'Level not found' })
    }

    // Count user's attempts today
    const startOfDay = dayjs().startOf('day').toDate()
    const attemptsSnapshot = await collections.attempts
      .where('user_id', '==', request.user.userId)
      .where('challenge_id', '==', challenge.id)
      .where('started_at', '>=', startOfDay)
      .get()

    const attemptCount = attemptsSnapshot.size

    // Get user balance
    const userDoc = await collections.users.doc(request.user.userId).get()
    const user = userDoc.exists ? userDoc.data() : null

    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }

    const pot = await getPot(challenge.id)

    return reply.send({
      challenge: {
        id: challenge.id,
        name: challenge.name,
        entryFee: challenge.entry_fee,
        endsAt: challenge.ends_at,
      },
      level: level.config,
      pot,
      closesAt: challenge.ends_at,
      attemptsLeft: challenge.attempts_per_day - attemptCount,
      userBalance: user.gold_balance,
    })
  })

  fastify.post('/api/challenge/:id/join', async (_request, reply) => {
    return reply.code(501).send({ error: 'Not implemented yet' })
  })
}

export default challengeRoutes