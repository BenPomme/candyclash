import { FastifyPluginAsync } from 'fastify'

const leaderboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/leaderboard/:id', async (_request, reply) => {
    return reply.code(501).send({ error: 'Not implemented yet' })
  })
}

export default leaderboardRoutes