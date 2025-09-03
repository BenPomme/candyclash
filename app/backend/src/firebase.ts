const dotenv = require('dotenv')
dotenv.config()

// Use mock Firebase for local development without credentials
const USE_MOCK = process.env.NODE_ENV === 'development' && process.env.USE_FIREBASE_MOCK === 'true'

let firestore: any
let realtimeDb: any
let auth: any
let admin: any

if (USE_MOCK) {
  console.log('⚠️  Using mock Firebase services for local development')
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
} else {
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
    await leaderboardRef.child(attemptId).set({
      userId,
      timeMs,
      displayName: finalDisplayName,
      completedAt: USE_MOCK ? Date.now() : admin.database.ServerValue.TIMESTAMP,
    })
    console.log('Successfully added to leaderboard')
    
    // Verify the entry was added
    const verification = await leaderboardRef.child(attemptId).once('value')
    if (verification.exists()) {
      console.log('Verified entry exists in leaderboard:', verification.val())
    } else {
      console.error('ERROR: Entry not found after adding to leaderboard')
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
  getPot
}
export {}
