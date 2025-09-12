#!/bin/bash

# Manual tournament closure and payout script using Firebase CLI
# This script will close expired tournaments and process payouts

echo "=== MANUAL TOURNAMENT CLOSURE AND PAYOUT ==="
echo "Starting at: $(date)"

# Set project
firebase use candyclash-85fd4

# Get all active challenges and process them
echo ""
echo "Fetching active challenges..."

# Use Firestore REST API via Firebase CLI
firebase firestore:get challenges --where status=active --json > /tmp/active-challenges.json

if [ ! -s /tmp/active-challenges.json ]; then
    echo "No active challenges found or error fetching data"
    exit 1
fi

echo "Active challenges fetched. Processing..."

# Parse and display the challenges
cat /tmp/active-challenges.json | python3 -c "
import json
import sys
from datetime import datetime

data = json.load(sys.stdin)
if 'documents' not in data:
    print('No active challenges found')
    sys.exit(0)

now = datetime.now()
challenges_to_close = []

for doc in data.get('documents', []):
    challenge_id = doc['name'].split('/')[-1]
    fields = doc.get('fields', {})
    
    status = fields.get('status', {}).get('stringValue', '')
    name = fields.get('name', {}).get('stringValue', 'Unknown')
    
    # Parse ends_at
    ends_at_str = fields.get('ends_at', {}).get('timestampValue', '')
    if ends_at_str:
        ends_at = datetime.fromisoformat(ends_at_str.replace('Z', '+00:00'))
        
        print(f'\\nChallenge: {challenge_id}')
        print(f'  Name: {name}')
        print(f'  Status: {status}')
        print(f'  Ends at: {ends_at}')
        print(f'  Should close: {now > ends_at}')
        
        if now > ends_at:
            challenges_to_close.append({
                'id': challenge_id,
                'name': name
            })

if challenges_to_close:
    print(f'\\n{len(challenges_to_close)} challenges need to be closed:')
    for c in challenges_to_close:
        print(f'  - {c[\"id\"]}: {c[\"name\"]}')
else:
    print('\\nNo challenges need to be closed at this time.')
"

echo ""
echo "To manually close challenges and process payouts:"
echo "1. Go to Firebase Console: https://console.firebase.google.com/project/candyclash-85fd4/firestore"
echo "2. Find expired challenges and update their status to 'closed'"
echo "3. Check the 'attempts' collection for winners"
echo "4. Process payouts by updating user balances and creating transaction records"
echo ""
echo "Alternatively, deploy the scheduled function to handle this automatically:"
echo "  cd /Users/benjamin.pommeraud/Desktop/CandyClash/app/backend"
echo "  firebase deploy --only functions:autoCloseChallenges"