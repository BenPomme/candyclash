import { FastifyPluginAsync } from 'fastify'
import { collections } from './firebase'
import { CreateLevelSchema } from './types'
import { v4 as uuidv4 } from 'uuid'
import * as admin from 'firebase-admin'

const levelRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/levels', async (_request, reply) => {
    const snapshot = await collections.levels
      .where('is_active', '==', true)
      .orderBy('created_at', 'desc')
      .get()

    const levels = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    return reply.send({ levels })
  })

  fastify.get('/api/levels/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    
    const doc = await collections.levels.doc(id).get()
    
    if (!doc.exists) {
      return reply.code(404).send({ error: 'Level not found' })
    }

    const level = { id: doc.id, ...doc.data() }
    return reply.send({ level })
  })

  fastify.post('/api/levels', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }

    const body = CreateLevelSchema.parse(request.body)
    const levelId = uuidv4()

    await collections.levels.doc(levelId).set({
      name: body.name,
      config: body.config,
      created_by: request.user.userId,
      is_active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    })

    const doc = await collections.levels.doc(levelId).get()
    const level = { id: doc.id, ...doc.data() }

    return reply.code(201).send({ level })
  })

  fastify.put('/api/levels/:id', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }

    const { id } = request.params as { id: string }
    const body = CreateLevelSchema.parse(request.body)

    await collections.levels.doc(id).update({
      name: body.name,
      config: body.config,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    })

    const doc = await collections.levels.doc(id).get()
    
    if (!doc.exists) {
      return reply.code(404).send({ error: 'Level not found' })
    }

    const level = { id: doc.id, ...doc.data() }
    return reply.send({ level })
  })

  fastify.delete('/api/levels/:id', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }

    const { id } = request.params as { id: string }

    await collections.levels.doc(id).update({
      is_active: false
    })

    return reply.send({ success: true })
  })

  fastify.post('/api/levels/:id/test', async (_request, reply) => {
    return reply.code(501).send({ error: 'Not implemented yet' })
  })
}

export default levelRoutes