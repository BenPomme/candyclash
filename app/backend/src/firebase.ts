const dotenv = require('dotenv')
dotenv.config()

// Use mock Firebase for local development without credentials
let USE_MOCK = process.env.NODE_ENV === 'development' && process.env.USE_FIREBASE_MOCK === 'true'

let firestore: any
let realtimeDb: any
let auth: any
let admin: any

if (USE_MOCK) {
  console.log('⚠️  Using mock Firebase services for local development')
  try {
    const mock = require('./firebase-mock')
    firestore = mock.firestore
    realtimeDb = mock.realtimeDb
    auth = mock.auth
    admin = {
      firestore: {
        FieldValue: {
          serverTimestamp: () => new Date(),
        },
      },
      database: {
        ServerValue: {
          TIMESTAMP: Date.now(),
        },
      },
    }
  } catch (error) {
    console.error('Failed to load mock Firebase, using real Firebase instead')
    USE_MOCK = false
  }
}

if (!USE_MOCK) {
  admin = require('firebase-admin')
  
  // Initialize Firebase Admin
  if (!admin.apps.length) {
    const projectId = 'candyclash-85fd4'
    const databaseURL = 'https://candyclash-85fd4-default-rtdb.europe-west1.firebasedatabase.app'
    
    // In Cloud Functions, use application default credentials
    admin.initializeApp({
      projectId,
      databaseURL,
    })
  }
  
  firestore = admin.firestore()
  realtimeDb = admin.database()
  auth = admin.auth()
}

// Collection references
const collections = {
  users: firestore.collection('users'),
  levels: firestore.collection('levels'),
  challenges: firestore.collection('challenges'),
  attempts: firestore.collection('attempts'),
  transactions: firestore.collection('transactions'),
  boosters: firestore.collection('boosters'),
  feedback: firestore.collection('feedback'),
  globalStats: firestore.collection('globalStats'),
}

// Helper functions for Firestore
async function getUser(userId: string) {
  const doc = await collections.users.doc(userId).get()
  return doc.exists ? { id: doc.id, ...doc.data() } : null
}

async function getUserByEmail(email: string) {
  const snapshot = await collections.users.where('email', '==', email).limit(1).get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { id: doc.id, ...doc.data() }
}

async function createUser(data: {
  email: string
  display_name: string
  gold_balance: number
  is_admin: boolean
}) {
  const userRef = collections.users.doc()
  await userRef.set({
    ...data,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  })
  return { id: userRef.id, ...data }
}

async function updateUserBalance(userId: string, newBalance: number) {
  await collections.users.doc(userId).update({
    gold_balance: newBalance,
  })
}

// Leaderboard functions using Realtime Database
async function addToLeaderboard(
  challengeId: string,
  attemptId: string,
  userId: string,
  timeMs: number,
  displayName: string,
) {
  // Use UTC date to ensure consistency across timezones
  const date = new Date().toISOString().split('T')[0]
  const leaderboardRef = realtimeDb.ref(`leaderboards/${challengeId}/${date}`)
  
  // Ensure displayName is never empty
  const finalDisplayName = displayName && displayName.trim() ? displayName : 'Anonymous'
  
  console.log('Adding to leaderboard:', { 
    challengeId, 
    date, 
    attemptId, 
    userId, 
    displayName: finalDisplayName, 
    timeMs 
  })
  
  try {
    // First, check if this user already has an entry in today's leaderboard
    const existingSnapshot = await leaderboardRef
      .orderByChild('userId')
      .equalTo(userId)
      .once('value')
    
    let shouldAdd = true
    let existingAttemptId: string | null = null
    let existingTimeMs: number | null = null
    
    if (existingSnapshot.exists()) {
      // User already has an entry, check if new score is better
      existingSnapshot.forEach((child) => {
        existingAttemptId = child.key
        existingTimeMs = child.val().timeMs
        
        console.log('Found existing entry for user:', {
          existingAttemptId,
          existingTimeMs,
          newTimeMs: timeMs
        })
        
        // Only keep the best score (lowest time)
        if (timeMs >= existingTimeMs) {
          shouldAdd = false
          console.log('New score is not better than existing, skipping')
        }
      })
      
      // If new score is better, remove the old entry
      if (shouldAdd && existingAttemptId) {
        console.log('Removing old entry:', existingAttemptId)
        await leaderboardRef.child(existingAttemptId).remove()
      }
    }
    
    if (shouldAdd) {
      await leaderboardRef.child(attemptId).set({
        userId,
        timeMs,
        displayName: finalDisplayName,
        completedAt: USE_MOCK ? Date.now() : admin.database.ServerValue.TIMESTAMP,
      })
      console.log('Successfully added/updated leaderboard entry')
      
      // Verify the entry was added
      const verification = await leaderboardRef.child(attemptId).once('value')
      if (verification.exists()) {
        console.log('Verified entry exists in leaderboard:', verification.val())
      } else {
        console.error('ERROR: Entry not found after adding to leaderboard')
      }
    }
  } catch (error) {
    console.error('Failed to add to leaderboard:', error)
    throw error
  }
}

