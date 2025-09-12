const functions = require('firebase-functions')
const { collections, getLeaderboard, getPot } = require('./firebase')
const { PayoutCalculator } = require('./utils/payout-calculator')

// Run every hour to check for expired challenges
exports.autoCloseChallenges = functions.pubsub.schedule('0 * * * *').onRun(async (context) => {
  console.log('Running auto-close challenges check at', new Date().toISOString())
  
  try {
    // Get all active challenges
    const now = new Date()
    const challengesSnapshot = await collections.challenges
      .where('status', '!=', 'closed')
      .get()
    
    console.log(`Found ${challengesSnapshot.size} active challenges to check`)
    
    for (const doc of challengesSnapshot.docs) {
      const challenge = doc.data()
      const challengeId = doc.id
      
      // Check if challenge has expired
      let endsAt: Date
      if (challenge.ends_at?._seconds) {
        endsAt = new Date(challenge.ends_at._seconds * 1000)
      } else if (challenge.ends_at?.seconds) {
        endsAt = new Date(challenge.ends_at.seconds * 1000)
      } else if (challenge.ends_at) {
        endsAt = new Date(challenge.ends_at)
      } else {
        console.log(`Challenge ${challengeId} has no ends_at date, skipping`)
        continue
      }
      
      if (endsAt <= now) {
        console.log(`Challenge ${challengeId} has expired at ${endsAt.toISOString()}, closing it now`)
        
        try {
          await closeChallenge(challengeId, challenge)
          console.log(`Successfully closed challenge ${challengeId}`)
        } catch (error) {
          console.error(`Failed to close challenge ${challengeId}:`, error)
        }
      } else {
        console.log(`Challenge ${challengeId} expires at ${endsAt.toISOString()}, not yet time to close`)
      }
    }
    
    console.log('Auto-close check completed')
  } catch (error) {
    console.error('Error in auto-close challenges:', error)
  }
})

async function closeChallenge(challengeId: string, challenge: any) {
  // Get leaderboard entries
  const entries = await getLeaderboard(challengeId, 50)
  console.log(`Found ${entries.length} leaderboard entries for challenge ${challengeId}`)
  
  // Get pot value
  const pot = await getPot(challengeId)
  console.log(`Challenge ${challengeId} pot value: ${pot}`)
  
  if (entries.length === 0 || pot === 0) {
    console.log(`No entries or empty pot for challenge ${challengeId}, marking as closed without payouts`)
    await collections.challenges.doc(challengeId).update({
      status: 'closed',
      closed_at: new Date(),
      final_pot: pot,
      auto_closed: true,
      updated_at: new Date()
    })
    return
  }
  
  // Get prize distribution config
  let distributionConfig = challenge.prize_distribution
  
  // If it's the old format, convert it
  if (!distributionConfig || !distributionConfig.type) {
    const oldDistribution = challenge.prize_distribution || { '1st': 40, '2nd': 25, '3rd': 15 }
    const rakeBps = challenge.rake_bps || 0
    
    distributionConfig = {
      type: 'percentage',
      rules: [],
      rake: rakeBps / 100,
      minPlayersRequired: 3
    }
    
    // Convert old format to rules
    if (oldDistribution['1st']) {
      distributionConfig.rules.push({ position: 1, percentage: oldDistribution['1st'] })
    }
    if (oldDistribution['2nd']) {
      distributionConfig.rules.push({ position: 2, percentage: oldDistribution['2nd'] })
    }
    if (oldDistribution['3rd']) {
      distributionConfig.rules.push({ position: 3, percentage: oldDistribution['3rd'] })
    }
  }
  
  console.log('Using distribution config:', distributionConfig)
  
  // Calculate payouts
  const calculator = new PayoutCalculator()
  const payoutResult = calculator.calculatePayouts(pot, entries, distributionConfig)
  
  console.log('Payout calculation result:', {
    pot,
    netPot: payoutResult.netPot,
    rake: payoutResult.rake,
    payouts: payoutResult.payouts,
    refund: payoutResult.refund
  })
  
  // Process payouts
  const processedPayouts = []
  for (const payout of payoutResult.payouts) {
    console.log(`Processing payout for position ${payout.position}: ${payout.amount} to user ${payout.userId}`)
    
    try {
      // Update winner's balance
      const userDoc = await collections.users.doc(payout.userId).get()
      if (!userDoc.exists) {
        console.log(`WARNING: User ${payout.userId} not found`)
        continue
      }
      
      const userData = userDoc.data()
      const oldBalance = userData?.gold_balance || 0
      const newBalance = oldBalance + payout.amount
      
      console.log(`Updating balance for ${payout.userId}: ${oldBalance} -> ${newBalance}`)
      await collections.users.doc(payout.userId).update({
        gold_balance: newBalance
      })
      
      // Record transaction
      const transactionType = payoutResult.refund ? 'refund' : 'payout'
      await collections.transactions.doc().set({
        user_id: payout.userId,
        challenge_id: challengeId,
        type: transactionType,
        amount: payout.amount,
        created_at: new Date(),
        meta: { 
          position: payout.position,
          refund: payoutResult.refund,
          auto_closed: true
        }
      })
      
      // Update global stats with payout
      const { updateGlobalStats, incrementGamesPlayed } = require('./firebase')
      await updateGlobalStats(payout.userId, payout.amount, payout.displayName)
      
      // Mark as win if in top 3
      if (payout.position <= 3) {
        await incrementGamesPlayed(payout.userId, true)
      }
      
      processedPayouts.push({
        position: payout.position,
        userId: payout.userId,
        displayName: payout.displayName,
        prize: payout.amount
      })
      console.log(`Successfully processed payout for position ${payout.position}`)
    } catch (error) {
      console.error(`ERROR processing payout for position ${payout.position}:`, error)
    }
  }
  
  console.log('All payouts processed:', processedPayouts)
  
  // Update challenge status to closed
  await collections.challenges.doc(challengeId).update({
    status: 'closed',
    closed_at: new Date(),
    final_pot: pot,
    rake_collected: payoutResult.rake,
    winners: processedPayouts,
    auto_closed: true,
    updated_at: new Date()
  })
  
  console.log(`Challenge ${challengeId} closed successfully with ${processedPayouts.length} payouts`)
}

module.exports = exports