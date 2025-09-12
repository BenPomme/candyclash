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

async function processRetroactivePayouts() {
  console.log('=== PROCESSING RETROACTIVE PAYOUTS ===\n')
  console.log('This will pay players who should have received payouts but didn\'t.\n')
  
  try {
    // Get all valid attempts
    const attemptsSnapshot = await db.collection('attempts')
      .where('valid', '==', true)
      .get()
    
    console.log(`Found ${attemptsSnapshot.size} valid attempts\n`)
    
    // Group attempts by date
    const attemptsByDate = {}
    
    attemptsSnapshot.forEach(doc => {
      const data = doc.data()
      const startedAt = data.started_at?.toDate ? data.started_at.toDate() : new Date(data.started_at)
      const dateKey = startedAt.toISOString().split('T')[0] // YYYY-MM-DD
      
      if (!attemptsByDate[dateKey]) {
        attemptsByDate[dateKey] = []
      }
      
      attemptsByDate[dateKey].push({
        id: doc.id,
        user_id: data.user_id,
        time_ms: data.time_ms,
        started_at: startedAt,
        challenge_id: data.challenge_id || 'daily-challenge'
      })
    })
    
    // Get all existing payouts to check what's already been paid
    const payoutsSnapshot = await db.collection('transactions')
      .where('type', 'in', ['payout', 'refund'])
      .get()
    
    const existingPayouts = new Set()
    payoutsSnapshot.forEach(doc => {
      const data = doc.data()
      if (data.meta?.attempt_id) {
        existingPayouts.add(data.meta.attempt_id)
      }
    })
    
    console.log(`Found ${existingPayouts.size} existing payouts\n`)
    
    // Process each day
    const dates = Object.keys(attemptsByDate).sort()
    const today = new Date().toISOString().split('T')[0]
    
    for (const date of dates) {
      // Skip today (it's still active)
      if (date === today) {
        console.log(`Skipping ${date} (today - tournament still active)\n`)
        continue
      }
      
      const attempts = attemptsByDate[date]
      console.log(`\n=== Processing ${date} ===`)
      console.log(`Found ${attempts.length} valid attempts`)
      
      if (attempts.length < 3) {
        console.log('Less than 3 players - skipping (would need refunds)')
        continue
      }
      
      // Sort by time to find winners
      attempts.sort((a, b) => a.time_ms - b.time_ms)
      
      // Check if top 3 have been paid
      const top3 = attempts.slice(0, 3)
      const unpaidWinners = []
      
      for (let i = 0; i < top3.length; i++) {
        const attempt = top3[i]
        if (!existingPayouts.has(attempt.id)) {
          unpaidWinners.push({
            ...attempt,
            position: i + 1
          })
        }
      }
      
      if (unpaidWinners.length === 0) {
        console.log('✅ All winners already paid')
        continue
      }
      
      console.log(`❌ Found ${unpaidWinners.length} unpaid winners!`)
      
      // Calculate pot (entry fees)
      const entryFee = 10 // Default entry fee
      const pot = attempts.length * entryFee
      console.log(`Pot: ${pot} gold bars (${attempts.length} players × ${entryFee} entry fee)`)
      
      // Process payouts
      for (const winner of unpaidWinners) {
        let payout = 0
        if (winner.position === 1) {
          payout = Math.floor(pot * 0.4) // 40%
        } else if (winner.position === 2) {
          payout = Math.floor(pot * 0.25) // 25%
        } else if (winner.position === 3) {
          payout = Math.floor(pot * 0.15) // 15%
        }
        
        console.log(`\nPaying position ${winner.position}: ${payout} gold bars to ${winner.user_id.substring(0, 8)}...`)
        
        // Update user balance
        const userDoc = await db.collection('users').doc(winner.user_id).get()
        if (!userDoc.exists) {
          console.log(`  ⚠️  User not found, skipping`)
          continue
        }
        
        const userData = userDoc.data()
        const oldBalance = userData.gold_balance || 0
        const newBalance = oldBalance + payout
        
        await db.collection('users').doc(winner.user_id).update({
          gold_balance: newBalance
        })
        
        // Create transaction record
        await db.collection('transactions').doc().set({
          user_id: winner.user_id,
          challenge_id: winner.challenge_id,
          type: 'payout',
          amount: payout,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          meta: {
            position: winner.position,
            attempt_id: winner.id,
            time_ms: winner.time_ms,
            retroactive: true,
            date: date,
            old_balance: oldBalance,
            new_balance: newBalance
          }
        })
        
        // Update global stats
        const globalStatsRef = db.collection('globalStats').doc(winner.user_id)
        const globalStatsDoc = await globalStatsRef.get()
        
        if (globalStatsDoc.exists) {
          const stats = globalStatsDoc.data()
          await globalStatsRef.update({
            totalGoldGained: (stats.totalGoldGained || 0) + payout,
            netGoldChange: (stats.netGoldChange || 0) + payout,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          })
        } else {
          await globalStatsRef.set({
            userId: winner.user_id,
            displayName: userData.display_name || 'Unknown',
            totalGoldGained: payout,
            totalGoldLost: 0,
            netGoldChange: payout,
            gamesPlayed: 1,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          })
        }
        
        // Update realtime database for global leaderboard
        await rtdb.ref(`globalLeaderboard/${winner.user_id}`).transaction((current) => {
          if (!current) {
            return {
              displayName: userData.display_name || 'Unknown',
              netGoldChange: payout,
              gamesPlayed: 1,
              lastUpdated: Date.now()
            }
          }
          return {
            ...current,
            netGoldChange: (current.netGoldChange || 0) + payout,
            lastUpdated: Date.now()
          }
        })
        
        console.log(`  ✅ Paid ${payout} gold bars (${oldBalance} → ${newBalance})`)
      }
    }
    
    console.log('\n=== RETROACTIVE PAYOUT PROCESSING COMPLETE ===')
    
  } catch (error) {
    console.error('Error processing retroactive payouts:', error)
  }
  
  process.exit(0)
}

processRetroactivePayouts()