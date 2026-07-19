# TrackBetter

A deployment-ready Next.js personal tracker for finance, advanced portfolio analytics, habits, daily focus check-ins and scheduled email reports.

## What changed in this release

- Google Authentication with Firebase
- Shared Firestore data model for web and mobile clients
- One document per account, category, transaction, holding and daily log
- Automatic migration from the old `users/{uid}/tracker/state` document
- No Firestore `undefined` values
- Monthly portfolio snapshots
- User-isolated Firestore security rules
- Gmail SMTP reports protected by Firebase ID tokens and `CRON_SECRET`
- Light and dark mode preference synchronized in Firestore

## Firestore structure

```text
users/{uid}
├── settings/preferences
├── accounts/{accountId}
├── categories/{categoryId}
├── transactions/{transactionId}
├── holdings/{holdingId}
├── portfolioSnapshots/{YYYY-MM-01}
├── habits/{habitId}
├── habitLogs/{habitId}_{YYYY-MM-DD}
├── dailyCheckins/{YYYY-MM-DD}
└── reports/settings
```

The profile is stored directly on `users/{uid}`. The same Firebase UID is used by the web and Android applications.

## Local setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Required environment variables

Copy `.env.example` to `.env.local`, then fill in:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

GMAIL_USER=musicalqwertyx@gmail.com
GMAIL_APP_PASSWORD=
REPORT_FROM_EMAIL="TrackBetter <musicalqwertyx@gmail.com>"
CRON_SECRET=
```

## Firebase setup

1. Create one Firebase project for both web and Android.
2. Register the web app and copy its Firebase Web SDK values.
3. Enable Authentication → Google.
4. Create Cloud Firestore in production mode.
5. Deploy rules and indexes:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore
```

6. Download `google-services.json` from the same Firebase project for the Android app.

## Vercel deployment

1. Push this folder to a GitHub repository.
2. Import the repository into Vercel.
3. Keep Framework Preset as Next.js and Build Command as `npm run build`.
4. Add every variable from `.env.example` to Vercel Project Settings → Environment Variables.
5. Deploy.
6. Add the generated `your-project.vercel.app` domain to Firebase Authentication → Settings → Authorized domains.
7. Redeploy after changing any environment variables.

The included `vercel.json` schedules the report routes. Vercel invokes cron schedules in UTC; `03:30 UTC` is `09:00 IST`.

## Validation

```bash
npm run typecheck
npm run build
```

## Legacy migration

When a signed-in user has an old document at:

```text
users/{uid}/tracker/state
```

and the new collections are empty, TrackBetter migrates the old arrays into the new collections and then deletes the legacy state document.


## Advanced portfolio behavior

- Every holding stores its investment date, initial amount, optional fund category, individual goal, monthly valuations, additional dated investments and SIP plan.
- Mutual funds and ETFs can be classified as Large Cap, Mid Cap, Small Cap, Flexi Cap, Multi Cap, Index Fund, ELSS, Hybrid, Debt Fund, Liquid Fund, International, Sectoral / Thematic or Other.
- Portfolio totals are calculated for the selected month. The dashboard shows invested amount, current value, absolute return and XIRR for each holding and the full portfolio.
- When a SIP installment becomes due, the client creates a deterministic investment transaction such as `sip-{holdingId}-{YYYY-MM}`. Firestore transactions prevent duplicate account deductions when the web app and mobile app are open together.
- The old default mess tracker has been replaced with `dailyCheckins`, which records whether the user completed the main priority for each day.
