const leaderboardRoutes: any = async (fastify: any) => {
  fastify.get('/api/leaderboard/:id', async (_request, reply) => {
    return reply.code(501).send({ error: 'Not implemented yet' })
  })
}

module.exports = { default: leaderboardRoutes }
export {}
