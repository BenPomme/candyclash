const { getLeaderboard, getPot, collections } = require('./firebase')
const { registerRoutes } = require('./route-helper')
const { PayoutCalculator } = require('./utils/payout-calculator')

const leaderboardRoutes: any = async (fastify: any) => {
  const routes = registerRoutes(fastify)
  
  routes.get('/leaderboard/:id', async (request, reply) => {
    const { id: challengeId } = request.params as { id: string }
    const { limit = 50 } = request.query as { limit?: number }
    
    // Get leaderboard
    const entries = await getLeaderboard(challengeId, Number(limit))
    
    // Get pot
    const pot = await getPot(challengeId)
    
    // Get challenge to get prize distribution
    let prizeDistribution = null
    let calculatedPrizes: any[] = []
    
    try {
      const challengeDoc = await collections.challenges.doc(challengeId).get()
      if (challengeDoc.exists) {
        const challenge = challengeDoc.data() as any
        prizeDistribution = challenge.prize_distribution
        
        // Calculate prizes for all winning positions
        if (prizeDistribution && prizeDistribution.type) {
          const payoutResult = PayoutCalculator.calculatePayouts(
            entries,
            prizeDistribution,
            pot,
            challenge.entry_fee || 20
          )
          
          // Create a map of position to prize amount
          calculatedPrizes = payoutResult.payouts.map((payout: any) => ({
            position: payout.position,
            amount: payout.amount
          }))
        }
      }
    } catch (error) {
      console.error('Failed to get prize distribution:', error)
    }
    
    // Find user's rank if authenticated
    let userRank = null
    if (request.user) {
      const userIndex = entries.findIndex((e: any) => e.userId === request.user.userId)
      if (userIndex !== -1) {
        userRank = userIndex + 1
      }
    }
    
    return reply.send({
      entries,
      pot,
      userRank,
      prizeDistribution,
      calculatedPrizes,
      closesAt: new Date().setHours(23, 59, 59, 999)
    })
  })
}

module.exports = { default: leaderboardRoutes }
export {}
