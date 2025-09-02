// Create a challenge in production using the API
async function createChallenge() {
  const apiUrl = 'https://us-central1-candyclash-85fd4.cloudfunctions.net/api'
  
  console.log('🎮 Creating daily challenge in production...')
  
  try {
    // First, we need to check if we can access the admin endpoint
    // For now, let's document what needs to be created in Firebase Console
    
    console.log('\n📝 To create a challenge, add these documents in Firebase Console:\n')
    
    console.log('1. In Firestore, create a document in "levels" collection:')
    console.log('   Document ID: default-level')
    console.log('   Fields:')
    console.log('   - name: "Classic Match-3"')
    console.log('   - is_active: true')
    console.log('   - created_by: "system"')
    console.log('   - created_at: (timestamp)')
    console.log('   - config: {')
    console.log('       grid: { width: 8, height: 8 },')
    console.log('       objectives: {')
    console.log('         primary: { type: "collect", target: "yellow", count: 100 },')
    console.log('         timeLimit: 180')
    console.log('       },')
    console.log('       candies: { colors: ["red", "blue", "green", "yellow", "purple"] },')
    console.log('       difficulty: {')
    console.log('         entryFee: 20,')
    console.log('         attemptsPerDay: 2,')
    console.log('         prizeDistribution: { "1st": 40, "2nd": 25, "3rd": 15 }')
    console.log('       }')
    console.log('     }')
    
    console.log('\n2. In Firestore, create a document in "challenges" collection:')
    console.log('   Document ID: daily-challenge')
    console.log('   Fields:')
    console.log('   - name: "Daily Clash"')
    console.log('   - level_id: "default-level"')
    console.log('   - entry_fee: 20')
    console.log('   - attempts_per_day: 2')
    console.log('   - rake_bps: 0')
    
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)
    
    console.log(`   - starts_at: ${startOfDay.toISOString()} (as Timestamp)`)
    console.log(`   - ends_at: ${endOfDay.toISOString()} (as Timestamp)`)
    
    console.log('\n✅ After creating these documents, the game will work!')
    console.log('🌐 Game URL: https://candyclash-85fd4.web.app')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

createChallenge()