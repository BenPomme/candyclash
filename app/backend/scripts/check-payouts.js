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

async function checkPayouts() {
  console.log('=== CHECKING ALL PAYOUTS ===\n')
  
  try {
    // Get ALL transactions (not limited)
    const transactionsSnapshot = await db.collection('transactions')
      .orderBy('created_at', 'desc')
      .get()
    
    console.log(`Total transactions found: ${transactionsSnapshot.size}\n`)
    
    const payouts = []
    const entryFees = []
    const seeds = []
    
    transactionsSnapshot.forEach(doc => {
      const data = doc.data()
      
      if (data.type === 'payout') {
        payouts.push(data)
      } else if (data.type === 'entry_fee') {
        entryFees.push(data)
      } else if (data.type === 'seed') {
        seeds.push(data)
      }
    })
    
    console.log('Transaction breakdown:')
    console.log(`  Seeds: ${seeds.length} (${seeds.reduce((sum, s) => sum + s.amount, 0)} gold bars)`)
    console.log(`  Entry fees: ${entryFees.length} (${Math.abs(entryFees.reduce((sum, e) => sum + e.amount, 0))} gold bars collected)`)
    console.log(`  Payouts: ${payouts.length} (${payouts.reduce((sum, p) => sum + p.amount, 0)} gold bars paid)\n`)
    
    if (payouts.length > 0) {
      console.log('=== ALL PAYOUTS ===')
      payouts.forEach(p => {
        console.log(`  User: ${p.user_id}`)
        console.log(`  Amount: ${p.amount} gold bars`)
        console.log(`  Challenge: ${p.challenge_id}`)
        console.log(`  Date: ${p.created_at?.toDate ? p.created_at.toDate() : p.created_at}`)
        if (p.meta) {
          console.log(`  Meta: ${JSON.stringify(p.meta)}`)
        }
        console.log()
      })
    }
    
    // Now check attempts by day to see who should have been paid
    console.log('\n=== CHECKING VALID ATTEMPTS BY DAY ===')
    
    const attemptsSnapshot = await db.collection('attempts')
      .where('valid', '==', true)
      .orderBy('started_at', 'asc')
      .get()
    
    console.log(`Total valid attempts: ${attemptsSnapshot.size}\n`)
    
    // Group attempts by day
    const attemptsByDay = {}
    
    attemptsSnapshot.forEach(doc => {
      const data = doc.data()
      const startedAt = data.started_at?.toDate ? data.started_at.toDate() : new Date(data.started_at)
      const dateKey = startedAt.toISOString().split('T')[0] // YYYY-MM-DD
      
      if (!attemptsByDay[dateKey]) {
        attemptsByDay[dateKey] = []
      }
      
      attemptsByDay[dateKey].push({
        id: doc.id,
        user_id: data.user_id,
        time_ms: data.time_ms,
        started_at: startedAt
      })
    })
    
    // Sort each day's attempts by time_ms to find winners
    Object.keys(attemptsByDay).sort().forEach(date => {
      const attempts = attemptsByDay[date]
      attempts.sort((a, b) => a.time_ms - b.time_ms)
      
      console.log(`\nDate: ${date}`)
      console.log(`  Players: ${attempts.length}`)
      console.log(`  Entry fees collected: ${attempts.length * 10} gold bars (assuming 10 per entry)`)
      
      if (attempts.length >= 3) {
        console.log('  Top 3 (should have been paid):')
        console.log(`    1st: User ${attempts[0].user_id.substring(0, 8)}... (${attempts[0].time_ms}ms) - Should get 40% of pot`)
        console.log(`    2nd: User ${attempts[1].user_id.substring(0, 8)}... (${attempts[1].time_ms}ms) - Should get 25% of pot`)
        console.log(`    3rd: User ${attempts[2].user_id.substring(0, 8)}... (${attempts[2].time_ms}ms) - Should get 15% of pot`)
      } else if (attempts.length > 0) {
        console.log('  Winners:')
        attempts.forEach((a, i) => {
          console.log(`    ${i + 1}. User ${a.user_id.substring(0, 8)}... (${a.time_ms}ms)`)
        })
      }
      
      // Check if payouts were made for this day
      const dayStart = new Date(date)
      const dayEnd = new Date(date)
      dayEnd.setDate(dayEnd.getDate() + 1)
      
      const dayPayouts = payouts.filter(p => {
        const payoutDate = p.created_at?.toDate ? p.created_at.toDate() : new Date(p.created_at)
        return payoutDate >= dayStart && payoutDate < dayEnd
      })
      
      if (dayPayouts.length > 0) {
        console.log(`  ✅ Payouts made: ${dayPayouts.length} transactions totaling ${dayPayouts.reduce((sum, p) => sum + p.amount, 0)} gold bars`)
      } else {
        console.log(`  ❌ NO PAYOUTS MADE FOR THIS DAY!`)
      }
    })
    
    console.log('\n=== SUMMARY ===')
    const totalEntryFees = Math.abs(entryFees.reduce((sum, e) => sum + e.amount, 0))
    const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0)
    const unpaidAmount = totalEntryFees - totalPayouts
    
    console.log(`Total entry fees collected: ${totalEntryFees} gold bars`)
    console.log(`Total payouts made: ${totalPayouts} gold bars`)
    console.log(`Unpaid amount (should be in pot): ${unpaidAmount} gold bars`)
    
    if (unpaidAmount > 0) {
      console.log(`\n⚠️  WARNING: ${unpaidAmount} gold bars have been collected but not paid out!`)
      console.log('This suggests the automatic closure system is not working properly.')
    }
    
  } catch (error) {
    console.error('Error checking payouts:', error)
  }
  
  process.exit(0)
}

checkPayouts()