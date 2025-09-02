import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import * as jwt from 'jsonwebtoken'
import { LoginSchema, JWTPayload } from './types'
import { getUserByEmail, collections } from './firebase'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import * as admin from 'firebase-admin'

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h'

export function generateToken(payload: JWTPayload): string {
  const tokenPayload = {
    userId: payload.userId,
    email: payload.email,
    isAdmin: payload.isAdmin
  }
  return jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload
}

export function generateAttemptToken(
  userId: string,
  challengeId: string,
  attemptId: string,
  startTs: number,
): string {
  const data = `${userId}:${challengeId}:${attemptId}:${startTs}`
  const hmac = crypto.createHmac('sha256', JWT_SECRET)
  hmac.update(data)
  const signature = hmac.digest('hex')
  return Buffer.from(JSON.stringify({ userId, challengeId, attemptId, startTs, signature })).toString('base64')
}

export function verifyAttemptToken(token: string): {
  userId: string
  challengeId: string
  attemptId: string
  startTs: number
} {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
    const { userId, challengeId, attemptId, startTs, signature } = decoded
    
    const data = `${userId}:${challengeId}:${attemptId}:${startTs}`
    const hmac = crypto.createHmac('sha256', JWT_SECRET)
    hmac.update(data)
    const expectedSignature = hmac.digest('hex')
    
    if (signature !== expectedSignature) {
      throw new Error('Invalid attempt token signature')
    }
    
    return { userId, challengeId, attemptId, startTs }
  } catch (error) {
    throw new Error('Invalid attempt token')
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null)

  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url === '/api/auth/dev-login' || request.url === '/api/health') {
      return
    }

    const authHeader = request.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or invalid authorization header' })
    }

    const token = authHeader.substring(7)
    try {
      const payload = verifyToken(token)
      request.user = payload
    } catch (error) {
      return reply.code(401).send({ error: 'Invalid or expired token' })
    }
  })

  fastify.post('/api/auth/dev-login', async (request, reply) => {
    const body = LoginSchema.parse(request.body)
    
    let user = await getUserByEmail(body.email)
    
    if (!user) {
      const userId = uuidv4()
      const displayName = body.email.split('@')[0]
      
      const batch = admin.firestore().batch()
      
      const userRef = collections.users.doc(userId)
      batch.set(userRef, {
        email: body.email,
        display_name: displayName,
        gold_balance: 200,
        is_admin: false,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      })
      
      const transactionRef = collections.transactions.doc()
      batch.set(transactionRef, {
        user_id: userId,
        challenge_id: null,
        type: 'seed',
        amount: 200,
        meta: { reason: 'Initial balance' },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      })
      
      await batch.commit()
      
      user = await getUserByEmail(body.email)
    }
    
    if (!user) {
      return reply.code(500).send({ error: 'Failed to create user' })
    }
    
    const userData = user as any
    const token = generateToken({
      userId: userData.id,
      email: userData.email,
      isAdmin: userData.is_admin || false,
    })
    
    return reply.send({
      token,
      user: {
        id: userData.id,
        email: userData.email,
        displayName: userData.display_name,
        goldBalance: userData.gold_balance,
        isAdmin: userData.is_admin || false,
      },
    })
  })

  fastify.get('/api/me', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    
    const doc = await collections.users.doc(request.user.userId).get()
    const user = doc.exists ? { id: doc.id, ...doc.data() } : null
    
    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }
    
    const userData = user as any
    return reply.send({
      id: userData.id,
      email: userData.email,
      displayName: userData.display_name,
      goldBalance: userData.gold_balance,
      isAdmin: userData.is_admin || false,
    })
  })
}

export default fp(authPlugin)