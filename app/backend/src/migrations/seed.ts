import { db } from '../db'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'

async function seed() {
  console.log('Seeding database...')

  const adminUserId = uuidv4()
  
  await db
    .insertInto('users')
    .values({
      id: adminUserId,
      email: 'admin@candyclash.com',
      display_name: 'Admin',
      gold_balance: 10000,
      is_admin: true,
    })
    .execute()

  const defaultLevelConfig = {
    grid: {
      width: 8,
      height: 8,
      blockedTiles: [],
      specialTiles: {},
    },
    objectives: {
      primary: {
        type: 'collect' as const,
        target: 'yellow',
        count: 100,
      },
      timeLimit: undefined,
      moveLimit: undefined,
    },
    candies: {
      colors: ['red', 'yellow', 'green', 'blue', 'purple'],
      spawnWeights: {
        red: 20,
        yellow: 20,
        green: 20,
        blue: 20,
        purple: 20,
      },
    },
    difficulty: {
      entryFee: 20,
      attemptsPerDay: 2,
      prizeDistribution: {
        '1st': 40,
        '2nd': 25,
        '3rd': 15,
      },
    },
  }

  const easyLevelId = uuidv4()
  const mediumLevelId = uuidv4()
  const hardLevelId = uuidv4()

  await db
    .insertInto('levels')
    .values([
      {
        id: easyLevelId,
        name: 'Easy Yellow Rush',
        config: {
          ...defaultLevelConfig,
          candies: {
            ...defaultLevelConfig.candies,
            spawnWeights: {
              red: 18,
              yellow: 28,
              green: 18,
              blue: 18,
              purple: 18,
            },
          },
          difficulty: {
            ...defaultLevelConfig.difficulty,
            entryFee: 10,
          },
        },
        created_by: adminUserId,
        is_active: true,
      },
      {
        id: mediumLevelId,
        name: 'Medium Yellow Challenge',
        config: defaultLevelConfig,
        created_by: adminUserId,
        is_active: true,
      },
      {
        id: hardLevelId,
        name: 'Hard Yellow Master',
        config: {
          ...defaultLevelConfig,
          grid: {
            ...defaultLevelConfig.grid,
            width: 9,
            height: 9,
            blockedTiles: [[0, 0], [8, 8], [0, 8], [8, 0]],
          },
          candies: {
            colors: ['red', 'yellow', 'green', 'blue', 'purple', 'orange'],
            spawnWeights: {
              red: 18,
              yellow: 17,
              green: 17,
              blue: 17,
              purple: 16,
              orange: 15,
            },
          },
          objectives: {
            primary: {
              type: 'collect' as const,
              target: 'yellow',
              count: 150,
            },
          },
          difficulty: {
            ...defaultLevelConfig.difficulty,
            entryFee: 50,
            prizeDistribution: {
              '1st': 45,
              '2nd': 25,
              '3rd': 10,
            },
          },
        },
        created_by: adminUserId,
        is_active: true,
      },
    ])
    .execute()

  const dailyChallengeId = uuidv4()
  
  await db
    .insertInto('challenges')
    .values({
      id: dailyChallengeId,
      name: 'Daily Yellow Rush',
      level_id: mediumLevelId,
      entry_fee: 20,
      attempts_per_day: 2,
      rake_bps: 0,
      starts_at: dayjs().startOf('day').toDate(),
      ends_at: dayjs().endOf('day').toDate(),
    })
    .execute()

  console.log('Seeding complete!')
  console.log('Admin user created: admin@candyclash.com')
  console.log('Daily challenge created: Daily Yellow Rush')
  console.log('3 levels created: Easy, Medium, Hard')
  
  process.exit(0)
}

seed().catch((error) => {
  console.error('Seeding failed:', error)
  process.exit(1)
})