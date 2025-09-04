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
const feedbackRoutes = require('./feedback').default

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
  await fastify.register(feedbackRoutes)

  // Health check on both paths
  const healthHandler = async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
  const { registerRoute } = require('./route-helper')
  registerRoute(fastify, 'get', '/health', healthHandler)

  return fastify
}

let app: any

exports.api = functions.https.onRequest(async (req, res) => {
  if (!app) {
    const fastify = await buildApp()
    await fastify.ready()
    app = fastify
  }
  
  // Properly handle the request with Fastify
  await app.inject({
    method: req.method,
    url: req.url,
    headers: req.headers,
    payload: req.body,
  }).then((response) => {
    res.status(response.statusCode)
    Object.keys(response.headers).forEach((key) => {
      res.setHeader(key, response.headers[key])
    })
    res.send(response.payload)
  }).catch((err) => {
    console.error('Error handling request:', err)
    res.status(500).send('Internal Server Error')
  })
})

export {}
