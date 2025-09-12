const admin = require('firebase-admin')
const { PayoutCalculator } = require('../dist/utils/payout-calculator')

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

// Default distribution if none specified
const DEFAULT_DISTRIBUTION = {
  type: 'percentage',
  rake_type: 'percentage',
  rake: 0,
  rules: [
    { position: 1, type: 'percentage', amount: 40 },
    { position: 2, type: 'percentage', amount: 25 },
    { position: 3, type: 'percentage', amount: 15 },
  ],
  minimum_players: 3,
  refund_on_insufficient: true
}

async function processProperPayouts() {
  console.log('=== PROCESSING PAYOUTS WITH PROPER DISTRIBUTION CONFIGS ===\n')
  
  try {
    // Get the current challenge configuration to understand the structure
    const challengeDoc = await db.collection('challenges').doc('daily-challenge').get()
    let currentDistribution = DEFAULT_DISTRIBUTION
    
    if (challengeDoc.exists) {
      const challenge = challengeDoc.data()
      console.log('Current challenge configuration:')
      console.log('  Name:', challenge.name)
      console.log('  Entry Fee:', challenge.entry_fee)
      
      if (challenge.prize_distribution) {
        // Use actual distribution if available
        if (challenge.prize_distribution.rules && challenge.prize_distribution.rules.length > 0) {
          currentDistribution = challenge.prize_distribution
          console.log('  Using challenge prize distribution')
        } else if (challenge.prize_distribution['1st']) {
          // Convert old format
          console.log('  Converting old prize format')
          currentDistribution = {
            type: 'percentage',
            rake_type: 'percentage',
            rake: challenge.rake_bps ? challenge.rake_bps / 100 : 0,
            rules: [],
            minimum_players: 3,
            refund_on_insufficient: true
          }
          
          if (challenge.prize_distribution['1st']) {
            currentDistribution.rules.push({ 
              position: 1, 
              type: 'percentage', 
              amount: challenge.prize_distribution['1st'] 
            })
          }
          if (challenge.prize_distribution['2nd']) {
            currentDistribution.rules.push({ 
              position: 2, 
              type: 'percentage', 
              amount: challenge.prize_distribution['2nd'] 
            })
          }
          if (challenge.prize_distribution['3rd']) {
            currentDistribution.rules.push({ 
              position: 3, 
              type: 'percentage', 
              amount: challenge.prize_distribution['3rd'] 
            })
          }
        }
      }
    }
    
    console.log('\nDistribution to use:')
    console.log('  Type:', currentDistribution.type)
    console.log('  Rake:', currentDistribution.rake + '%')
    console.log('  Rules:')
    currentDistribution.rules.forEach(rule => {
      if (rule.position) {
        console.log(`    Position ${rule.position}: ${rule.amount}${rule.type === 'percentage' ? '%' : ' gold'}`)
      } else if (rule.range) {
        console.log(`    Range ${rule.range[0]}-${rule.range[1]}: ${rule.amount}${rule.type === 'percentage' ? '%' : ' gold'}`)
      } else if (rule.top_percent) {
        console.log(`    Top ${rule.top_percent}%: ${rule.amount}${rule.type === 'percentage' ? '%' : ' gold'}`)
      }
    })
    console.log()
    
    // Get all valid attempts
    const attemptsSnapshot = await db.collection('attempts').get()
    const validAttemptsByDate = {}
    
    attemptsSnapshot.forEach(doc => {
      const data = doc.data()
      if (data.valid && data.time_ms) {
        const date = data.started_at?.toDate ? 
          data.started_at.toDate().toISOString().split('T')[0] : 
          new Date(data.started_at).toISOString().split('T')[0]
        
        if (!validAttemptsByDate[date]) {
          validAttemptsByDate[date] = []
        }
        
        validAttemptsByDate[date].push({
          attemptId: doc.id,
          userId: data.user_id,
          displayName: data.display_name || 'Unknown',
          timeMs: data.time_ms,
          completedAt: data.ended_at || data.started_at
        })
      }
    })
    
    // Get all existing payouts to avoid duplicates
    const payoutSnapshot = await db.collection('transactions')
      .where('type', 'in', ['payout', 'refund'])
      .get()
    
    const paidUsersByDate = {}
    payoutSnapshot.forEach(doc => {
      const data = doc.data()
      const date = data.meta?.date || 
        (data.created_at?.toDate ? data.created_at.toDate().toISOString().split('T')[0] : null)
      
      if (date) {
        if (!paidUsersByDate[date]) {
          paidUsersByDate[date] = new Set()
        }
        paidUsersByDate[date].add(data.user_id)
      }
    })
    
    // Process each date
    const today = new Date().toISOString().split('T')[0]
    const dates = Object.keys(validAttemptsByDate).sort()
    
    let totalProcessed = 0
    let totalPaid = 0
    
    for (const date of dates) {
      if (date === today) {
        console.log(`\n=== ${date} (TODAY - SKIPPING) ===`)
        continue
      }
      
      console.log(`\n=== ${date} ===`)
      
      const attempts = validAttemptsByDate[date]
      console.log(`Total players: ${attempts.length}`)
      
      if (attempts.length === 0) continue
      
      // Sort by time (fastest first)
      const leaderboard = attempts.sort((a, b) => a.timeMs - b.timeMs)
      
      // Calculate pot for this date
      const entryFeeSnapshot = await db.collection('transactions')
        .where('type', '==', 'entry_fee')
        .get()
      
      let grossPot = 0
      let entryFee = 10 // default
      
      entryFeeSnapshot.forEach(doc => {
        const data = doc.data()
        const txDate = data.created_at?.toDate ? 
          data.created_at.toDate().toISOString().split('T')[0] : null
        
        if (txDate === date) {
          grossPot += Math.abs(data.amount)
          entryFee = Math.abs(data.amount) // Use actual entry fee
        }
      })
      
      // If no entry fees found, estimate
      if (grossPot === 0) {
        grossPot = attempts.length * entryFee
        console.log(`Estimated pot: ${grossPot} gold bars`)
      } else {
        console.log(`Actual pot: ${grossPot} gold bars`)
      }
      
      // Calculate payouts using PayoutCalculator
      const payoutResult = PayoutCalculator.calculatePayouts(
        leaderboard,
        currentDistribution,
        grossPot,
        entryFee
      )
      
      console.log(`Net pot after rake: ${payoutResult.netPot} gold bars`)
      console.log(`Rake collected: ${payoutResult.rake} gold bars`)
      
      if (payoutResult.refund) {
        console.log('REFUND MODE - Not enough players')
      }
      
      console.log(`\nPayouts (${payoutResult.payouts.length} winners):`)
      
      // Check who's already been paid
      const alreadyPaid = paidUsersByDate[date] || new Set()
      
      for (const payout of payoutResult.payouts) {
        const isPaid = alreadyPaid.has(payout.userId)
        const status = isPaid ? '✅' : '❌'
        
        console.log(`  ${payout.position}. ${payout.displayName} (${payout.userId.substring(0, 8)}...): ${payout.amount} gold ${status}`)
        
        if (!isPaid && payout.amount > 0) {
          // Process the payout
          const userDoc = await db.collection('users').doc(payout.userId).get()
          
          if (userDoc.exists) {
            const userData = userDoc.data()
            const oldBalance = userData.gold_balance || 0
            const newBalance = oldBalance + payout.amount
            
            // Update balance
            await db.collection('users').doc(payout.userId).update({
              gold_balance: newBalance
            })
            
            // Create transaction
            await db.collection('transactions').doc().set({
              user_id: payout.userId,
              challenge_id: 'daily-challenge',
              type: payoutResult.refund ? 'refund' : 'payout',
              amount: payout.amount,
              created_at: admin.firestore.FieldValue.serverTimestamp(),
              meta: {
                position: payout.position,
                date: date,
                pot: grossPot,
                net_pot: payoutResult.netPot,
                rake: payoutResult.rake,
                retroactive: true,
                old_balance: oldBalance,
                new_balance: newBalance
              }
            })
            
            // Update global stats
            const globalStatsRef = db.collection('globalStats').doc(payout.userId)
            const globalStatsDoc = await globalStatsRef.get()
            
            if (globalStatsDoc.exists) {
              const stats = globalStatsDoc.data()
              await globalStatsRef.update({
                totalGoldGained: (stats.totalGoldGained || 0) + payout.amount,
                netGoldChange: (stats.netGoldChange || 0) + payout.amount,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
              })
            }
            
            // Update realtime leaderboard
            await rtdb.ref(`globalLeaderboard/${payout.userId}`).transaction((current) => {
              if (!current) {
                return {
                  displayName: payout.displayName,
                  netGoldChange: payout.amount,
                  gamesPlayed: 1,
                  lastUpdated: Date.now()
                }
              }
              return {
                ...current,
                netGoldChange: (current.netGoldChange || 0) + payout.amount,
                lastUpdated: Date.now()
              }
            })
            
            console.log(`    → Paid ${payout.amount} gold (balance: ${oldBalance} → ${newBalance})`)
            totalPaid += payout.amount
          }
        }
      }
      
      totalProcessed++
    }
    
    console.log('\n=== FINAL SUMMARY ===')
    console.log(`Processed ${totalProcessed} tournament days`)
    console.log(`Total gold paid out: ${totalPaid} gold bars`)
    
    // Verify final state
    const finalPayouts = await db.collection('transactions')
      .where('type', 'in', ['payout', 'refund'])
      .get()
    
    console.log(`Total payout transactions: ${finalPayouts.size}`)
    
  } catch (error) {
    console.error('Error:', error)
  }
  
  process.exit(0)
}

processProperPayouts()