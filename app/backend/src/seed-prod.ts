// Seed production database with initial data
const admin = require('firebase-admin')

admin.initializeApp({
  projectId: 'candyclash-85fd4',
  databaseURL: 'https://candyclash-85fd4-default-rtdb.firebaseio.com'
})

const firestore = admin.firestore()

async function seedProduction() {
  console.log('🌱 Seeding production database...')
  
  try {
    // Create default level
    const levelId = 'default-level'
    await firestore.collection('levels').doc(levelId).set({
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
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    })
    console.log('✅ Created default level')
    
    // Create daily challenge
    const challengeId = 'daily-challenge'
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)
    
    await firestore.collection('challenges').doc(challengeId).set({
      name: 'Daily Clash',
      level_id: levelId,
      entry_fee: 20,
      attempts_per_day: 2,
      starts_at: admin.firestore.Timestamp.fromDate(startOfDay),
      ends_at: admin.firestore.Timestamp.fromDate(endOfDay),
      rake_bps: 0,
    })
    console.log('✅ Created daily challenge')
    
    console.log('🎉 Production database seeded successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    process.exit(1)
  }
}

seedProduction()