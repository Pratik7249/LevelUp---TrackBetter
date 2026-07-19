# TrackBetter Advanced Portfolio Upgrade

## Firestore changes

The existing collections remain compatible. This version adds richer fields inside each holding document:

```text
users/{uid}/holdings/{holdingId}
  investmentDate
  invested
  currentValue
  goalAmount
  assetClass
  fundCategory
  monthlyValues[]
  additionalInvestments[]
  sip.enabled
  sip.amount
  sip.startDate
  sip.dayOfMonth
  sip.accountId
```

The default mess tracker is no longer used. Daily focus is stored at:

```text
users/{uid}/dailyCheckins/{YYYY-MM-DD}
```

Old `messLogs` documents are ignored and may be deleted after confirming the new deployment.

## Automatic SIP accounting

When a configured SIP becomes due, the signed-in client creates one deterministic investment transaction:

```text
users/{uid}/transactions/sip-{holdingId}-{YYYY-MM}
```

The same operation deducts the SIP amount from the selected account. The Firestore transaction checks whether the deterministic transaction already exists before adjusting the balance, so the web and mobile clients do not create duplicate deductions.

## Deploying the upgrade

1. Replace the repository files with this project version.
2. Keep the existing Vercel environment variables.
3. Run `npm ci`, `npm run typecheck`, and `npm run build` locally.
4. Commit and push to the connected GitHub repository.
5. Vercel creates a new production deployment automatically.
6. Deploy the included Firestore rules with `firebase deploy --only firestore` when your current rules are older.
7. Sign in and confirm that `dailyCheckins` and the new holding fields appear in Firestore.
