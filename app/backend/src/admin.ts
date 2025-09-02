const { collections } = require('./firebase')
const { registerRoutes } = require('./route-helper')

const adminRoutes: any = async (fastify: any) => {
  const routes = registerRoutes(fastify)
  // Public seed endpoint for initial setup
  routes.post('/admin/seed', async (request, reply) => {
    try {
      // Create default level
      const levelId = 'default-level'
      const levelRef = collections.levels.doc(levelId)
      await levelRef.set({
        name: 'Classic Match-3',
        is_active: true,
        created_by: 'system',
        created_at: new Date(),
        config: {
          grid: { width: 8, height: 8 },
          objectives: {
            primary: { type: 'collect', target: 'yellow', count: 30 },
            timeLimit: 180
          },
          candies: { colors: ['red', 'blue', 'green', 'yellow', 'purple'] },
          difficulty: {
            entryFee: 20,
            attemptsPerDay: 2,
            prizeDistribution: { '1st': 40, '2nd': 25, '3rd': 15 }
          }
        }
      })
      
      // Create daily challenge
      const challengeId = 'daily-challenge'
      const now = new Date()
      const startOfDay = new Date(now)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(now)
      endOfDay.setHours(23, 59, 59, 999)
      
      const challengeRef = collections.challenges.doc(challengeId)
      await challengeRef.set({
        name: 'Daily Clash',
        level_id: levelId,
        entry_fee: 20,
        attempts_per_day: 2,
        rake_bps: 0,
        starts_at: startOfDay,
        ends_at: endOfDay
      })
      
      return reply.send({
        success: true,
        message: 'Database seeded successfully',
        level: levelId,
        challenge: challengeId
      })
    } catch (error) {
      console.error('Seed error:', error)
      return reply.code(500).send({ error: 'Failed to seed database' })
    }
  })
  
  routes.post('/admin/challenge/close', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    
    const { challengeId } = request.body as { challengeId: string }
    
    // Get final leaderboard
    const { getLeaderboard, getPot } = require('./firebase')
    const leaderboard = await getLeaderboard(challengeId, 50)
    const pot = await getPot(challengeId)
    
    // Calculate prizes (40%, 25%, 15% for top 3)
    const prizes = {
      1: Math.floor(pot * 0.40),
      2: Math.floor(pot * 0.25),
      3: Math.floor(pot * 0.15)
    }
    
    // Award prizes to top 3
    const payouts = []
    for (let i = 0; i < Math.min(3, leaderboard.length); i++) {
      const position = i + 1
      const winner = leaderboard[i]
      const prize = prizes[position]
      
      if (prize > 0) {
        // Update winner's balance
        const userDoc = await collections.users.doc(winner.userId).get()
        const userData = userDoc.data()
        const newBalance = (userData?.gold_balance || 0) + prize
        
        await collections.users.doc(winner.userId).update({
          gold_balance: newBalance
        })
        
        // Record transaction
        await collections.transactions.doc().set({
          user_id: winner.userId,
          challenge_id: challengeId,
          type: 'payout',
          amount: prize,
          created_at: new Date(),
          meta: { 
            position,
            time_ms: winner.timeMs,
            attempt_id: winner.attemptId
          }
        })
        
        payouts.push({
          position,
          userId: winner.userId,
          displayName: winner.displayName,
          prize,
          timeMs: winner.timeMs
        })
      }
    }
    
    return reply.send({
      success: true,
      pot,
      payouts,
      message: `Challenge closed. ${payouts.length} prizes awarded.`
    })
  })

  routes.post('/admin/challenge/create', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    return reply.code(501).send({ error: 'Not implemented yet' })
  })

  routes.get('/admin/dashboard', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    return reply.code(501).send({ error: 'Not implemented yet' })
  })

  routes.post('/admin/reset', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    return reply.code(501).send({ error: 'Not implemented yet' })
  })
}

module.exports = { default: adminRoutes }
export {}
