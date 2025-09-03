const { CompleteAttemptSchema } = require('./types')
const { verifyAttemptToken } = require('./auth')
const { collections, addToLeaderboard, getLeaderboard, getPot } = require('./firebase')
const { registerRoutes } = require('./route-helper')

const attemptRoutes: any = async (fastify: any) => {
  const routes = registerRoutes(fastify)
  
  routes.post('/attempt/:id/complete', async (request, reply) => {
    console.log('=== ATTEMPT COMPLETE START ===')
    console.log('User:', request.user)
    
    if (!request.user) {
      console.log('No user - returning 401')
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { id: attemptId } = request.params as { id: string }
    console.log('Attempt ID:', attemptId)
    
    let body
    try {
      body = CompleteAttemptSchema.parse(request.body)
      console.log('Request body parsed:', { timeMs: body.timeMs, moves: body.moves, hasToken: !!body.attemptToken })
    } catch (error) {
      console.error('Failed to parse request body:', error)
      return reply.code(400).send({ error: 'Invalid request body' })
    }
    
    // Verify attempt token
    try {
      console.log('Verifying attempt token...')
      const tokenData = verifyAttemptToken(body.attemptToken)
      console.log('Token data:', tokenData)
      
      if (tokenData.attemptId !== attemptId || tokenData.userId !== request.user.userId) {
        console.log('Token validation failed:', {
          tokenAttemptId: tokenData.attemptId,
          expectedAttemptId: attemptId,
          tokenUserId: tokenData.userId,
          expectedUserId: request.user.userId
        })
        return reply.code(403).send({ error: 'Invalid attempt token' })
      }
      console.log('Token verified successfully')
    } catch (error) {
      console.error('Token verification error:', error)
      return reply.code(403).send({ error: 'Invalid attempt token' })
    }
    
    // Get attempt
    const attemptDoc = await collections.attempts.doc(attemptId).get()
    if (!attemptDoc.exists) {
      return reply.code(404).send({ error: 'Attempt not found' })
    }
    
    const attempt = attemptDoc.data() as any
    
    // Check if already completed
    if (attempt.ended_at) {
      return reply.code(400).send({ error: 'Attempt already completed' })
    }
    
    // Update attempt
    await collections.attempts.doc(attemptId).update({
      ended_at: new Date(),
      time_ms: body.timeMs,
      collected: body.collected,
      valid: true,
      moves_made: body.moves
    })
    
    // Get user for display name
    const userDoc = await collections.users.doc(request.user.userId).get()
    const user = userDoc.data() as any
    
    // For users created before display_name was added, use email prefix
    let displayNameToUse = 'Anonymous'
    if (user) {
      if (user.display_name) {
        displayNameToUse = user.display_name
      } else if (user.email) {
        // Use email prefix for users without display name
        displayNameToUse = user.email.split('@')[0]
        // Update the user document with this display name for future use
        await collections.users.doc(request.user.userId).update({
          display_name: displayNameToUse
        })
      }
    }
    
    console.log('Completing attempt for user:', {
      userId: request.user.userId,
      displayName: displayNameToUse,
      email: user?.email,
      attemptId,
      timeMs: body.timeMs
    })
    
    // Add to leaderboard
    await addToLeaderboard(
      attempt.challenge_id,
      attemptId,
      request.user.userId,
      body.timeMs,
      displayNameToUse
    )
    
    // Get current rank and pot
    console.log('Getting leaderboard and rank...')
    const leaderboard = await getLeaderboard(attempt.challenge_id)
    const rank = leaderboard.findIndex(entry => entry.attemptId === attemptId) + 1
    const pot = await getPot(attempt.challenge_id)
    
    console.log('=== ATTEMPT COMPLETE SUCCESS ===')
    console.log(`Attempt ${attemptId} completed successfully`)
    console.log(`Rank: ${rank}, Pot: ${pot}`)
    
    return reply.send({
      rank,
      pot,
      leaderboard: leaderboard.slice(0, 10)
    })
  })
}

module.exports = { default: attemptRoutes }
export {}
