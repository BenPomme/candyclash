const { collections } = require('./firebase')
const { v4: uuidv4 } = require('uuid')

async function seedDatabase() {
  console.log('🌱 Seeding database...')
  
  try {
    // Create default level
    const levelId = 'default-level-' + uuidv4()
    await collections.levels.doc(levelId).set({
      name: 'Classic Match-3',
      config: {
        grid: {
          width: 8,
          height: 8,
        },
        objectives: {
          primary: {
            type: 'collect',
            target: 'yellow',
            count: 100,
          },
          timeLimit: 180,
        },
        candies: {
          colors: ['red', 'blue', 'green', 'yellow', 'purple'],
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
      },
      created_by: 'system',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    console.log('✅ Created default level:', levelId)
    
    // Create daily challenge
    const challengeId = 'daily-challenge-' + uuidv4()
    const now = new Date()
    const startOfDay = new Date(now.setHours(0, 0, 0, 0))
    const endOfDay = new Date(now.setHours(23, 59, 59, 999))
    
    await collections.challenges.doc(challengeId).set({
      name: 'Daily Clash',
      level_id: levelId,
      entry_fee: 20,
      attempts_per_day: 2,
      starts_at: startOfDay,
      ends_at: endOfDay,
      rake_bps: 0,
    })
    console.log('✅ Created daily challenge:', challengeId)
    
    // Create admin user
    const adminId = 'admin-' + uuidv4()
    await collections.users.doc(adminId).set({
      email: 'admin@candyclash.com',
      display_name: 'Admin',
      gold_balance: 10000,
      is_admin: true,
      created_at: new Date(),
    })
    console.log('✅ Created admin user: admin@candyclash.com')
    
    console.log('🎉 Database seeded successfully!')
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  }
}

seedDatabase()
export {}
