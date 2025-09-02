import { FastifyPluginAsync } from 'fastify'

const attemptRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/attempt/:id/complete', async (_request, reply) => {
    return reply.code(501).send({ error: 'Not implemented yet' })
  })
}

export default attemptRoutes