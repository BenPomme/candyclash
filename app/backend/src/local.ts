const Fastify = require('fastify')
const cors = require('@fastify/cors')
const helmet = require('@fastify/helmet')
const rateLimit = require('@fastify/rate-limit')
const { Server } = require('socket.io')
const dotenv = require('dotenv')
const authPlugin = require('./auth').default
const challengeRoutes = require('./challenge').default
const attemptRoutes = require('./attempts').default
const leaderboardRoutes = require('./leaderboard').default
const levelRoutes = require('./levels').default
const adminRoutes = require('./admin').default
const { setupSocketHandlers } = require('./sockets')

dotenv.config()

const PORT = parseInt(process.env.PORT || '8080', 10)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000'

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  })

  await fastify.register(cors, {
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  })

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  await fastify.register(authPlugin)
  await fastify.register(challengeRoutes)
  await fastify.register(attemptRoutes)
  await fastify.register(leaderboardRoutes)
  await fastify.register(levelRoutes)
  await fastify.register(adminRoutes)

  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  const io = new Server(fastify.server, {
    cors: {
      origin: FRONTEND_ORIGIN,
      credentials: true,
    },
    path: '/socket.io/',
  })

  setupSocketHandlers(io)

  return fastify
}

async function start() {
  try {
    console.log('✅ Firebase Admin SDK initialized')

    const server = await buildServer()
    
    await server.listen({ port: PORT, host: '0.0.0.0' })
    console.log(`✅ Server listening on port ${PORT}`)
    console.log(`✅ Frontend origin: ${FRONTEND_ORIGIN}`)
  } catch (err) {
    console.error('❌ Failed to start server:', err)
    process.exit(1)
  }
}

start()