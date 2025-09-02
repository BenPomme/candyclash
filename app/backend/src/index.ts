const functions = require('firebase-functions')
const Fastify = require('fastify')
const cors = require('@fastify/cors')
const helmet = require('@fastify/helmet')
const rateLimit = require('@fastify/rate-limit')
const authPlugin = require('./auth').default
const challengeRoutes = require('./challenge').default
const attemptRoutes = require('./attempts').default
const leaderboardRoutes = require('./leaderboard').default
const levelRoutes = require('./levels').default
const adminRoutes = require('./admin').default

// const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://candyclash-85fd4.web.app'

async function buildApp() {
  const fastify = Fastify({
    logger: false,
  })

  await fastify.register(cors, {
    origin: true,
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

  return fastify
}

let app: any

exports.api = functions.https.onRequest(async (req, res) => {
  if (!app) {
    const fastify = await buildApp()
    await fastify.ready()
    app = fastify
  }
  
  app.server.emit('request', req, res)
})

export {}
