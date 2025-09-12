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

async function removeUsers() {
  console.log('=== REMOVING SUSPICIOUS USERS FROM DATABASE ===\n')
  
  const usersToRemove = ['Moumoule', 'meow', 'zuba']
  
  try {
    // First, find the user IDs for these display names
    const usersSnapshot = await db.collection('users').get()
    const userIdsToRemove = []
    const userEmailsToRemove = []
    
    usersSnapshot.forEach(doc => {
      const data = doc.data()
      if (usersToRemove.includes(data.display_name)) {
        userIdsToRemove.push(doc.id)
        userEmailsToRemove.push(data.email)
        console.log(`Found user to remove:`)
        console.log(`  ID: ${doc.id}`)
        console.log(`  Email: ${data.email}`)
        console.log(`  Display Name: ${data.display_name}`)
        console.log(`  Gold Balance: ${data.gold_balance}`)
        console.log()
      }
    })
    
    if (userIdsToRemove.length === 0) {
      console.log('No users found with those display names.')
      process.exit(0)
    }
    
    console.log(`\nFound ${userIdsToRemove.length} users to remove.`)
    console.log('User IDs:', userIdsToRemove)
    console.log('\n=== STARTING REMOVAL PROCESS ===\n')
    
    // Remove from each collection
    for (const userId of userIdsToRemove) {
      console.log(`\nRemoving user ${userId}...`)
      
      // 1. Remove from users collection
      try {
        await db.collection('users').doc(userId).delete()
        console.log('  ✅ Removed from users collection')
      } catch (error) {
        console.log('  ❌ Error removing from users:', error.message)
      }
      
      // 2. Remove from globalStats collection
      try {
        await db.collection('globalStats').doc(userId).delete()
        console.log('  ✅ Removed from globalStats collection')
      } catch (error) {
        console.log('  ❌ Error removing from globalStats:', error.message)
      }
      
      // 3. Remove all attempts by this user
      try {
        const attemptsSnapshot = await db.collection('attempts')
          .where('user_id', '==', userId)
          .get()
        
        const batch = db.batch()
        attemptsSnapshot.forEach(doc => {
          batch.delete(doc.ref)
        })
        await batch.commit()
        console.log(`  ✅ Removed ${attemptsSnapshot.size} attempts`)
      } catch (error) {
        console.log('  ❌ Error removing attempts:', error.message)
      }
      
      // 4. Remove all transactions by this user
      try {
        const transactionsSnapshot = await db.collection('transactions')
          .where('user_id', '==', userId)
          .get()
        
        const batch = db.batch()
        transactionsSnapshot.forEach(doc => {
          batch.delete(doc.ref)
        })
        await batch.commit()
        console.log(`  ✅ Removed ${transactionsSnapshot.size} transactions`)
      } catch (error) {
        console.log('  ❌ Error removing transactions:', error.message)
      }
      
      // 5. Remove all boosters by this user
      try {
        const boostersSnapshot = await db.collection('boosters')
          .where('user_id', '==', userId)
          .get()
        
        if (boostersSnapshot.size > 0) {
          const batch = db.batch()
          boostersSnapshot.forEach(doc => {
            batch.delete(doc.ref)
          })
          await batch.commit()
          console.log(`  ✅ Removed ${boostersSnapshot.size} boosters`)
        }
      } catch (error) {
        console.log('  ❌ Error removing boosters:', error.message)
      }
      
      // 6. Remove from Realtime Database - globalLeaderboard
      try {
        await rtdb.ref(`globalLeaderboard/${userId}`).remove()
        console.log('  ✅ Removed from Realtime Database globalLeaderboard')
      } catch (error) {
        console.log('  ❌ Error removing from Realtime DB globalLeaderboard:', error.message)
      }
      
      // 7. Remove from any leaderboard entries
      try {
        const leaderboardSnapshot = await rtdb.ref('leaderboard').once('value')
        const leaderboards = leaderboardSnapshot.val() || {}
        
        for (const challengeId in leaderboards) {
          const lb = leaderboards[challengeId]
          if (lb.entries && Array.isArray(lb.entries)) {
            const filteredEntries = lb.entries.filter(entry => entry.user_id !== userId)
            if (filteredEntries.length !== lb.entries.length) {
              await rtdb.ref(`leaderboard/${challengeId}/entries`).set(filteredEntries)
              console.log(`  ✅ Removed from leaderboard ${challengeId}`)
            }
          }
        }
      } catch (error) {
        console.log('  ❌ Error removing from leaderboards:', error.message)
      }
    }
    
    console.log('\n=== REMOVAL COMPLETE ===')
    console.log(`Successfully removed ${userIdsToRemove.length} users from the database.`)
    
    // Show updated stats
    console.log('\n=== UPDATED DATABASE STATS ===')
    
    const remainingUsers = await db.collection('users').get()
    console.log(`Remaining users: ${remainingUsers.size}`)
    
    const remainingAttempts = await db.collection('attempts').get()
    console.log(`Remaining attempts: ${remainingAttempts.size}`)
    
    const remainingTransactions = await db.collection('transactions').get()
    console.log(`Remaining transactions: ${remainingTransactions.size}`)
    
    // Show new top 5 in global leaderboard
    console.log('\n=== NEW TOP 5 GLOBAL LEADERBOARD ===')
    const globalLeaderboardSnapshot = await rtdb.ref('globalLeaderboard')
      .orderByChild('netGoldChange')
      .limitToLast(5)
      .once('value')
    
    const topPlayers = []
    globalLeaderboardSnapshot.forEach(child => {
      topPlayers.push({
        userId: child.key,
        ...child.val()
      })
    })
    
    topPlayers.sort((a, b) => b.netGoldChange - a.netGoldChange)
    
    topPlayers.forEach((player, index) => {
      console.log(`${index + 1}. ${player.displayName}: +${player.netGoldChange} gold (${player.gamesPlayed} games)`)
    })
    
  } catch (error) {
    console.error('Error during removal process:', error)
  }
  
  process.exit(0)
}

removeUsers()