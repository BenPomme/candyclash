const dotenv = require('dotenv')
dotenv.config()

// Use mock Firebase for local development without credentials
const USE_MOCK = process.env.USE_FIREBASE_MOCK === 'true' || (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && process.env.NODE_ENV === 'development')

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
    const projectId = process.env.FIREBASE_PROJECT_ID || 'candyclash-85fd4'
    const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://candyclash-85fd4-default-rtdb.firebaseio.com'
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // Production: use service account key
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
        databaseURL,
      })
    } else {
      // Default: use application default credentials
      admin.initializeApp({
        projectId,
        databaseURL,
      })
    }
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
  const date = new Date().toISOString().split('T')[0]
  const leaderboardRef = realtimeDb.ref(`leaderboards/${challengeId}/${date}`)
  
  await leaderboardRef.child(attemptId).set({
    userId,
    timeMs,
    displayName,
    completedAt: admin.database.ServerValue.TIMESTAMP,
  })
}

async function getLeaderboard(challengeId: string, limit = 50) {
  const date = new Date().toISOString().split('T')[0]
  const leaderboardRef = realtimeDb.ref(`leaderboards/${challengeId}/${date}`)
  
  const snapshot = await leaderboardRef
    .orderByChild('timeMs')
    .limitToFirst(limit)
    .once('value')
  
  const entries: any[] = []
  snapshot.forEach((child) => {
    entries.push({
      attemptId: child.key,
      ...child.val(),
    })
  })
  
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
  const date = new Date().toISOString().split('T')[0]
  const potRef = realtimeDb.ref(`pots/${challengeId}/${date}`)
  
  const snapshot = await potRef.once('value')
  return snapshot.val() || 0
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
