import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('display_name', 'text')
    .addColumn('gold_balance', 'integer', (col) => col.notNull().defaultTo(200))
    .addColumn('is_admin', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createTable('levels')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('config', 'jsonb', (col) => col.notNull())
    .addColumn('created_by', 'uuid', (col) => col.notNull().references('users.id'))
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createTable('challenges')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('level_id', 'uuid', (col) => col.notNull().references('levels.id'))
    .addColumn('entry_fee', 'integer', (col) => col.notNull())
    .addColumn('attempts_per_day', 'integer', (col) => col.notNull().defaultTo(2))
    .addColumn('rake_bps', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('starts_at', 'timestamptz', (col) => col.notNull())
    .addColumn('ends_at', 'timestamptz', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('attempts')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id'))
    .addColumn('challenge_id', 'uuid', (col) => col.notNull().references('challenges.id'))
    .addColumn('started_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('ended_at', 'timestamptz')
    .addColumn('time_ms', 'integer')
    .addColumn('collected', 'jsonb')
    .addColumn('valid', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('attempt_no', 'integer', (col) => col.notNull())
    .addColumn('moves_made', 'integer')
    .execute()

  await db.schema
    .createTable('transactions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id'))
    .addColumn('challenge_id', 'uuid', (col) => col.references('challenges.id'))
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('amount', 'integer', (col) => col.notNull())
    .addColumn('meta', 'jsonb')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createTable('boosters')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id'))
    .addColumn('challenge_id', 'uuid', (col) => col.references('challenges.id'))
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('idx_users_email')
    .on('users')
    .column('email')
    .execute()

  await db.schema
    .createIndex('idx_attempts_user_challenge')
    .on('attempts')
    .columns(['user_id', 'challenge_id'])
    .execute()

  await db.schema
    .createIndex('idx_transactions_user')
    .on('transactions')
    .column('user_id')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('boosters').ifExists().execute()
  await db.schema.dropTable('transactions').ifExists().execute()
  await db.schema.dropTable('attempts').ifExists().execute()
  await db.schema.dropTable('challenges').ifExists().execute()
  await db.schema.dropTable('levels').ifExists().execute()
  await db.schema.dropTable('users').ifExists().execute()
}