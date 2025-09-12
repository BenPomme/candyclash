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

async function checkPrizeConfigs() {
  console.log('=== CHECKING ACTUAL PRIZE DISTRIBUTION CONFIGS ===\n')
  
  try {
    // Get the current challenge to see its structure
    const challengesSnapshot = await db.collection('challenges').get()
    
    console.log(`Total challenges in database: ${challengesSnapshot.size}\n`)
    
    challengesSnapshot.forEach(doc => {
      const challenge = doc.data()
      console.log(`Challenge: ${doc.id}`)
      console.log(`  Name: ${challenge.name}`)
      console.log(`  Status: ${challenge.status}`)
      console.log(`  Entry Fee: ${challenge.entry_fee}`)
      console.log(`  Attempts Per Day: ${challenge.attempts_per_day}`)
      
      // Check prize distribution
      if (challenge.prize_distribution) {
        console.log(`  Prize Distribution:`)
        console.log(`    Type: ${challenge.prize_distribution.type || 'percentage'}`)
        
        if (challenge.prize_distribution.rules && Array.isArray(challenge.prize_distribution.rules)) {
          console.log(`    Rules (${challenge.prize_distribution.rules.length} positions):`)
          challenge.prize_distribution.rules.forEach(rule => {
            if (rule.percentage !== undefined) {
              console.log(`      Position ${rule.position}: ${rule.percentage}%`)
            } else if (rule.fixed !== undefined) {
              console.log(`      Position ${rule.position}: ${rule.fixed} gold (fixed)`)
            }
          })
        } else {
          // Old format
          console.log(`    Old format:`, JSON.stringify(challenge.prize_distribution))
        }
        
        if (challenge.prize_distribution.rake !== undefined) {
          console.log(`    Rake: ${challenge.prize_distribution.rake}%`)
        }
        if (challenge.prize_distribution.minPlayersRequired !== undefined) {
          console.log(`    Min Players Required: ${challenge.prize_distribution.minPlayersRequired}`)
        }
      } else {
        console.log(`  Prize Distribution: NOT SET (would use default 40/25/15)`)
      }
      
      // Check if it has winners recorded
      if (challenge.winners) {
        console.log(`  Winners Recorded: ${challenge.winners.length}`)
        challenge.winners.forEach(w => {
          console.log(`    - Position ${w.position}: ${w.userId?.substring(0, 8)}... got ${w.prize} gold`)
        })
      }
      
      // Check dates
      if (challenge.starts_at) {
        const startsAt = challenge.starts_at?.toDate ? challenge.starts_at.toDate() : new Date(challenge.starts_at)
        console.log(`  Starts: ${startsAt.toISOString()}`)
      }
      if (challenge.ends_at) {
        const endsAt = challenge.ends_at?.toDate ? challenge.ends_at.toDate() : new Date(challenge.ends_at)
        console.log(`  Ends: ${endsAt.toISOString()}`)
      }
      
      console.log()
    })
    
    // Now let's see how many different prize structures have been used
    console.log('\n=== ANALYZING LEADERBOARD DATA ===')
    
    // Check realtime database for leaderboard entries
    const rtdb = admin.database()
    const leaderboardSnapshot = await rtdb.ref('leaderboard').once('value')
    const leaderboards = leaderboardSnapshot.val() || {}
    
    Object.keys(leaderboards).forEach(challengeId => {
      const lb = leaderboards[challengeId]
      console.log(`\nLeaderboard ${challengeId}:`)
      console.log(`  Pot: ${lb.pot || 0} gold bars`)
      console.log(`  Total Entries: ${lb.entries ? lb.entries.length : 0}`)
      
      if (lb.entries && lb.entries.length > 0) {
        console.log(`  Top 10 players:`)
        lb.entries.slice(0, 10).forEach((entry, i) => {
          console.log(`    ${i + 1}. ${entry.display_name || entry.user_id?.substring(0, 8)} - ${entry.time_ms}ms`)
        })
      }
    })
    
    // Check how payouts have been done historically
    console.log('\n=== HISTORICAL PAYOUT ANALYSIS ===')
    
    const payoutsSnapshot = await db.collection('transactions')
      .where('type', '==', 'payout')
      .orderBy('created_at', 'desc')
      .limit(20)
      .get()
    
    const payoutsByPosition = {}
    payoutsSnapshot.forEach(doc => {
      const data = doc.data()
      const position = data.meta?.position || 'unknown'
      if (!payoutsByPosition[position]) {
        payoutsByPosition[position] = []
      }
      payoutsByPosition[position].push(data.amount)
    })
    
    console.log('Payout amounts by position:')
    Object.keys(payoutsByPosition).sort().forEach(pos => {
      const amounts = payoutsByPosition[pos]
      const unique = [...new Set(amounts)].sort((a, b) => a - b)
      console.log(`  Position ${pos}: ${unique.join(', ')} gold bars (${amounts.length} payouts)`)
    })
    
  } catch (error) {
    console.error('Error:', error)
  }
  
  process.exit(0)
}

checkPrizeConfigs()