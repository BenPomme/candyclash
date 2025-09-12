const admin = require('firebase-admin')

// Initialize Firebase Admin
if (!admin.apps.length) {
  const projectId = 'candyclash-85fd4'
  const databaseURL = 'https://candyclash-85fd4-default-rtdb.europe-west1.firebasedatabase.app'
  
  admin.initializeApp({
    projectId,
    databaseURL,
  })
}

const db = admin.firestore()
const rtdb = admin.database()

async function checkDatabase() {
  console.log('=== CHECKING FIREBASE DATABASE ===\n')
  
  try {
    // 1. Check ALL challenges (not just active ones)
    console.log('1. CHECKING CHALLENGES:')
    console.log('------------------------')
    const challengesSnapshot = await db.collection('challenges').get()
    
    console.log(`Total challenges found: ${challengesSnapshot.size}\n`)
    
    const challenges = []
    challengesSnapshot.forEach(doc => {
      const data = doc.data()
      challenges.push({
        id: doc.id,
        ...data,
        ends_at: data.ends_at?.toDate ? data.ends_at.toDate() : data.ends_at
      })
      
      console.log(`Challenge: ${doc.id}`)
      console.log(`  Name: ${data.name}`)
      console.log(`  Status: ${data.status}`)
      console.log(`  Entry Fee: ${data.entry_fee}`)
      console.log(`  Ends At: ${data.ends_at?.toDate ? data.ends_at.toDate() : data.ends_at}`)
      console.log(`  Attempts Per Day: ${data.attempts_per_day}`)
      
      if (data.payouts) {
        console.log(`  Payouts: ${JSON.stringify(data.payouts)}`)
      }
      console.log()
    })
    
    // 2. Check attempts
    console.log('\n2. CHECKING ATTEMPTS:')
    console.log('---------------------')
    const attemptsSnapshot = await db.collection('attempts').limit(20).get()
    
    console.log(`Total attempts found (showing first 20): ${attemptsSnapshot.size}\n`)
    
    const validAttempts = []
    attemptsSnapshot.forEach(doc => {
      const data = doc.data()
      if (data.valid) {
        validAttempts.push({
          id: doc.id,
          ...data
        })
      }
      
      console.log(`Attempt: ${doc.id.substring(0, 8)}...`)
      console.log(`  User: ${data.user_id}`)
      console.log(`  Challenge: ${data.challenge_id}`)
      console.log(`  Valid: ${data.valid}`)
      console.log(`  Time (ms): ${data.time_ms}`)
      console.log(`  Started: ${data.started_at?.toDate ? data.started_at.toDate() : data.started_at}`)
      console.log()
    })
    
    // 3. Check transactions
    console.log('\n3. CHECKING TRANSACTIONS:')
    console.log('-------------------------')
    const transactionsSnapshot = await db.collection('transactions').limit(20).get()
    
    console.log(`Total transactions found (showing first 20): ${transactionsSnapshot.size}\n`)
    
    let totalPayouts = 0
    let totalEntryFees = 0
    
    transactionsSnapshot.forEach(doc => {
      const data = doc.data()
      
      if (data.type === 'payout') {
        totalPayouts += data.amount
      } else if (data.type === 'entry_fee') {
        totalEntryFees += Math.abs(data.amount)
      }
      
      console.log(`Transaction: ${doc.id.substring(0, 8)}...`)
      console.log(`  Type: ${data.type}`)
      console.log(`  Amount: ${data.amount}`)
      console.log(`  User: ${data.user_id}`)
      console.log(`  Challenge: ${data.challenge_id}`)
      console.log(`  Created: ${data.created_at?.toDate ? data.created_at.toDate() : data.created_at}`)
      if (data.meta) {
        console.log(`  Meta: ${JSON.stringify(data.meta)}`)
      }
      console.log()
    })
    
    console.log(`\nTotals:`)
    console.log(`  Entry fees collected: ${totalEntryFees} gold bars`)
    console.log(`  Payouts made: ${totalPayouts} gold bars`)
    
    // 4. Check Realtime Database for pots
    console.log('\n4. CHECKING REALTIME DATABASE POTS:')
    console.log('------------------------------------')
    const potsSnapshot = await rtdb.ref('pots').once('value')
    const pots = potsSnapshot.val() || {}
    
    Object.keys(pots).forEach(challengeId => {
      console.log(`Pot for ${challengeId}: ${pots[challengeId]} gold bars`)
    })
    
    // 5. Check Realtime Database for leaderboards
    console.log('\n5. CHECKING REALTIME DATABASE LEADERBOARDS:')
    console.log('--------------------------------------------')
    const leaderboardSnapshot = await rtdb.ref('leaderboard').once('value')
    const leaderboards = leaderboardSnapshot.val() || {}
    
    Object.keys(leaderboards).forEach(challengeId => {
      const lb = leaderboards[challengeId]
      console.log(`\nLeaderboard for ${challengeId}:`)
      console.log(`  Pot: ${lb.pot || 0} gold bars`)
      console.log(`  Entries: ${lb.entries ? lb.entries.length : 0} players`)
      
      if (lb.entries && lb.entries.length > 0) {
        console.log('  Top 3:')
        lb.entries.slice(0, 3).forEach((entry, i) => {
          console.log(`    ${i + 1}. User ${entry.user_id}: ${entry.time_ms}ms`)
        })
      }
    })
    
    // 6. Analysis
    console.log('\n\n=== ANALYSIS ===')
    console.log('----------------')
    
    const now = new Date()
    const expiredChallenges = challenges.filter(c => 
      c.status === 'active' && 
      c.ends_at && 
      new Date(c.ends_at) < now
    )
    
    if (expiredChallenges.length > 0) {
      console.log(`\n⚠️  FOUND ${expiredChallenges.length} EXPIRED CHALLENGES THAT NEED CLOSURE:`)
      expiredChallenges.forEach(c => {
        console.log(`  - ${c.id}: ${c.name} (ended ${c.ends_at})`)
      })
    }
    
    if (validAttempts.length > 0 && totalPayouts === 0) {
      console.log(`\n⚠️  WARNING: Found ${validAttempts.length} valid attempts but NO payouts have been made!`)
    }
    
  } catch (error) {
    console.error('Error checking database:', error)
  }
  
  process.exit(0)
}

checkDatabase()