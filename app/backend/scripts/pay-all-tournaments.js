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

async function payAllTournaments() {
  console.log('=== PAYING OUT ALL TOURNAMENTS ===\n')
  
  try {
    // Get ALL attempts (not just valid ones initially)
    const allAttemptsSnapshot = await db.collection('attempts').get()
    console.log(`Total attempts in database: ${allAttemptsSnapshot.size}`)
    
    // Get only valid attempts
    const validAttempts = []
    allAttemptsSnapshot.forEach(doc => {
      const data = doc.data()
      if (data.valid === true && data.time_ms) {
        validAttempts.push({
          id: doc.id,
          ...data,
          started_at: data.started_at?.toDate ? data.started_at.toDate() : new Date(data.started_at)
        })
      }
    })
    
    console.log(`Valid attempts with times: ${validAttempts.length}\n`)
    
    // Group by date
    const tournamentsByDate = {}
    
    validAttempts.forEach(attempt => {
      const dateKey = attempt.started_at.toISOString().split('T')[0]
      
      if (!tournamentsByDate[dateKey]) {
        tournamentsByDate[dateKey] = {
          attempts: [],
          entryFees: 0
        }
      }
      
      tournamentsByDate[dateKey].attempts.push(attempt)
    })
    
    // Get ALL existing payout transactions
    const payoutTxSnapshot = await db.collection('transactions')
      .where('type', 'in', ['payout', 'refund'])
      .get()
    
    console.log(`Existing payout transactions: ${payoutTxSnapshot.size}`)
    
    // Map payouts by date and user
    const existingPayoutsByDate = {}
    payoutTxSnapshot.forEach(doc => {
      const data = doc.data()
      const date = data.meta?.date || (data.created_at?.toDate ? data.created_at.toDate().toISOString().split('T')[0] : null)
      
      if (date) {
        if (!existingPayoutsByDate[date]) {
          existingPayoutsByDate[date] = new Set()
        }
        existingPayoutsByDate[date].add(data.user_id)
      }
    })
    
    console.log('Existing payouts by date:', Object.keys(existingPayoutsByDate).map(d => `${d}: ${existingPayoutsByDate[d].size} users`))
    console.log()
    
    // Process each tournament day
    const dates = Object.keys(tournamentsByDate).sort()
    const today = new Date().toISOString().split('T')[0]
    
    let totalNewPayouts = 0
    let totalGoldPaidOut = 0
    
    for (const date of dates) {
      if (date === today) {
        console.log(`\n=== ${date} (TODAY - SKIPPING) ===`)
        continue
      }
      
      const tournament = tournamentsByDate[date]
      const attempts = tournament.attempts
      
      console.log(`\n=== ${date} ===`)
      console.log(`Players: ${attempts.length}`)
      
      if (attempts.length < 1) {
        console.log('No players - skipping')
        continue
      }
      
      // Sort by time (fastest first)
      attempts.sort((a, b) => a.time_ms - b.time_ms)
      
      // Determine pot
      // Count actual entry fees for this date
      const entryFeeSnapshot = await db.collection('transactions')
        .where('type', '==', 'entry_fee')
        .get()
      
      let datePot = 0
      entryFeeSnapshot.forEach(doc => {
        const data = doc.data()
        const txDate = data.created_at?.toDate ? data.created_at.toDate().toISOString().split('T')[0] : null
        if (txDate === date) {
          datePot += Math.abs(data.amount)
        }
      })
      
      // If no entry fees found, estimate based on player count
      if (datePot === 0) {
        datePot = attempts.length * 10 // Default 10 gold per entry
        console.log(`No entry fees found, estimating pot: ${datePot} gold bars`)
      } else {
        console.log(`Actual pot from entry fees: ${datePot} gold bars`)
      }
      
      // Check who's been paid
      const alreadyPaid = existingPayoutsByDate[date] || new Set()
      console.log(`Already paid: ${alreadyPaid.size} users`)
      
      // Determine winners (top 3 or all if less than 3)
      const winners = []
      const maxWinners = Math.min(3, attempts.length)
      
      for (let i = 0; i < maxWinners; i++) {
        const attempt = attempts[i]
        winners.push({
          position: i + 1,
          user_id: attempt.user_id,
          attempt_id: attempt.id,
          time_ms: attempt.time_ms
        })
      }
      
      console.log(`Winners:`)
      winners.forEach(w => {
        const paid = alreadyPaid.has(w.user_id) ? '✅' : '❌'
        console.log(`  ${w.position}. ${w.user_id.substring(0, 8)}... (${w.time_ms}ms) ${paid}`)
      })
      
      // Process payouts for unpaid winners
      const unpaidWinners = winners.filter(w => !alreadyPaid.has(w.user_id))
      
      if (unpaidWinners.length === 0) {
        console.log('All winners already paid ✅')
        continue
      }
      
      console.log(`\nProcessing ${unpaidWinners.length} new payouts:`)
      
      for (const winner of unpaidWinners) {
        let payoutAmount = 0
        
        // Calculate payout based on position
        if (attempts.length >= 3) {
          // Normal distribution
          if (winner.position === 1) payoutAmount = Math.floor(datePot * 0.4)
          else if (winner.position === 2) payoutAmount = Math.floor(datePot * 0.25)
          else if (winner.position === 3) payoutAmount = Math.floor(datePot * 0.15)
        } else if (attempts.length === 2) {
          // 2 players: 60/40 split
          if (winner.position === 1) payoutAmount = Math.floor(datePot * 0.6)
          else if (winner.position === 2) payoutAmount = Math.floor(datePot * 0.4)
        } else if (attempts.length === 1) {
          // Single player gets full pot
          payoutAmount = datePot
        }
        
        if (payoutAmount === 0) continue
        
        console.log(`  Paying position ${winner.position}: ${payoutAmount} gold bars to ${winner.user_id.substring(0, 8)}...`)
        
        // Get user and update balance
        const userDoc = await db.collection('users').doc(winner.user_id).get()
        if (!userDoc.exists) {
          console.log(`    ⚠️  User not found`)
          continue
        }
        
        const userData = userDoc.data()
        const oldBalance = userData.gold_balance || 0
        const newBalance = oldBalance + payoutAmount
        
        // Update balance
        await db.collection('users').doc(winner.user_id).update({
          gold_balance: newBalance
        })
        
        // Create payout transaction
        await db.collection('transactions').doc().set({
          user_id: winner.user_id,
          challenge_id: 'daily-challenge',
          type: 'payout',
          amount: payoutAmount,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          meta: {
            position: winner.position,
            attempt_id: winner.attempt_id,
            time_ms: winner.time_ms,
            date: date,
            retroactive: true,
            pot: datePot,
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
            totalGoldGained: (stats.totalGoldGained || 0) + payoutAmount,
            netGoldChange: (stats.netGoldChange || 0) + payoutAmount,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          })
        } else {
          await globalStatsRef.set({
            userId: winner.user_id,
            displayName: userData.display_name || 'Unknown',
            totalGoldGained: payoutAmount,
            totalGoldLost: 0,
            netGoldChange: payoutAmount,
            gamesPlayed: 1,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          })
        }
        
        // Update realtime database
        await rtdb.ref(`globalLeaderboard/${winner.user_id}`).transaction((current) => {
          if (!current) {
            return {
              displayName: userData.display_name || 'Unknown',
              netGoldChange: payoutAmount,
              gamesPlayed: 1,
              lastUpdated: Date.now()
            }
          }
          return {
            ...current,
            netGoldChange: (current.netGoldChange || 0) + payoutAmount,
            lastUpdated: Date.now()
          }
        })
        
        console.log(`    ✅ Paid! (${oldBalance} → ${newBalance})`)
        totalNewPayouts++
        totalGoldPaidOut += payoutAmount
      }
    }
    
    console.log('\n=== SUMMARY ===')
    console.log(`Processed ${dates.length - 1} tournament days (excluding today)`)
    console.log(`New payouts: ${totalNewPayouts}`)
    console.log(`Total gold paid out: ${totalGoldPaidOut} gold bars`)
    
    // Final check
    console.log('\n=== FINAL VERIFICATION ===')
    const finalPayoutCount = await db.collection('transactions')
      .where('type', 'in', ['payout', 'refund'])
      .get()
    console.log(`Total payout transactions now: ${finalPayoutCount.size}`)
    
  } catch (error) {
    console.error('Error:', error)
  }
  
  process.exit(0)
}

payAllTournaments()