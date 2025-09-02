const { collections, getPot } = require('./firebase')
const dayjs = require('dayjs')

const challengeRoutes: any = async (fastify: any) => {
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

  fastify.post('/api/challenge/:id/join', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { id: challengeId } = request.params as { id: string }
    const userId = request.user.userId

    // Get challenge
    const challengeDoc = await collections.challenges.doc(challengeId).get()
    if (!challengeDoc.exists) {
      return reply.code(404).send({ error: 'Challenge not found' })
    }
    const challenge = challengeDoc.data() as any

    // Check if challenge is active
    const now = new Date()
    if (now < challenge.starts_at || now > challenge.ends_at) {
      return reply.code(400).send({ error: 'Challenge is not active' })
    }

    // Get user balance
    const userDoc = await collections.users.doc(userId).get()
    if (!userDoc.exists) {
      return reply.code(404).send({ error: 'User not found' })
    }
    const user = userDoc.data() as any

    // Check if user has enough balance
    if (user.gold_balance < challenge.entry_fee) {
      return reply.code(400).send({ error: 'Insufficient balance' })
    }

    // Check attempts today
    const startOfDay = dayjs().startOf('day').toDate()
    const attemptsSnapshot = await collections.attempts
      .where('user_id', '==', userId)
      .where('challenge_id', '==', challengeId)
      .where('started_at', '>=', startOfDay)
      .get()

    if (attemptsSnapshot.size >= challenge.attempts_per_day) {
      return reply.code(400).send({ error: 'Daily attempt limit reached' })
    }

    // Create attempt and deduct entry fee (transaction)
    const { v4: uuidv4 } = require('uuid')
    const { generateAttemptToken, updatePot } = require('./firebase')
    const attemptId = uuidv4()
    const startTs = Date.now()

    // Deduct entry fee
    const newBalance = user.gold_balance - challenge.entry_fee
    await collections.users.doc(userId).update({
      gold_balance: newBalance,
    })

    // Create attempt record
    await collections.attempts.doc(attemptId).set({
      user_id: userId,
      challenge_id: challengeId,
      started_at: new Date(),
      ended_at: null,
      time_ms: null,
      collected: null,
      valid: false,
      attempt_no: attemptsSnapshot.size + 1,
      moves_made: null,
    })

    // Create transaction record
    await collections.transactions.doc().set({
      user_id: userId,
      challenge_id: challengeId,
      type: 'entry_fee',
      amount: -challenge.entry_fee,
      created_at: new Date(),
      meta: { attempt_id: attemptId },
    })

    // Update pot
    await updatePot(challengeId, challenge.entry_fee)

    // Generate attempt token
    const { generateAttemptToken: genToken } = require('./auth')
    const attemptToken = genToken(userId, challengeId, attemptId, startTs)

    return reply.send({
      attemptId,
      attemptToken,
      serverStartTs: startTs,
    })
  })
}

module.exports = { default: challengeRoutes }
export {}
