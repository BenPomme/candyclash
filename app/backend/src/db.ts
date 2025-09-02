import { Kysely, PostgresDialect } from 'kysely'
import pkg from 'pg'
const { Pool } = pkg
import { Database } from './types'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.PG_URL) {
  throw new Error('PG_URL environment variable is required')
}

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.PG_URL,
      max: 10,
    }),
  }),
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
})