const { collections, getPot } = require('./firebase')
const { registerRoutes } = require('./route-helper')
const { CreateChallengeSchema, UpdateChallengeSchema } = require('./types/challenge')
const { v4: uuidv4 } = require('uuid')

const challengesRoutes: any = async (fastify: any) => {
  const routes = registerRoutes(fastify)
  
  // Get all active challenges
  routes.get('/challenges', async (request, reply) => {
    const { category, featured } = request.query as { category?: string, featured?: boolean }
    
    let query = collections.challenges
      .where('status', '==', 'active')
      .where('starts_at', '<=', new Date())
      .where('ends_at', '>', new Date())
    
    if (category) {
      query = query.where('category', '==', category)
    }
    
    if (featured !== undefined) {
      query = query.where('featured', '==', featured)
    }
    
    const snapshot = await query.get()
    const challenges = []
    
    for (const doc of snapshot.docs) {
      const challenge = { id: doc.id, ...doc.data() } as any
      
      // Get current pot and player count
      const pot = await getPot(doc.id)
      
      // Count unique players (would be better with proper index)
      const attemptsSnapshot = await collections.attempts
        .where('challenge_id', '==', doc.id)
        .get()
      
      const uniquePlayers = new Set(attemptsSnapshot.docs.map(d => d.data().user_id))
      
      challenges.push({
        ...challenge,
        current_pot: pot,
        player_count: uniquePlayers.size,
        attempts_count: attemptsSnapshot.size,
      })
    }
    
    // Sort by pot size (biggest first) or by ending soon
    challenges.sort((a, b) => b.current_pot - a.current_pot)
    
    return reply.send({ challenges })
  })
  
  // Get specific challenge details
  routes.get('/challenges/:id', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    
    const { id } = request.params as { id: string }
    
    const doc = await collections.challenges.doc(id).get()
    if (!doc.exists) {
      return reply.code(404).send({ error: 'Challenge not found' })
    }
    
    const challenge = { id: doc.id, ...doc.data() } as any
    
    // Check if active
    const now = new Date()
    const startsAt = challenge.starts_at?.toDate ? challenge.starts_at.toDate() : new Date(challenge.starts_at)
    const endsAt = challenge.ends_at?.toDate ? challenge.ends_at.toDate() : new Date(challenge.ends_at)
    
    if (startsAt > now || endsAt < now || challenge.status !== 'active') {
      return reply.code(400).send({ error: 'Challenge is not active' })
    }
    
    // Get level config
    const levelDoc = await collections.levels.doc(challenge.level_id).get()
    const level = levelDoc.exists ? levelDoc.data() : null
    
    if (!level) {
      return reply.code(404).send({ error: 'Level not found' })
    }
    
    // Get user's attempts for this challenge
    const userAttempts = await collections.attempts
      .where('user_id', '==', request.user.userId)
      .where('challenge_id', '==', id)
      .get()
    
    // Calculate attempts left based on challenge config
    let attemptsLeft = 0
    const attemptConfig = challenge.attempts_config || { type: 'per_day', limit: 2 }
    
    if (attemptConfig.type === 'unlimited') {
      attemptsLeft = 999
    } else if (attemptConfig.type === 'total_per_user') {
      attemptsLeft = Math.max(0, attemptConfig.limit - userAttempts.size)
    } else if (attemptConfig.type === 'per_day') {
      // Count today's attempts
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      
      const todayAttempts = userAttempts.docs.filter(doc => {
        const data = doc.data()
        const startedAt = data.started_at?.toDate ? data.started_at.toDate() : new Date(data.started_at)
        return startedAt >= startOfDay
      })
      
      attemptsLeft = Math.max(0, attemptConfig.limit - todayAttempts.length)
    }
    
    // Get user balance
    const userDoc = await collections.users.doc(request.user.userId).get()
    const user = userDoc.exists ? userDoc.data() : null
    
    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }
    
    // Get pot and stats
    const pot = await getPot(id)
    
    // Get player count
    const allAttemptsSnapshot = await collections.attempts
      .where('challenge_id', '==', id)
      .get()
    
    const uniquePlayers = new Set(allAttemptsSnapshot.docs.map(d => d.data().user_id))
    
    // Get user's best score
    let userBestScore = null
    let userRank = null
    
    const completedAttempts = userAttempts.docs
      .filter(d => d.data().ended_at)
      .map(d => ({ id: d.id, ...d.data() }))
    
    if (completedAttempts.length > 0) {
      userBestScore = Math.min(...completedAttempts.map(a => a.time_ms))
      
      // Get user rank (simplified - should use leaderboard)
      const { getLeaderboard } = require('./firebase')
      const leaderboard = await getLeaderboard(id, 100)
      const userEntry = leaderboard.find((e: any) => e.userId === request.user.userId)
      if (userEntry) {
        userRank = leaderboard.indexOf(userEntry) + 1
      }
    }
    
    return reply.send({
      challenge: {
        id: challenge.id,
        name: challenge.name,
        description: challenge.description,
        entry_fee: challenge.entry_fee,
        ends_at: endsAt,
        attempts_config: attemptConfig,
        prize_distribution: challenge.prize_distribution || { '1st': 40, '2nd': 25, '3rd': 15 },
        category: challenge.category,
      },
      level: level.config,
      pot,
      player_count: uniquePlayers.size,
      attempts_left: attemptsLeft,
      user_balance: user.gold_balance,
      user_best_score: userBestScore,
      user_rank: userRank,
    })
  })
  
  // Create new challenge (admin only)
  routes.post('/challenges', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    
    const body = CreateChallengeSchema.parse(request.body)
    const challengeId = uuidv4()
    
    // Calculate end time if duration provided
    let startsAt = body.starts_at ? new Date(body.starts_at) : new Date()
    let endsAt: Date
    
    if (body.ends_at) {
      endsAt = new Date(body.ends_at)
    } else if (body.duration_hours) {
      endsAt = new Date(startsAt.getTime() + body.duration_hours * 60 * 60 * 1000)
    } else {
      // Default to 24 hours
      endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000)
    }
    
    await collections.challenges.doc(challengeId).set({
      name: body.name,
      description: body.description,
      level_id: body.level_id,
      entry_fee: body.entry_fee,
      starts_at: startsAt,
      ends_at: endsAt,
      attempts_config: body.attempts_config,
      prize_distribution: body.prize_distribution,
      rake_bps: body.rake_bps,
      min_players: body.min_players,
      max_players: body.max_players,
      status: 'active',
      featured: body.featured,
      category: body.category,
      created_by: request.user.userId,
      created_at: new Date(),
      updated_at: new Date(),
    })
    
    return reply.code(201).send({
      success: true,
      challengeId,
      message: 'Challenge created successfully',
    })
  })
  
  // Update challenge (admin only)
  routes.put('/challenges/:id', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    
    const { id } = request.params as { id: string }
    const body = UpdateChallengeSchema.parse(request.body)
    
    const doc = await collections.challenges.doc(id).get()
    if (!doc.exists) {
      return reply.code(404).send({ error: 'Challenge not found' })
    }
    
    const updates: any = { ...body, updated_at: new Date() }
    
    // Recalculate end time if duration changed
    if (body.duration_hours && !body.ends_at) {
      const challenge = doc.data() as any
      const startsAt = body.starts_at ? new Date(body.starts_at) : challenge.starts_at
      updates.ends_at = new Date(startsAt.getTime() + body.duration_hours * 60 * 60 * 1000)
    }
    
    await collections.challenges.doc(id).update(updates)
    
    return reply.send({
      success: true,
      message: 'Challenge updated successfully',
    })
  })
  
  // Delete/deactivate challenge (admin only)
  routes.delete('/challenges/:id', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    
    const { id } = request.params as { id: string }
    
    await collections.challenges.doc(id).update({
      status: 'closed',
      updated_at: new Date(),
    })
    
    return reply.send({
      success: true,
      message: 'Challenge closed successfully',
    })
  })
}

module.exports = { default: challengesRoutes }
export {}