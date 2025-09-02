const attemptRoutes: any = async (fastify: any) => {
  fastify.post('/api/attempt/:id/complete', async (_request, reply) => {
    return reply.code(501).send({ error: 'Not implemented yet' })
  })
}

module.exports = { default: attemptRoutes }
export {}
