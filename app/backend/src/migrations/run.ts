import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { db } from '../db'
import { Kysely, sql } from 'kysely'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Migration {
  name: string
  up: (db: Kysely<any>) => Promise<void>
  down: (db: Kysely<any>) => Promise<void>
}

async function ensureMigrationTable() {
  await db.schema
    .createTable('migrations')
    .ifNotExists()
    .addColumn('name', 'text', (col) => col.primaryKey())
    .addColumn('executed_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await db
    .selectFrom('migrations')
    .select('name')
    .execute()
  return result.map(r => r.name)
}

async function markMigrationExecuted(name: string) {
  await db
    .insertInto('migrations')
    .values({ name })
    .execute()
}

async function runMigrations() {
  console.log('Running database migrations...')
  
  await ensureMigrationTable()
  const executed = await getExecutedMigrations()
  
  const migrationFiles = await fs.readdir(__dirname)
  const migrationModules = migrationFiles
    .filter(f => f.endsWith('.ts') && f !== 'run.ts' && f !== 'seed.ts')
    .sort()
  
  for (const file of migrationModules) {
    const name = file.replace('.ts', '')
    
    if (executed.includes(name)) {
      console.log(`✓ ${name} (already executed)`)
      continue
    }
    
    const module = await import(path.join(__dirname, file))
    const migration: Migration = {
      name,
      up: module.up,
      down: module.down,
    }
    
    try {
      await migration.up(db)
      await markMigrationExecuted(name)
      console.log(`✓ ${name}`)
    } catch (error) {
      console.error(`✗ ${name}:`, error)
      throw error
    }
  }
  
  console.log('Migrations complete!')
  process.exit(0)
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})