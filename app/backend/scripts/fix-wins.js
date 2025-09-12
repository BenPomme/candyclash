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

async function fixWins() {
  console.log('=== FIXING WIN COUNTS FOR ALL PLAYERS ===\n')
  
  try {
    // Get all payout transactions to identify winners
    const payoutSnapshot = await db.collection('transactions')
      .where('type', 'in', ['payout', 'refund'])
      .get()
    
    console.log(`Found ${payoutSnapshot.size} payout/refund transactions\n`)
    
    // Count wins per user (top 3 = win)
    const winsByUser = {}
    const payoutsByUser = {}
    
    payoutSnapshot.forEach(doc => {
      const data = doc.data()
      const userId = data.user_id
      const position = data.meta?.position
      
      if (!userId) return
      
      // Initialize user stats
      if (!winsByUser[userId]) {
        winsByUser[userId] = 0
        payoutsByUser[userId] = []
      }
      
      // Count as win if they finished in top 3 and it wasn't a refund
      if (data.type === 'payout' && position && position <= 3) {
        winsByUser[userId]++
        payoutsByUser[userId].push({
          position,
          amount: data.amount,
          date: data.created_at?.toDate ? data.created_at.toDate() : data.created_at
        })
      }
    })
    
    console.log(`Found ${Object.keys(winsByUser).length} players with payouts\n`)
    
    // Get all users to update their win counts
    const usersSnapshot = await db.collection('users').get()
    const userMap = {}
    
    usersSnapshot.forEach(doc => {
      const data = doc.data()
      userMap[doc.id] = {
        email: data.email,
        displayName: data.display_name || 'Unknown'
      }
    })
    
    // Get current global stats to update
    const globalStatsSnapshot = await db.collection('globalStats').get()
    
    console.log('=== UPDATING WIN COUNTS ===\n')
    
    // Process each user with stats
    for (const doc of globalStatsSnapshot.docs) {
      const userId = doc.id
      const currentStats = doc.data()
      const wins = winsByUser[userId] || 0
      const user = userMap[userId]
      
      if (!user) continue
      
      // Calculate win rate
      const gamesPlayed = currentStats.gamesPlayed || 0
      const winRate = gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : '0.0'
      
      console.log(`User: ${user.displayName} (${user.email})`)
      console.log(`  Current wins: ${currentStats.wins || 0} → New wins: ${wins}`)
      console.log(`  Games played: ${gamesPlayed}`)
      console.log(`  Win rate: ${winRate}%`)
      
      if (wins > 0 && payoutsByUser[userId]) {
        console.log(`  Win history:`)
        payoutsByUser[userId].forEach(p => {
          const dateStr = p.date ? new Date(p.date).toLocaleDateString() : 'Unknown'
          console.log(`    - Position ${p.position}: ${p.amount} gold (${dateStr})`)
        })
      }
      console.log()
      
      // Update Firestore globalStats
      await db.collection('globalStats').doc(userId).update({
        wins: wins,
        winRate: parseFloat(winRate),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      })
      
      // Update Realtime Database
      await rtdb.ref(`globalLeaderboard/${userId}`).update({
        wins: wins,
        winRate: parseFloat(winRate),
        lastUpdated: Date.now()
      })
    }
    
    // Summary statistics
    console.log('\n=== SUMMARY ===')
    
    const totalWins = Object.values(winsByUser).reduce((sum, wins) => sum + wins, 0)
    const playersWithWins = Object.values(winsByUser).filter(wins => wins > 0).length
    
    console.log(`Total wins recorded: ${totalWins}`)
    console.log(`Players with at least 1 win: ${playersWithWins}`)
    
    // Show top winners
    console.log('\n=== TOP WINNERS ===')
    const sortedWinners = Object.entries(winsByUser)
      .filter(([_, wins]) => wins > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    
    sortedWinners.forEach(([userId, wins], index) => {
      const user = userMap[userId]
      if (user) {
        console.log(`${index + 1}. ${user.displayName}: ${wins} wins`)
      }
    })
    
    console.log('\n✅ Win counts have been fixed!')
    
  } catch (error) {
    console.error('Error fixing wins:', error)
  }
  
  process.exit(0)
}

fixWins()