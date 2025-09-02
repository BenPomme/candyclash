const { CompleteAttemptSchema } = require('./types')
const { verifyAttemptToken } = require('./auth')
const { collections, addToLeaderboard, getLeaderboard, getPot } = require('./firebase')

const attemptRoutes: any = async (fastify: any) => {
  fastify.post('/api/attempt/:id/complete', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { id: attemptId } = request.params as { id: string }
    const body = CompleteAttemptSchema.parse(request.body)
    
    // Verify attempt token
    try {
      const tokenData = verifyAttemptToken(body.attemptToken)
      
      if (tokenData.attemptId !== attemptId || tokenData.userId !== request.user.userId) {
        return reply.code(403).send({ error: 'Invalid attempt token' })
      }
    } catch (error) {
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
    
    // Add to leaderboard
    await addToLeaderboard(
      attempt.challenge_id,
      attemptId,
      request.user.userId,
      body.timeMs,
      user?.display_name || user?.email || 'Anonymous'
    )
    
    // Get current rank and pot
    const leaderboard = await getLeaderboard(attempt.challenge_id)
    const rank = leaderboard.findIndex(entry => entry.attemptId === attemptId) + 1
    const pot = await getPot(attempt.challenge_id)
    
    return reply.send({
      rank,
      pot,
      leaderboard: leaderboard.slice(0, 10)
    })
  })
}

module.exports = { default: attemptRoutes }
export {}
