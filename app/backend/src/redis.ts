import { createClient } from 'redis'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required')
}

export const redis = createClient({
  url: process.env.REDIS_URL,
})

redis.on('error', (err) => {
  console.error('Redis Client Error', err)
})

redis.on('connect', () => {
  console.log('Redis Client Connected')
})

export async function connectRedis() {
  await redis.connect()
}

export async function disconnectRedis() {
  await redis.disconnect()
}