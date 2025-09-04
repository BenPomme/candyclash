const { collections } = require('./firebase')
const { registerRoutes } = require('./route-helper')
const admin = require('firebase-admin')

const feedbackRoutes: any = async (fastify: any) => {
  const routes = registerRoutes(fastify)
  
  routes.post('/feedback', async (request, reply) => {
    const { message, category = 'general' } = request.body as { message: string, category?: string }
    
    if (!message || message.trim().length === 0) {
      return reply.code(400).send({ error: 'Message is required' })
    }
    
    if (message.length > 1000) {
      return reply.code(400).send({ error: 'Message too long (max 1000 characters)' })
    }
    
    try {
      const feedbackRef = collections.feedback.doc()
      await feedbackRef.set({
        user_id: request.user?.userId || null,
        user_email: request.user?.email || null,
        message: message.trim(),
        category,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        status: 'new', // new, reviewed, resolved
        user_agent: request.headers['user-agent'] || null,
      })
      
      console.log('Feedback submitted:', {
        id: feedbackRef.id,
        userId: request.user?.userId,
        category,
        messageLength: message.length
      })
      
      return reply.send({
        success: true,
        id: feedbackRef.id,
        message: 'Thank you for your feedback!'
      })
    } catch (error) {
      console.error('Failed to save feedback:', error)
      return reply.code(500).send({ error: 'Failed to submit feedback' })
    }
  })
  
  // Admin endpoint to view feedback
  routes.get('/admin/feedback', async (request, reply) => {
    // Check if user is admin
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    
    const { status, limit = 50 } = request.query as { status?: string, limit?: number }
    
    let query = collections.feedback.orderBy('created_at', 'desc')
    
    if (status) {
      query = query.where('status', '==', status)
    }
    
    query = query.limit(Number(limit))
    
    const snapshot = await query.get()
    const feedbackItems = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }))
    
    return reply.send({ feedback: feedbackItems })
  })
  
  // Admin endpoint to update feedback status
  routes.patch('/admin/feedback/:id', async (request, reply) => {
    // Check if user is admin
    if (!request.user?.isAdmin) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
    
    const { id } = request.params as { id: string }
    const { status, adminNote } = request.body as { status?: string, adminNote?: string }
    
    const updates: any = {}
    if (status) updates.status = status
    if (adminNote !== undefined) updates.admin_note = adminNote
    updates.updated_at = admin.firestore.FieldValue.serverTimestamp()
    
    await collections.feedback.doc(id).update(updates)
    
    return reply.send({ success: true })
  })
}

module.exports = { default: feedbackRoutes }
export {}