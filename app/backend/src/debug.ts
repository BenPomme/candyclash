const { collections } = require('./firebase')

async function debug() {
  console.log('🔍 Debugging challenges...')
  
  // List all challenges
  const snapshot = await collections.challenges.orderBy('starts_at', 'desc').get()
  
  console.log(`Found ${snapshot.size} challenges:`)
  snapshot.docs.forEach(doc => {
    const data = doc.data()
    console.log({
      id: doc.id,
      name: data.name,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      now: new Date(),
      isActive: data.starts_at <= new Date() && data.ends_at >= new Date()
    })
  })
  
  // Check the query
  const now = new Date()
  console.log('\n🔍 Testing query with now =', now)
  
  const activeSnapshot = await collections.challenges
    .where('starts_at', '<=', now)
    .where('ends_at', '>=', now)
    .limit(1)
    .get()
    
  console.log(`Active challenges found: ${activeSnapshot.size}`)
}

debug()
export {}
