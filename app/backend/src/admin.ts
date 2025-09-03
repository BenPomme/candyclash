const { collections } = require('./firebase')
const { registerRoutes } = require('./route-helper')

const adminRoutes: any = async (fastify: any) => {
  const routes = registerRoutes(fastify)
  // Public seed endpoint for initial setup
  // Temporary endpoint to make a user admin
  routes.post('/admin/make-admin', async (request, reply) => {
    const { email } = request.body as { email: string }
    
    if (!email) {
      return reply.code(400).send({ error: 'Email required' })
    }
    
    try {
      // Find user by email
      const usersSnapshot = await collections.users.where('email', '==', email).limit(1).get()
      
      if (usersSnapshot.empty) {
        return reply.code(404).send({ error: 'User not found' })
      }
      
      const userDoc = usersSnapshot.docs[0]
      await userDoc.ref.update({
        is_admin: true
      })
      
      return reply.send({
        success: true,
        message: `User ${email} is now an admin`,
        userId: userDoc.id
      })
    } catch (error) {
      console.error('Make admin error:', error)
      return reply.code(500).send({ error: 'Failed to make user admin' })
    }
  })
  
  routes.post('/admin/seed', async (request, reply) => {
    try {
      // Create default level if it doesn't exist
      const levelId = 'default-level'
      const levelDoc = await collections.levels.doc(levelId).get()
      
      if (!levelDoc.exists) {
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
      }
      
      // Only create challenge if it doesn't exist or is closed
      const challengeId = 'daily-challenge'
      const challengeDoc = await collections.challenges.doc(challengeId).get()
      
      if (!challengeDoc.exists || (challengeDoc.exists && challengeDoc.data().status === 'closed')) {
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
          ends_at: endOfDay,
          status: 'active'
        })
      }
      
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
    console.log('=== CLOSE CHALLENGE DEBUG START ===')
    console.log('Request user:', request.user)
    console.log('Is admin?:', request.user?.isAdmin)
    console.log('Request body:', request.body)
    
    if (!request.user?.isAdmin) {
      console.log('FAILED: User is not admin')
      return reply.code(403).send({ error: 'Admin access required' })
    }
    
    const { challengeId } = request.body as { challengeId: string }
    console.log('Challenge ID to close:', challengeId)
    
    // Get challenge to get prize distribution
    console.log('Fetching challenge document...')
    const challengeDoc = await collections.challenges.doc(challengeId).get()
    if (!challengeDoc.exists) {
      console.log('FAILED: Challenge not found')
      return reply.code(404).send({ error: 'Challenge not found' })
    }
    
    const challenge = challengeDoc.data() as any
    console.log('Challenge data:', challenge)
    console.log('Challenge status:', challenge.status)
    
    if (challenge.status === 'closed') {
      console.log('WARNING: Challenge already closed')
      return reply.code(400).send({ error: 'Challenge is already closed' })
    }
    
    const prizeDistribution = challenge.prize_distribution || { '1st': 40, '2nd': 25, '3rd': 15 }
    console.log('Prize distribution:', prizeDistribution)
    
    // Get final leaderboard
    const { getLeaderboard, getPot } = require('./firebase')
    console.log('Fetching leaderboard...')
    const leaderboard = await getLeaderboard(challengeId, 50)
    console.log('Leaderboard entries:', leaderboard.length)
    console.log('Top 3:', leaderboard.slice(0, 3))
    
    console.log('Fetching pot...')
    const pot = await getPot(challengeId)
    console.log('Total pot:', pot)
    
    // Apply rake if configured
    const rakeBps = challenge.rake_bps || 0
    const rake = Math.floor(pot * rakeBps / 10000)
    const netPot = pot - rake
    
    // Calculate prizes based on configured distribution
    const prizes: Record<number, number> = {}
    const positions = Object.keys(prizeDistribution).sort()
    
    positions.forEach((position, index) => {
      const place = index + 1
      const percent = prizeDistribution[position]
      prizes[place] = Math.floor(netPot * percent / 100)
    })
    
    // Award prizes to winners
    const payouts = []
    const maxWinners = Math.min(Object.keys(prizes).length, leaderboard.length)
    console.log('Processing payouts for', maxWinners, 'winners')
    
    for (let i = 0; i < maxWinners; i++) {
      const position = i + 1
      const winner = leaderboard[i]
      const prize = prizes[position] || 0
      
      console.log(`Processing position ${position}:`, {
        winner: winner?.displayName,
        userId: winner?.userId,
        prize
      })
      
      if (prize > 0 && winner) {
        try {
          // Update winner's balance
          console.log(`Fetching user ${winner.userId}...`)
          const userDoc = await collections.users.doc(winner.userId).get()
          if (!userDoc.exists) {
            console.log(`WARNING: User ${winner.userId} not found`)
            continue
          }
          
          const userData = userDoc.data()
          const oldBalance = userData?.gold_balance || 0
          const newBalance = oldBalance + prize
          
          console.log(`Updating balance: ${oldBalance} -> ${newBalance}`)
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
        console.log(`Successfully processed payout for position ${position}`)
        } catch (error) {
          console.error(`ERROR processing payout for position ${position}:`, error)
        }
      }
    }
    
    console.log('All payouts processed:', payouts)
    
    // Update challenge status to closed
    try {
      console.log('Updating challenge status to closed...')
      await collections.challenges.doc(challengeId).update({
        status: 'closed',
        closed_at: new Date(),
        final_pot: pot,
        rake_collected: rake,
        winners: payouts,
        updated_at: new Date()
      })
      console.log('Challenge status updated successfully')
    } catch (error) {
      console.error('ERROR updating challenge status:', error)
      return reply.code(500).send({ error: 'Failed to update challenge status' })
    }
    
    // Don't automatically create a new challenge - let admin do it manually
    console.log('=== CLOSE CHALLENGE SUCCESS ===')
    console.log(`Challenge ${challengeId} closed successfully`)
    console.log(`Prizes awarded: ${payouts.length}`)
    console.log(`Total pot: ${pot} Gold Bars`)
    console.log('=== CLOSE CHALLENGE DEBUG END ===')
    
    return reply.send({
      success: true,
      pot,
      netPot,
      rake,
      payouts,
      message: `Challenge closed successfully. ${payouts.length} prizes awarded. Total pot: ${pot} Gold Bars.`
    })
  })

  routes.post('/admin/challenge/create', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    
    const { 
      name = 'Daily Clash',
      levelId = 'default-level',
      entryFee = 20,
      attemptsPerDay = 2,
      rakeBps = 0,
      startsImmediately = true
    } = request.body as any
    
    const now = new Date()
    const startTime = startsImmediately ? new Date() : new Date(now.setHours(0, 0, 0, 0))
    
    // Create end time as a new date object set to end of today
    const endTime = new Date()
    endTime.setHours(23, 59, 59, 999)
    
    try {
      // First check if there's an existing challenge
      const existingDoc = await collections.challenges.doc('daily-challenge').get()
      if (existingDoc.exists) {
        const existing = existingDoc.data() as any
        if (existing.status !== 'closed') {
          return reply.code(400).send({ error: 'Cannot create new challenge while one is active. Close it first.' })
        }
      }
      
      // Create/overwrite the challenge document
      const challengeData = {
        name,
        level_id: levelId,
        entry_fee: entryFee,
        attempts_per_day: attemptsPerDay,
        rake_bps: rakeBps,
        starts_at: startTime,
        ends_at: endTime,
        status: 'active',
        created_at: new Date()
      }
      
      console.log('Creating challenge with data:', {
        ...challengeData,
        starts_at: startTime.toISOString(),
        ends_at: endTime.toISOString()
      })
      
      await collections.challenges.doc('daily-challenge').set(challengeData)
      
      // Clear the leaderboard and pot for the new day
      const { realtimeDb } = require('./firebase')
      const date = new Date().toISOString().split('T')[0]
      
      // Clear leaderboard
      const leaderboardRef = realtimeDb.ref(`leaderboards/daily-challenge/${date}`)
      await leaderboardRef.remove()
      
      // Reset pot to 0
      const potRef = realtimeDb.ref(`pots/daily-challenge/${date}`)
      await potRef.set(0)
      
      return reply.send({
        success: true,
        message: 'New challenge created successfully',
        challenge: {
          id: 'daily-challenge',
          name,
          entryFee,
          attemptsPerDay,
          startsAt: startTime,
          endsAt: endTime
        }
      })
    } catch (error) {
      console.error('Create challenge error:', error)
      return reply.code(500).send({ error: 'Failed to create challenge' })
    }
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
