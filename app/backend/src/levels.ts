const { collections, firestore } = require('./firebase')
const { CreateLevelSchema } = require('./types')
const { v4: uuidv4 } = require('uuid')
const { registerRoutes } = require('./route-helper')

const levelRoutes: any = async (fastify: any) => {
  const routes = registerRoutes(fastify)
  routes.get('/levels', async (_request, reply) => {
    try {
      console.log('Fetching all levels using direct Firestore reference...')
      // Use direct firestore reference to bypass any collection wrapper
      const levelsRef = firestore.collection('levels')
      const snapshot = await levelsRef.get()
      
      console.log(`Found ${snapshot.docs.length} total levels in Firestore`)
      
      // Map and filter documents
      const levels = []
      snapshot.forEach(doc => {
        const data = doc.data()
        // Include levels where is_active is not explicitly false
        if (data.is_active !== false) {
          levels.push({
            id: doc.id,
            ...data
          })
          console.log(`Including level: ${data.name || doc.id}`)
        }
      })
      
      // Sort by created_at in memory
      levels.sort((a, b) => {
        const aTime = a.created_at?.toDate?.() || a.created_at || new Date(0)
        const bTime = b.created_at?.toDate?.() || b.created_at || new Date(0)
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })

      console.log(`Returning ${levels.length} active levels`)
      return reply.send({ levels })
    } catch (error) {
      console.error('Error fetching levels:', error)
      console.error('Error stack:', error.stack)
      return reply.code(500).send({ error: 'Failed to fetch levels', message: error.message })
    }
  })

  routes.get('/levels/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    
    const doc = await collections.levels.doc(id).get()
    
    if (!doc.exists) {
      return reply.code(404).send({ error: 'Level not found' })
    }

    const level = { id: doc.id, ...doc.data() }
    return reply.send({ level })
  })

  routes.post('/levels', async (request, reply) => {
    console.log('POST /levels - User:', request.user)
    console.log('Request body:', JSON.stringify(request.body, null, 2))
    
    if (!request.user?.isAdmin) {
      console.log('User is not admin')
      return reply.code(403).send({ error: 'Admin access required' })
    }

    let body
    try {
      body = CreateLevelSchema.parse(request.body)
      console.log('Level schema validated successfully')
    } catch (error) {
      console.error('Level schema validation failed:', error)
      return reply.code(400).send({ error: 'Invalid level data', details: error.errors })
    }
    const levelId = uuidv4()

    await collections.levels.doc(levelId).set({
      name: body.name,
      config: body.config,
      created_by: request.user.userId,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    })

    const doc = await collections.levels.doc(levelId).get()
    const level = { id: doc.id, ...doc.data() }

    return reply.code(201).send({ level })
  })

  routes.put('/levels/:id', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }

    const { id } = request.params as { id: string }
    const body = CreateLevelSchema.parse(request.body)

    await collections.levels.doc(id).update({
      name: body.name,
      config: body.config,
      updated_at: new Date(),
    })

    const doc = await collections.levels.doc(id).get()
    
    if (!doc.exists) {
      return reply.code(404).send({ error: 'Level not found' })
    }

    const level = { id: doc.id, ...doc.data() }
    return reply.send({ level })
  })

  routes.delete('/levels/:id', async (request, reply) => {
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }

    const { id } = request.params as { id: string }

    await collections.levels.doc(id).update({
      is_active: false
    })

    return reply.send({ success: true })
  })

  routes.post('/levels/:id/test', async (_request, reply) => {
    return reply.code(501).send({ error: 'Not implemented yet' })
  })
}

module.exports = { default: levelRoutes }
export {}