async function getLeaderboard(challengeId: string, limit = 50) {
  // Use UTC date to ensure consistency across timezones
  const date = new Date().toISOString().split('T')[0]
  const leaderboardRef = realtimeDb.ref(`leaderboards/${challengeId}/${date}`)
  
  console.log('Fetching leaderboard for:', { challengeId, date, limit })
  
  const snapshot = await leaderboardRef
    .orderByChild('timeMs')
    .limitToFirst(limit)
    .once('value')
  
  const entries: any[] = []
  snapshot.forEach((child) => {
    const entry = {
      attemptId: child.key,
      ...child.val(),
    }
    // Ensure displayName is always present
    if (!entry.displayName) {
      entry.displayName = 'Anonymous'
    }
    entries.push(entry)
  })
  
  console.log(`Found ${entries.length} leaderboard entries`)
  
  return entries
}

async function updatePot(challengeId: string, amount: number) {
  const date = new Date().toISOString().split('T')[0]
  const potRef = realtimeDb.ref(`pots/${challengeId}/${date}`)
  
  await potRef.transaction((currentValue) => {
    return (currentValue || 0) + amount
  })
}

async function getPot(challengeId: string) {
  // Use UTC date to ensure consistency across timezones
  const date = new Date().toISOString().split('T')[0]
  const potRef = realtimeDb.ref(`pots/${challengeId}/${date}`)
  
  console.log('Fetching pot for:', { challengeId, date })
  
  const snapshot = await potRef.once('value')
  const potValue = snapshot.val() || 0
  console.log('Pot value:', potValue)
  
  return potValue
}

// Global leaderboard functions
async function updateGlobalStats(userId: string, goldChange: number, displayName?: string) {
  const globalStatsRef = collections.globalStats.doc(userId)
  
  try {
    const doc = await globalStatsRef.get()
    
    if (doc.exists) {
      // Update existing stats
      const currentData = doc.data()
      await globalStatsRef.update({
        totalGoldGained: (currentData.totalGoldGained || 0) + (goldChange > 0 ? goldChange : 0),
        totalGoldLost: (currentData.totalGoldLost || 0) + (goldChange < 0 ? Math.abs(goldChange) : 0),
        netGoldChange: (currentData.netGoldChange || 0) + goldChange,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        displayName: displayName || currentData.displayName || 'Anonymous',
      })
    } else {
      // Create new stats entry
      await globalStatsRef.set({
        userId,
        displayName: displayName || 'Anonymous',
        totalGoldGained: goldChange > 0 ? goldChange : 0,
        totalGoldLost: goldChange < 0 ? Math.abs(goldChange) : 0,
        netGoldChange: goldChange,
        gamesPlayed: 0,
        wins: 0,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }
    
    // Also update the realtime database for fast leaderboard access
    const globalLeaderboardRef = realtimeDb.ref(`globalLeaderboard/${userId}`)
    const currentSnapshot = await globalLeaderboardRef.once('value')
    const currentNetGold = currentSnapshot.exists() ? currentSnapshot.val().netGoldChange : 0
    
    await globalLeaderboardRef.set({
      userId,
      displayName: displayName || 'Anonymous',
      netGoldChange: currentNetGold + goldChange,
      updatedAt: USE_MOCK ? Date.now() : admin.database.ServerValue.TIMESTAMP,
    })
  } catch (error) {
    console.error('Failed to update global stats:', error)
    // Don't throw - we don't want to fail transactions because of stats
  }
}

async function incrementGamesPlayed(userId: string, won: boolean = false) {
  const globalStatsRef = collections.globalStats.doc(userId)
  
  try {
    const doc = await globalStatsRef.get()
    
    if (doc.exists) {
      const updates: any = {
        gamesPlayed: (doc.data().gamesPlayed || 0) + 1,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }
      if (won) {
        updates.wins = (doc.data().wins || 0) + 1
      }
      await globalStatsRef.update(updates)
    } else {
      // Create new stats entry
      await globalStatsRef.set({
        userId,
        displayName: 'Anonymous',
        totalGoldGained: 0,
        totalGoldLost: 0,
        netGoldChange: 0,
        gamesPlayed: 1,
        wins: won ? 1 : 0,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }
  } catch (error) {
    console.error('Failed to increment games played:', error)
  }
}

async function getGlobalLeaderboard(limit = 100) {
  const globalLeaderboardRef = realtimeDb.ref('globalLeaderboard')
  
  const snapshot = await globalLeaderboardRef
    .orderByChild('netGoldChange')
    .limitToLast(limit) // Use limitToLast since we want highest values
    .once('value')
  
  const entries: any[] = []
  snapshot.forEach((child) => {
    entries.push({
      userId: child.key,
      ...child.val(),
    })
  })
  
  // Sort in descending order (highest net gold first)
  entries.sort((a, b) => b.netGoldChange - a.netGoldChange)
  
  return entries
}

async function getGlobalStats(userId: string) {
  const doc = await collections.globalStats.doc(userId).get()
  return doc.exists ? { id: doc.id, ...doc.data() } : null
}

module.exports = {
  firestore,
  realtimeDb,
  auth,
  collections,
  getUser,
  getUserByEmail,
  createUser,
  updateUserBalance,
  addToLeaderboard,
  getLeaderboard,
  updatePot,
  getPot,
  updateGlobalStats,
  incrementGamesPlayed,
  getGlobalLeaderboard,
  getGlobalStats
}
export {}
