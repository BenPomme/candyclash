import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { db } from './db'
import { JWTPayload, LoginSchema } from './types'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h'

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
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
    
    let user = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', body.email)
      .executeTakeFirst()
    
    if (!user) {
      const userId = uuidv4()
      const displayName = body.email.split('@')[0]
      
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('users')
          .values({
            id: userId,
            email: body.email,
            display_name: displayName,
            gold_balance: 200,
            is_admin: false,
          })
          .execute()
        
        await trx
          .insertInto('transactions')
          .values({
            id: uuidv4(),
            user_id: userId,
            challenge_id: null,
            type: 'seed',
            amount: 200,
            meta: { reason: 'Initial balance' },
          })
          .execute()
      })
      
      user = await db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', userId)
        .executeTakeFirstOrThrow()
    }
    
    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.is_admin,
    })
    
    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        goldBalance: user.gold_balance,
        isAdmin: user.is_admin,
      },
    })
  })

  fastify.get('/api/me', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', request.user.userId)
      .executeTakeFirst()
    
    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }
    
    return reply.send({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      goldBalance: user.gold_balance,
      isAdmin: user.is_admin,
    })
  })
}

export default fp(authPlugin)