import { FastifyPluginAsync } from 'fastify'
import { db } from './db'
import { CreateLevelSchema } from './types'
import { v4 as uuidv4 } from 'uuid'

const levelRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/levels', async (request, reply) => {
    const levels = await db
      .selectFrom('levels')
      .select(['id', 'name', 'config', 'created_at', 'updated_at'])
      .where('is_active', '=', true)
      .orderBy('created_at', 'desc')
      .execute()

    return reply.send({ levels })
  })

  fastify.get('/api/levels/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    
    const level = await db
      .selectFrom('levels')
      .selectAll()
      .where('id', '=', id)
      .where('is_active', '=', true)
      .executeTakeFirst()

    if (!level) {
      return reply.code(404).send({ error: 'Level not found' })
    }

    return reply.send({ level })
  })

  fastify.post('/api/levels', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }

    const body = CreateLevelSchema.parse(request.body)
    const levelId = uuidv4()

    await db
      .insertInto('levels')
      .values({
        id: levelId,
        name: body.name,
        config: body.config as any,
        created_by: request.user.userId,
        is_active: true,
      })
      .execute()

    const level = await db
      .selectFrom('levels')
      .selectAll()
      .where('id', '=', levelId)
      .executeTakeFirstOrThrow()

    return reply.code(201).send({ level })
  })

  fastify.put('/api/levels/:id', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }

    const { id } = request.params as { id: string }
    const body = CreateLevelSchema.parse(request.body)

    await db
      .updateTable('levels')
      .set({
        name: body.name,
        config: body.config as any,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .execute()

    const level = await db
      .selectFrom('levels')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    if (!level) {
      return reply.code(404).send({ error: 'Level not found' })
    }

    return reply.send({ level })
  })

  fastify.delete('/api/levels/:id', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }

    const { id } = request.params as { id: string }

    await db
      .updateTable('levels')
      .set({ is_active: false })
      .where('id', '=', id)
      .execute()

    return reply.send({ success: true })
  })

  fastify.post('/api/levels/:id/test', async (request, reply) => {
    return reply.code(501).send({ error: 'Not implemented yet' })
  })
}

export default levelRoutes