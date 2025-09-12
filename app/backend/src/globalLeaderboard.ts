import { FastifyInstance } from 'fastify'

const globalLeaderboardRoutes = async (routes: FastifyInstance) => {
  const { getGlobalLeaderboard, getGlobalStats } = require('./firebase')
  
  // Get global leaderboard - all time cumulative gold gains
  routes.get('/global-leaderboard', async (request, reply) => {
    const { limit = 100, userId } = request.query as any
    
    try {
      // Get top players
      const entries = await getGlobalLeaderboard(Math.min(limit, 100))
      
      // Add rank to each entry
      const rankedEntries = entries.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }))
      
      // Find user's rank if requested
      let userRank = null
      let userStats = null
      if (userId) {
        const userIndex = entries.findIndex(e => e.userId === userId)
        if (userIndex !== -1) {
          userRank = userIndex + 1
          userStats = entries[userIndex]
        } else {
          // User not in top list, get their stats separately
          const stats = await getGlobalStats(userId)
          if (stats) {
            userStats = {
              userId,
              displayName: stats.displayName || 'Anonymous',
              netGoldChange: stats.netGoldChange || 0,
              gamesPlayed: stats.gamesPlayed || 0,
              wins: stats.wins || 0,
              winRate: stats.gamesPlayed > 0 ? ((stats.wins || 0) / stats.gamesPlayed * 100).toFixed(1) : '0.0',
            }
            // Estimate rank (would need full scan for exact rank)
            userRank = '>100'
          }
        }
      }
      
      return reply.send({
        leaderboard: rankedEntries,
        userRank,
        userStats,
        totalPlayers: entries.length,
      })
    } catch (error) {
      console.error('Failed to fetch global leaderboard:', error)
      return reply.code(500).send({ error: 'Failed to fetch global leaderboard' })
    }
  })
  
  // Get detailed stats for a specific user
  routes.get('/global-stats/:userId', async (request, reply) => {
    const { userId } = request.params as any
    
    try {
      const stats = await getGlobalStats(userId)
      
      if (!stats) {
        return reply.code(404).send({ error: 'User stats not found' })
      }
      
      // Calculate additional metrics
      const enrichedStats = {
        ...stats,
        winRate: stats.gamesPlayed > 0 ? ((stats.wins || 0) / stats.gamesPlayed * 100).toFixed(1) : '0.0',
        averageGoldPerGame: stats.gamesPlayed > 0 
          ? Math.round((stats.netGoldChange || 0) / stats.gamesPlayed)
          : 0,
      }
      
      return reply.send(enrichedStats)
    } catch (error) {
      console.error('Failed to fetch user global stats:', error)
      return reply.code(500).send({ error: 'Failed to fetch user stats' })
    }
  })
  
  // Get global stats summary
  routes.get('/global-stats/summary', async (request, reply) => {
    try {
      const { collections } = require('./firebase')
      
      // Get aggregate stats from globalStats collection
      const snapshot = await collections.globalStats.get()
      
      let totalPlayers = 0
      let totalGamesPlayed = 0
      let totalGoldCirculated = 0
      let topWinner = { userId: '', displayName: '', netGoldChange: 0 }
      
      snapshot.forEach((doc: any) => {
        const data = doc.data()
        totalPlayers++
        totalGamesPlayed += data.gamesPlayed || 0
        totalGoldCirculated += Math.abs(data.totalGoldGained || 0) + Math.abs(data.totalGoldLost || 0)
        
        if (data.netGoldChange > topWinner.netGoldChange) {
          topWinner = {
            userId: doc.id,
            displayName: data.displayName || 'Anonymous',
            netGoldChange: data.netGoldChange,
          }
        }
      })
      
      return reply.send({
        totalPlayers,
        totalGamesPlayed,
        totalGoldCirculated,
        averageGamesPerPlayer: totalPlayers > 0 ? (totalGamesPlayed / totalPlayers).toFixed(1) : '0',
        topWinner,
      })
    } catch (error) {
      console.error('Failed to fetch global stats summary:', error)
      return reply.code(500).send({ error: 'Failed to fetch stats summary' })
    }
  })
}

module.exports = { default: globalLeaderboardRoutes }
export {}