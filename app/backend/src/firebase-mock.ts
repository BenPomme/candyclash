// Mock Firebase services for local development without authentication
const mockData: any = {
  users: new Map(),
  challenges: new Map(),
  levels: new Map(),
  attempts: new Map(),
  transactions: new Map(),
  boosters: new Map(),
}

// Initialize with default data synchronously
function initializeDefaultData() {
  // Create default level
  const levelId = 'default-level'
  mockData.levels.set(levelId, {
    name: 'Classic Match-3',
    config: {
      grid: {
        width: 8,
        height: 8,
      },
      objectives: {
        primary: {
          type: 'collect',
          target: 'yellow',
          count: 100,
        },
        timeLimit: 180,
      },
      candies: {
        colors: ['red', 'blue', 'green', 'yellow', 'purple'],
      },
      difficulty: {
        entryFee: 20,
        attemptsPerDay: 2,
        prizeDistribution: {
          '1st': 40,
          '2nd': 25,
          '3rd': 15,
        },
      },
    },
    created_by: 'system',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  })
  
  // Create daily challenge
  const challengeId = 'daily-challenge'
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)
  
  mockData.challenges.set(challengeId, {
    name: 'Daily Clash',
    level_id: levelId,
    entry_fee: 20,
    attempts_per_day: 2,
    starts_at: startOfDay,
    ends_at: endOfDay,
    rake_bps: 0,
  })
  
  console.log('📦 Mock data initialized with default challenge and level')
}

// Initialize immediately
initializeDefaultData()

const mockLeaderboard = new Map()
const mockPots = new Map()

class MockDocumentReference {
  constructor(
    private collection: Map<string, any>,
    private id: string,
  ) {}

  async get() {
    const data = this.collection.get(this.id)
    return {
      exists: !!data,
      id: this.id,
      data: () => data,
    }
  }

  async set(data: any) {
    this.collection.set(this.id, { ...data, id: this.id })
  }

  async update(data: any) {
    const existing = this.collection.get(this.id)
    if (existing) {
      this.collection.set(this.id, { ...existing, ...data })
    }
  }

  async delete() {
    this.collection.delete(this.id)
  }
}

class MockCollection {
  constructor(private data: Map<string, any>) {}

  doc(id?: string) {
    const docId = id || Math.random().toString(36).substring(2)
    return new MockDocumentReference(this.data, docId)
  }

  where(field: string, op: string, value: any) {
    const self = this
    const filters: any[] = [{ field, op, value }]
    
    const queryObj: any = {
      where: (field2: string, op2: string, value2: any) => {
        filters.push({ field: field2, op: op2, value: value2 })
        return queryObj
      },
      limit: (n: number) => queryObj,
      orderBy: (fieldName: string, direction?: string) => queryObj,
      get: async () => {
        const docs: any[] = []
        self.data.forEach((doc, id) => {
          let match = true
          
          for (const filter of filters) {
            const fieldValue = doc[filter.field]
            let filterMatch = false
            
            if (filter.op === '==' && fieldValue === filter.value) filterMatch = true
            if (filter.op === '<=' && fieldValue <= filter.value) filterMatch = true
            if (filter.op === '>=' && fieldValue >= filter.value) filterMatch = true
            if (filter.op === '<' && fieldValue < filter.value) filterMatch = true
            if (filter.op === '>' && fieldValue > filter.value) filterMatch = true
            
            if (!filterMatch) {
              match = false
              break
            }
          }

          if (match) {
            docs.push({
              id,
              data: () => doc,
              exists: true,
            })
          }
        })
        return {
          empty: docs.length === 0,
          size: docs.length,
          docs,
        }
      },
    }
    
    return queryObj
  }

  orderBy(field: string, direction = 'asc') {
    return {
      limit: (n: number) => this.orderBy(field, direction),
      get: async () => {
        const docs: any[] = []
        this.data.forEach((doc, id) => {
          docs.push({
            id,
            data: () => doc,
            exists: true,
          })
        })
        return {
          empty: docs.length === 0,
          size: docs.length,
          docs,
        }
      },
    }
  }
}

const firestore = {
  collection: (name: string) => {
    if (!mockData[name]) {
      mockData[name] = new Map()
    }
    return new MockCollection(mockData[name])
  },
  FieldValue: {
    serverTimestamp: () => new Date(),
  },
  batch: () => ({
    set: (ref: any, data: any) => {},
    commit: async () => {},
  }),
}

const realtimeDb = {
  ref: (path: string) => ({
    child: (childPath: string) => realtimeDb.ref(`${path}/${childPath}`),
    set: async (value: any) => {
      // Mock implementation
    },
    once: async (eventType: string) => ({
      val: () => mockPots.get(path) || 0,
      forEach: (callback: any) => {
        const entries = mockLeaderboard.get(path) || []
        entries.forEach((entry: any) => {
          callback({
            key: entry.attemptId,
            val: () => entry,
          })
        })
      },
    }),
    orderByChild: (field: string) => ({
      limitToFirst: (limit: number) => ({
        once: async (eventType: string) => ({
          forEach: (callback: any) => {
            const entries = mockLeaderboard.get(path) || []
            entries
              .sort((a: any, b: any) => a[field] - b[field])
              .slice(0, limit)
              .forEach((entry: any) => {
                callback({
                  key: entry.attemptId,
                  val: () => entry,
                })
              })
          },
        }),
      }),
    }),
    transaction: async (updateFunction: any) => {
      const currentValue = mockPots.get(path) || 0
      const newValue = updateFunction(currentValue)
      mockPots.set(path, newValue)
    },
  }),
}

const auth = {
  // Mock auth functions if needed
}

const collections = {
  users: firestore.collection('users'),
  levels: firestore.collection('levels'),
  challenges: firestore.collection('challenges'),
  attempts: firestore.collection('attempts'),
  transactions: firestore.collection('transactions'),
  boosters: firestore.collection('boosters'),
}

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
  const userId = Math.random().toString(36).substring(2)
  const userRef = collections.users.doc(userId)
  await userRef.set({
    ...data,
    created_at: new Date(),
  })
  return { id: userId, ...data }
}

async function updateUserBalance(userId: string, newBalance: number) {
  await collections.users.doc(userId).update({
    gold_balance: newBalance,
  })
}

async function addToLeaderboard(
  challengeId: string,
  attemptId: string,
  userId: string,
  timeMs: number,
  displayName: string,
) {
  const date = new Date().toISOString().split('T')[0]
  const key = `leaderboards/${challengeId}/${date}`
  const entries = mockLeaderboard.get(key) || []
  entries.push({
    attemptId,
    userId,
    timeMs,
    displayName,
    completedAt: Date.now(),
  })
  mockLeaderboard.set(key, entries)
}

async function getLeaderboard(challengeId: string, limit = 50) {
  const date = new Date().toISOString().split('T')[0]
  const key = `leaderboards/${challengeId}/${date}`
  const entries = mockLeaderboard.get(key) || []
  return entries.sort((a: any, b: any) => a.timeMs - b.timeMs).slice(0, limit)
}

async function updatePot(challengeId: string, amount: number) {
  const date = new Date().toISOString().split('T')[0]
  const key = `pots/${challengeId}/${date}`
  const currentPot = mockPots.get(key) || 0
  mockPots.set(key, currentPot + amount)
}

async function getPot(challengeId: string) {
  const date = new Date().toISOString().split('T')[0]
  const key = `pots/${challengeId}/${date}`
  return mockPots.get(key) || 0
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
}

export {}