const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getDatabase, ServerValue } = require('firebase-admin/database')
const path = require('path')
const fs = require('fs')

// Load service account
const serviceAccountPath = path.join(__dirname, '..', 'service-account.json')
if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account file not found. Please ensure service-account.json exists in the backend directory.')
  process.exit(1)
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://candy-clash-default-rtdb.firebaseio.com'
})

const db = getFirestore()
const rtdb = getDatabase()

async function manualCloseTournaments() {
  console.log('Starting manual tournament closure process...')
  
  try {
    // Get all challenges that should be closed
    const now = new Date()
    const challengesSnapshot = await db.collection('challenges')
      .where('status', '==', 'active')
      .get()
    
    console.log(`Found ${challengesSnapshot.size} active challenges`)
    
    for (const doc of challengesSnapshot.docs) {
      const challenge = doc.data()
      const challengeId = doc.id
      
      // Check if challenge has ended
      const endsAt = challenge.ends_at?.toDate ? challenge.ends_at.toDate() : new Date(challenge.ends_at)
      
      if (endsAt < now) {
        console.log(`\nProcessing expired challenge: ${challengeId}`)
        console.log(`Challenge name: ${challenge.name}`)
        console.log(`Ended at: ${endsAt.toISOString()}`)
        
        // Get leaderboard from Redis/Realtime DB
        const leaderboardRef = rtdb.ref(`leaderboard/${challengeId}`)
        const leaderboardSnapshot = await leaderboardRef.once('value')
        const leaderboardData = leaderboardSnapshot.val()
        
        if (!leaderboardData || !leaderboardData.entries || leaderboardData.entries.length === 0) {
          console.log(`No entries found for challenge ${challengeId}, marking as closed`)
          await doc.ref.update({ status: 'closed' })
          continue
        }
        
        const entries = leaderboardData.entries
        const pot = leaderboardData.pot || 0
        
        console.log(`Found ${entries.length} entries with pot of ${pot} gold bars`)
        
        // Calculate payouts (40%, 25%, 15% for top 3)
        const payouts = []
        if (entries.length >= 1) {
          payouts.push({
            userId: entries[0].user_id,
            amount: Math.floor(pot * 0.4),
            rank: 1
          })
        }
        if (entries.length >= 2) {
          payouts.push({
            userId: entries[1].user_id,
            amount: Math.floor(pot * 0.25),
            rank: 2
          })
        }
        if (entries.length >= 3) {
          payouts.push({
            userId: entries[2].user_id,
            amount: Math.floor(pot * 0.15),
            rank: 3
          })
        }
        
        console.log('Processing payouts:', payouts)
        
        // Process payouts in a transaction
        await db.runTransaction(async (transaction) => {
          // Update user balances and create transaction records
          for (const payout of payouts) {
            const userRef = db.collection('users').doc(payout.userId)
            const userDoc = await transaction.get(userRef)
            
            if (userDoc.exists) {
              const userData = userDoc.data()!
              const newBalance = (userData.gold_balance || 0) + payout.amount
              
              transaction.update(userRef, { gold_balance: newBalance })
              
              // Create transaction record
              const txRef = db.collection('transactions').doc()
              transaction.set(txRef, {
                user_id: payout.userId,
                challenge_id: challengeId,
                type: 'payout',
                amount: payout.amount,
                created_at: FieldValue.serverTimestamp(),
                meta: { rank: payout.rank }
              })
              
              console.log(`Paid ${payout.amount} gold bars to user ${payout.userId} (rank ${payout.rank})`)
              
              // Update global stats
              const globalStatsRef = db.collection('globalStats').doc(payout.userId)
              const globalStatsDoc = await transaction.get(globalStatsRef)
              
              if (globalStatsDoc.exists) {
                const stats = globalStatsDoc.data()!
                transaction.update(globalStatsRef, {
                  totalGoldGained: (stats.totalGoldGained || 0) + payout.amount,
                  netGoldChange: (stats.netGoldChange || 0) + payout.amount,
                  lastUpdated: FieldValue.serverTimestamp()
                })
              } else {
                transaction.set(globalStatsRef, {
                  userId: payout.userId,
                  displayName: userData.display_name || 'Unknown',
                  totalGoldGained: payout.amount,
                  totalGoldLost: 0,
                  netGoldChange: payout.amount,
                  gamesPlayed: 0,
                  lastUpdated: FieldValue.serverTimestamp()
                })
              }
              
              // Update realtime database for global leaderboard
              await rtdb.ref(`globalLeaderboard/${payout.userId}`).update({
                displayName: userData.display_name || 'Unknown',
                netGoldChange: ServerValue.increment(payout.amount),
                lastUpdated: Date.now()
              })
            }
          }
          
          // Mark challenge as closed
          transaction.update(doc.ref, { 
            status: 'closed',
            closed_at: FieldValue.serverTimestamp(),
            final_pot: pot,
            final_entries: entries.length,
            payouts: payouts
          })
        })
        
        console.log(`Successfully closed challenge ${challengeId} and processed payouts`)
        
      } else {
        console.log(`Challenge ${challengeId} is still active (ends at ${endsAt.toISOString()})`)
      }
    }
    
    console.log('\nManual closure process completed successfully!')
    
  } catch (error) {
    console.error('Error during manual closure:', error)
  }
  
  process.exit(0)
}

// Run the script
manualCloseTournaments()