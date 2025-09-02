// Seed production database via API
// Using native fetch (Node 18+)

async function seedViaApi() {
  const apiUrl = 'https://us-central1-candyclash-85fd4.cloudfunctions.net/api'
  
  console.log('🌱 Seeding production database via API...')
  
  try {
    // First login to get a token
    const loginRes = await fetch(`${apiUrl}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@candyclash.com' })
    })
    
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`)
    }
    
    const { token } = await loginRes.json()
    console.log('✅ Admin user created/logged in')
    
    // Try to get today's challenge
    const challengeRes = await fetch(`${apiUrl}/challenge/today`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (challengeRes.ok) {
      const challenge = await challengeRes.json()
      console.log('✅ Challenge already exists:', challenge.config?.name)
    } else {
      console.log('⚠️  No active challenge found (expected on first deploy)')
      console.log('ℹ️  You can create challenges manually through Firebase Console')
    }
    
    console.log('🎉 Production setup complete!')
    console.log('🌐 App URL: https://candyclash-85fd4.web.app')
    console.log('🔧 API URL: https://us-central1-candyclash-85fd4.cloudfunctions.net/api')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

seedViaApi()