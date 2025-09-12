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

async function fixGlobalStats() {
  console.log('=== FIXING GLOBAL STATS - ACCURATE GAMES PLAYED COUNT ===\n')
  
  try {
    // First, get all users to map userId to email and display name
    const usersSnapshot = await db.collection('users').get()
    const userMap = {}
    
    console.log(`Total users in database: ${usersSnapshot.size}\n`)
    
    usersSnapshot.forEach(doc => {
      const data = doc.data()
      userMap[doc.id] = {
        email: data.email,
        displayName: data.display_name || data.email?.split('@')[0] || 'Unknown',
        goldBalance: data.gold_balance || 0
      }
    })
    
    // Get ALL attempts to count games played per user
    const attemptsSnapshot = await db.collection('attempts').get()
    console.log(`Total attempts in database: ${attemptsSnapshot.size}`)
    
    // Count games by userId
    const gamesByUser = {}
    const validGamesByUser = {}
    
    attemptsSnapshot.forEach(doc => {
      const data = doc.data()
      const userId = data.user_id
      
      if (!gamesByUser[userId]) {
        gamesByUser[userId] = 0
        validGamesByUser[userId] = 0
      }
      
      gamesByUser[userId]++
      
      if (data.valid === true) {
        validGamesByUser[userId]++
      }
    })
    
    console.log(`Users who have played: ${Object.keys(gamesByUser).length}\n`)
    
    // Get all transactions to calculate gold changes
    const transactionsSnapshot = await db.collection('transactions').get()
    console.log(`Total transactions: ${transactionsSnapshot.size}\n`)
    
    // Calculate net gold change per user
    const goldStatsByUser = {}
    
    transactionsSnapshot.forEach(doc => {
      const data = doc.data()
      const userId = data.user_id
      
      if (!userId) return
      
      if (!goldStatsByUser[userId]) {
        goldStatsByUser[userId] = {
          totalGained: 0,
          totalLost: 0,
          netChange: 0
        }
      }
      
      const amount = data.amount || 0
      
      if (data.type === 'seed') {
        // Initial balance - don't count as gain
      } else if (data.type === 'entry_fee') {
        // Entry fee is negative
        goldStatsByUser[userId].totalLost += Math.abs(amount)
        goldStatsByUser[userId].netChange += amount // amount is negative
      } else if (data.type === 'payout' || data.type === 'refund') {
        goldStatsByUser[userId].totalGained += amount
        goldStatsByUser[userId].netChange += amount
      }
    })
    
    // Now update the global stats with correct data
    console.log('=== UPDATING GLOBAL STATS ===\n')
    
    // Clear existing incorrect data
    const globalStatsSnapshot = await db.collection('globalStats').get()
    console.log(`Existing globalStats entries: ${globalStatsSnapshot.size}`)
    
    // Process each user who has played
    for (const userId of Object.keys(gamesByUser)) {
      const user = userMap[userId]
      if (!user) {
        console.log(`Warning: User ${userId} not found in users collection`)
        continue
      }
      
      const gamesPlayed = gamesByUser[userId] || 0
      const validGames = validGamesByUser[userId] || 0
      const goldStats = goldStatsByUser[userId] || { totalGained: 0, totalLost: 0, netChange: 0 }
      
      console.log(`\nUser: ${user.email}`)
      console.log(`  Display Name: ${user.displayName}`)
      console.log(`  Games Played: ${gamesPlayed} (${validGames} completed)`)
      console.log(`  Gold Won: ${goldStats.totalGained}`)
      console.log(`  Gold Lost: ${goldStats.totalLost}`)
      console.log(`  Net Change: ${goldStats.netChange}`)
      
      // Update Firestore globalStats
      await db.collection('globalStats').doc(userId).set({
        userId: userId,
        email: user.email,
        displayName: user.displayName,
        gamesPlayed: gamesPlayed,
        gamesCompleted: validGames,
        totalGoldGained: goldStats.totalGained,
        totalGoldLost: goldStats.totalLost,
        netGoldChange: goldStats.netChange,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
      
      // Update Realtime Database for fast access
      await rtdb.ref(`globalLeaderboard/${userId}`).set({
        email: user.email,
        displayName: user.displayName,
        gamesPlayed: gamesPlayed,
        gamesCompleted: validGames,
        totalGoldGained: goldStats.totalGained,
        totalGoldLost: goldStats.totalLost,
        netGoldChange: goldStats.netChange,
        lastUpdated: Date.now()
      })
    }
    
    // Calculate and display summary stats
    console.log('\n=== SUMMARY STATISTICS ===')
    
    const totalGamesPlayed = Object.values(gamesByUser).reduce((sum, count) => sum + count, 0)
    const totalValidGames = Object.values(validGamesByUser).reduce((sum, count) => sum + count, 0)
    const totalPlayers = Object.keys(gamesByUser).length
    const avgGamesPerPlayer = (totalGamesPlayed / totalPlayers).toFixed(1)
    
    console.log(`Total Players: ${totalPlayers}`)
    console.log(`Total Games Started: ${totalGamesPlayed}`)
    console.log(`Total Games Completed: ${totalValidGames}`)
    console.log(`Average Games per Player: ${avgGamesPerPlayer}`)
    
    // Show top players by games played
    console.log('\n=== TOP PLAYERS BY GAMES PLAYED ===')
    const sortedByGames = Object.entries(gamesByUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    
    sortedByGames.forEach(([userId, count], index) => {
      const user = userMap[userId]
      console.log(`${index + 1}. ${user?.displayName || 'Unknown'} (${user?.email || 'N/A'}): ${count} games`)
    })
    
    // Show top players by net gold
    console.log('\n=== TOP PLAYERS BY NET GOLD ===')
    const sortedByGold = Object.entries(goldStatsByUser)
      .sort((a, b) => b[1].netChange - a[1].netChange)
      .slice(0, 10)
    
    sortedByGold.forEach(([userId, stats], index) => {
      const user = userMap[userId]
      const games = gamesByUser[userId] || 0
      console.log(`${index + 1}. ${user?.displayName || 'Unknown'}: +${stats.netChange} gold (${games} games)`)
    })
    
    console.log('\n✅ Global stats have been fixed!')
    
  } catch (error) {
    console.error('Error fixing global stats:', error)
  }
  
  process.exit(0)
}

fixGlobalStats()