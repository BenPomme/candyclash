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

async function syncWinsToRTDB() {
  console.log('=== SYNCING WINS TO REALTIME DATABASE ===\n')
  
  try {
    // Get all global stats from Firestore
    const globalStatsSnapshot = await db.collection('globalStats').get()
    
    console.log(`Found ${globalStatsSnapshot.size} users with stats\n`)
    
    let updatedCount = 0
    
    for (const doc of globalStatsSnapshot.docs) {
      const userId = doc.id
      const stats = doc.data()
      
      // Calculate win rate
      const gamesPlayed = stats.gamesPlayed || 0
      const wins = stats.wins || 0
      const winRate = gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : '0.0'
      
      // Update Realtime Database
      await rtdb.ref(`globalLeaderboard/${userId}`).update({
        wins: wins,
        winRate: parseFloat(winRate),
        gamesPlayed: gamesPlayed,
        lastUpdated: Date.now()
      })
      
      updatedCount++
      
      if (wins > 0) {
        console.log(`Updated ${stats.displayName}: ${wins} wins, ${winRate}% win rate (${gamesPlayed} games)`)
      }
    }
    
    console.log(`\n✅ Synced ${updatedCount} users to Realtime Database`)
    
  } catch (error) {
    console.error('Error syncing wins:', error)
  }
  
  process.exit(0)
}

syncWinsToRTDB()