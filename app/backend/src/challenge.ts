const { collections, getPot } = require('./firebase')
const dayjs = require('dayjs')
const { registerRoutes } = require('./route-helper')

const challengeRoutes: any = async (fastify: any) => {
  const routes = registerRoutes(fastify)
  
  routes.get('/challenge/today', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    // For now, just get the challenge by ID (we know it's 'daily-challenge')
    // In production, you'd create proper indexes for date-based queries
    const challengeDoc = await collections.challenges.doc('daily-challenge').get()

    if (!challengeDoc.exists) {
      return reply.code(404).send({ error: 'No active challenge found' })
    }

    const challenge = { id: challengeDoc.id, ...challengeDoc.data() } as any
    
    // Check if challenge is closed
    if (challenge.status === 'closed') {
      return reply.code(404).send({ error: 'Challenge has ended. Please wait for the next challenge.' })
    }

    // Get level config
    let level = null
    const levelId = challenge.level_id
    
    if (!levelId) {
      console.error('Challenge has no level_id:', challenge.id)
      return reply.code(500).send({ error: 'Challenge configuration error: no level specified' })
    }
    
    const levelDoc = await collections.levels.doc(levelId).get()
    
    if (!levelDoc.exists) {
      console.error('Level not found for challenge:', { challengeId: challenge.id, levelId })
      return reply.code(500).send({ error: 'Challenge configuration error: level not found' })
    }
    
    level = levelDoc.data()
    
    if (!level.config) {
      console.error('Level has no config:', { levelId, level })
      return reply.code(500).send({ error: 'Challenge configuration error: level has no configuration' })
    }
    
    console.log('Loaded level config:', { 
      levelId, 
      objectives: level.config.objectives,
      grid: level.config.grid,
      candies: level.config.candies 
    })

    // Count user's attempts today (simplified for now)
    // In production, you'd create proper indexes
    const attemptsSnapshot = await collections.attempts
      .where('user_id', '==', request.user.userId)
      .get()
    
    // Filter in memory for today's attempts on this challenge
    const startOfDay = dayjs().startOf('day').toDate()
    const todayAttempts = attemptsSnapshot.docs.filter(doc => {
      const data = doc.data()
      const startedAt = data.started_at
      // Handle both Date and Firestore Timestamp
      const attemptDate = startedAt?.toDate ? startedAt.toDate() : startedAt
      return data.challenge_id === challenge.id && 
             attemptDate && 
             attemptDate >= startOfDay
    })

    const attemptCount = todayAttempts.length

    // Get user balance
    const userDoc = await collections.users.doc(request.user.userId).get()
    const user = userDoc.exists ? userDoc.data() : null

    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }

    // Get actual pot from Realtime Database
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

  // Join challenge handler
  const joinHandler = async (request, reply) => {
    console.log('=== JOIN HANDLER START ===')
    console.log('Join handler called with params:', request.params)
    console.log('Request URL:', request.url)
    console.log('User:', request.user)
    
    if (!request.user) {
      console.log('No user - returning 401')
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { id: challengeId } = request.params as { id: string }
    const userId = request.user.userId
    console.log('Join attempt - userId:', userId, 'challengeId:', challengeId)

    // Get challenge
    const challengeDoc = await collections.challenges.doc(challengeId).get()
    console.log('Challenge doc exists:', challengeDoc.exists)
    
    if (!challengeDoc.exists) {
      console.log('Challenge not found - returning 404')
      return reply.code(404).send({ error: 'Challenge not found' })
    }
    
    const challenge = challengeDoc.data() as any
    console.log('Challenge data:', JSON.stringify({
      status: challenge.status,
      starts_at: challenge.starts_at,
      ends_at: challenge.ends_at,
      level_id: challenge.level_id,
      entry_fee: challenge.entry_fee
    }))

    // Check if challenge is closed
    if (challenge.status === 'closed') {
      console.log('Challenge is closed - returning 400')
      return reply.code(400).send({ error: 'Challenge has ended' })
    }
    
    // Check if challenge is active (handle Firestore Timestamp and missing dates)
    const now = new Date()
    console.log('Current time:', now.toISOString())
    
    // If dates are present, check them
    if (challenge.starts_at && challenge.ends_at) {
      const startsAt = challenge.starts_at?.toDate ? challenge.starts_at.toDate() : new Date(challenge.starts_at)
      const endsAt = challenge.ends_at?.toDate ? challenge.ends_at.toDate() : new Date(challenge.ends_at)
      
      console.log('Date check - now:', now.toISOString(), 'startsAt:', startsAt.toISOString(), 'endsAt:', endsAt.toISOString())
      console.log('Time comparison: now < startsAt?', now < startsAt, 'now > endsAt?', now > endsAt)
      
      if (now < startsAt || now > endsAt) {
        console.log('Challenge not active based on dates - returning 400')
        return reply.code(400).send({ error: 'Challenge is not active' })
      }
    } else {
      // If no dates, check status only
      console.log('No dates on challenge, checking status only:', challenge.status)
      if (challenge.status !== 'active') {
        console.log('Status is not active - returning 400')
        return reply.code(400).send({ error: 'Challenge is not active' })
      }
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

    // Check attempts today (simplified to avoid index requirements)
    const startOfDay = dayjs().startOf('day').toDate()
    const attemptsSnapshot = await collections.attempts
      .where('user_id', '==', userId)
      .get()
    
    // Filter in memory for today's attempts on this challenge
    const todayAttempts = attemptsSnapshot.docs.filter(doc => {
      const data = doc.data()
      const startedAt = data.started_at
      const attemptDate = startedAt?.toDate ? startedAt.toDate() : startedAt
      return data.challenge_id === challengeId && 
             attemptDate && 
             attemptDate >= startOfDay
    })

    if (todayAttempts.length >= challenge.attempts_per_day) {
      return reply.code(400).send({ error: 'Daily attempt limit reached' })
    }

    // Create attempt and deduct entry fee (transaction)
    const { v4: uuidv4 } = require('uuid')
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
      attempt_no: todayAttempts.length + 1,
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

    // Update pot in Realtime Database
    const { updatePot } = require('./firebase')
    await updatePot(challengeId, challenge.entry_fee)

    // Generate attempt token
    const { generateAttemptToken: genToken } = require('./auth')
    const attemptToken = genToken(userId, challengeId, attemptId, startTs)

    return reply.send({
      attemptId,
      attemptToken,
      serverStartTs: startTs,
    })
  }
  
  // Register on both paths
  routes.post('/challenge/:id/join', joinHandler)
}

module.exports = { default: challengeRoutes }
export {}
