const adminRoutes: any = async (fastify: any) => {
  fastify.post('/api/admin/challenge/close', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    return reply.code(501).send({ error: 'Not implemented yet' })
  })

  fastify.post('/api/admin/challenge/create', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    return reply.code(501).send({ error: 'Not implemented yet' })
  })

  fastify.get('/api/admin/dashboard', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    return reply.code(501).send({ error: 'Not implemented yet' })
  })

  fastify.post('/api/admin/reset', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    return reply.code(501).send({ error: 'Not implemented yet' })
  })
}

module.exports = { default: adminRoutes }
export {}
