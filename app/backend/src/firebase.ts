import * as admin from 'firebase-admin'
import dotenv from 'dotenv'

dotenv.config()

// Initialize Firebase Admin
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'candyclash-85fd4'
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    // Production: use service account key
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    })
  } else {
    // Development: use default credentials
    admin.initializeApp({
      projectId,
    })
  }
}

export const firestore = admin.firestore()
export const realtimeDb = admin.database()
export const auth = admin.auth()

// Collection references
export const collections = {
  users: firestore.collection('users'),
  levels: firestore.collection('levels'),
  challenges: firestore.collection('challenges'),
  attempts: firestore.collection('attempts'),
  transactions: firestore.collection('transactions'),
  boosters: firestore.collection('boosters'),
}

// Helper functions for Firestore
export async function getUser(userId: string) {
  const doc = await collections.users.doc(userId).get()
  return doc.exists ? { id: doc.id, ...doc.data() } : null
}

export async function getUserByEmail(email: string) {
  const snapshot = await collections.users.where('email', '==', email).limit(1).get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { id: doc.id, ...doc.data() }
}

export async function createUser(data: {
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

export async function updateUserBalance(userId: string, newBalance: number) {
  await collections.users.doc(userId).update({
    gold_balance: newBalance,
  })
}

// Leaderboard functions using Realtime Database
export async function addToLeaderboard(
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

export async function getLeaderboard(challengeId: string, limit = 50) {
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

export async function updatePot(challengeId: string, amount: number) {
  const date = new Date().toISOString().split('T')[0]
  const potRef = realtimeDb.ref(`pots/${challengeId}/${date}`)
  
  await potRef.transaction((currentValue) => {
    return (currentValue || 0) + amount
  })
}

export async function getPot(challengeId: string) {
  const date = new Date().toISOString().split('T')[0]
  const potRef = realtimeDb.ref(`pots/${challengeId}/${date}`)
  
  const snapshot = await potRef.once('value')
  return snapshot.val() || 0
}