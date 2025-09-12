const admin = require('firebase-admin')

// Initialize Firebase Admin (same as in firebase.ts)
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

async function closeTournaments() {
  console.log('=== MANUAL TOURNAMENT CLOSURE SCRIPT ===')
  console.log('Starting at:', new Date().toISOString())
  
  try {
    // Get all active challenges
    const challengesSnapshot = await db.collection('challenges')
      .where('status', '==', 'active')
      .get()
    
    console.log(`\nFound ${challengesSnapshot.size} active challenges`)
    
    const now = new Date()
    let closedCount = 0
    
    for (const doc of challengesSnapshot.docs) {
      const challenge = doc.data()
      const challengeId = doc.id
      
      // Check if challenge has ended
      const endsAt = challenge.ends_at?.toDate ? challenge.ends_at.toDate() : new Date(challenge.ends_at)
      
      console.log(`\n--- Challenge: ${challengeId} ---`)
      console.log(`Name: ${challenge.name}`)
      console.log(`Ends at: ${endsAt.toISOString()}`)
      console.log(`Current time: ${now.toISOString()}`)
      console.log(`Should close: ${now > endsAt}`)
      
      if (now > endsAt) {
        console.log('Processing closure...')
        
        // Get pot from Realtime Database
        const potRef = rtdb.ref(`pots/${challengeId}`)
        const potSnapshot = await potRef.once('value')
        const pot = potSnapshot.val() || 0
        
        console.log(`Pot value: ${pot} gold bars`)
        
        // Get attempts for this challenge to find winners
        const attemptsSnapshot = await db.collection('attempts')
          .where('challenge_id', '==', challengeId)
          .where('valid', '==', true)
          .orderBy('time_ms', 'asc')
          .limit(3)
          .get()
        
        console.log(`Found ${attemptsSnapshot.size} valid attempts`)
        
        if (attemptsSnapshot.size === 0) {
          console.log('No valid attempts, closing challenge without payouts')
          await doc.ref.update({ 
            status: 'closed',
            closed_at: admin.firestore.FieldValue.serverTimestamp()
          })
          closedCount++
          continue
        }
        
        // Calculate payouts
        const payouts = []
        const attempts = attemptsSnapshot.docs
        
        if (attempts.length >= 1) {
          const winner = attempts[0].data()
          payouts.push({
            userId: winner.user_id,
            amount: Math.floor(pot * 0.4),
            rank: 1,
            attemptId: attempts[0].id
          })
        }
        
        if (attempts.length >= 2) {
          const second = attempts[1].data()
          payouts.push({
            userId: second.user_id,
            amount: Math.floor(pot * 0.25),
            rank: 2,
            attemptId: attempts[1].id
          })
        }
        
        if (attempts.length >= 3) {
          const third = attempts[2].data()
          payouts.push({
            userId: third.user_id,
            amount: Math.floor(pot * 0.15),
            rank: 3,
            attemptId: attempts[2].id
          })
        }
        
        console.log('\nPayouts to process:')
        payouts.forEach(p => {
          console.log(`  Rank ${p.rank}: User ${p.userId} gets ${p.amount} gold bars`)
        })
        
        // Process payouts in a transaction
        await db.runTransaction(async (transaction) => {
          // Process each payout
          for (const payout of payouts) {
            const userRef = db.collection('users').doc(payout.userId)
            const userDoc = await transaction.get(userRef)
            
            if (userDoc.exists) {
              const userData = userDoc.data()
              const currentBalance = userData.gold_balance || 0
              const newBalance = currentBalance + payout.amount
              
              // Update user balance
              transaction.update(userRef, { gold_balance: newBalance })
              
              // Create transaction record
              const txRef = db.collection('transactions').doc()
              transaction.set(txRef, {
                user_id: payout.userId,
                challenge_id: challengeId,
                type: 'payout',
                amount: payout.amount,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                meta: { 
                  rank: payout.rank,
                  attemptId: payout.attemptId,
                  previous_balance: currentBalance,
                  new_balance: newBalance
                }
              })
              
              // Update global stats
              const globalStatsRef = db.collection('globalStats').doc(payout.userId)
              const globalStatsDoc = await transaction.get(globalStatsRef)
              
              if (globalStatsDoc.exists) {
                const stats = globalStatsDoc.data()
                transaction.update(globalStatsRef, {
                  totalGoldGained: (stats.totalGoldGained || 0) + payout.amount,
                  netGoldChange: (stats.netGoldChange || 0) + payout.amount,
                  lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                })
              } else {
                transaction.set(globalStatsRef, {
                  userId: payout.userId,
                  displayName: userData.display_name || 'Unknown',
                  totalGoldGained: payout.amount,
                  totalGoldLost: 0,
                  netGoldChange: payout.amount,
                  gamesPlayed: userData.gamesPlayed || 0,
                  lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                })
              }
              
              console.log(`✅ Paid ${payout.amount} gold to ${userData.display_name || payout.userId} (Rank ${payout.rank})`)
            } else {
              console.log(`⚠️  User ${payout.userId} not found, skipping payout`)
            }
          }
          
          // Mark challenge as closed
          transaction.update(doc.ref, { 
            status: 'closed',
            closed_at: admin.firestore.FieldValue.serverTimestamp(),
            final_pot: pot,
            final_entries: attempts.length,
            payouts: payouts.map(p => ({
              user_id: p.userId,
              amount: p.amount,
              rank: p.rank
            }))
          })
        })
        
        // Also update realtime database for global leaderboard
        for (const payout of payouts) {
          const userDoc = await db.collection('users').doc(payout.userId).get()
          if (userDoc.exists) {
            const userData = userDoc.data()
            await rtdb.ref(`globalLeaderboard/${payout.userId}`).transaction((current) => {
              if (!current) {
                return {
                  displayName: userData.display_name || 'Unknown',
                  netGoldChange: payout.amount,
                  gamesPlayed: userData.gamesPlayed || 0,
                  lastUpdated: Date.now()
                }
              }
              return {
                ...current,
                netGoldChange: (current.netGoldChange || 0) + payout.amount,
                lastUpdated: Date.now()
              }
            })
          }
        }
        
        console.log(`\n✅ Successfully closed challenge ${challengeId}`)
        closedCount++
        
      } else {
        console.log('Challenge is still active, skipping')
      }
    }
    
    console.log(`\n=== SUMMARY ===`)
    console.log(`Closed ${closedCount} challenges`)
    console.log('Script completed successfully!')
    
  } catch (error) {
    console.error('\n❌ Error during closure:', error)
    process.exit(1)
  }
  
  process.exit(0)
}

// Run the script
closeTournaments()