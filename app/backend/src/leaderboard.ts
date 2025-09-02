const { getLeaderboard, getPot } = require('./firebase')
const { registerRoutes } = require('./route-helper')

const leaderboardRoutes: any = async (fastify: any) => {
  const routes = registerRoutes(fastify)
  
  routes.get('/leaderboard/:id', async (request, reply) => {
    const { id: challengeId } = request.params as { id: string }
    const { limit = 50 } = request.query as { limit?: number }
    
    // Get leaderboard
    const entries = await getLeaderboard(challengeId, Number(limit))
    
    // Get pot
    const pot = await getPot(challengeId)
    
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
      closesAt: new Date().setHours(23, 59, 59, 999)
    })
  })
}

module.exports = { default: leaderboardRoutes }
export {}
