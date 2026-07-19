# TrackBetter deployment checklist

## Firebase

- [ ] Web app registered
- [ ] Android app registered in the same Firebase project
- [ ] Google Authentication enabled
- [ ] Firestore database created
- [ ] `firestore.rules` deployed
- [ ] `firestore.indexes.json` deployed
- [ ] Vercel domain added to Firebase Authorized domains

## Gmail

- [ ] Google 2-Step Verification enabled
- [ ] App Password generated
- [ ] `GMAIL_USER` added to Vercel
- [ ] `GMAIL_APP_PASSWORD` added as a sensitive variable
- [ ] `REPORT_FROM_EMAIL` added

## Vercel

- [ ] Git repository imported
- [ ] All Firebase Web variables added
- [ ] All Firebase Admin variables added as server-only variables
- [ ] `CRON_SECRET` added as a sensitive variable
- [ ] Production deployment completed
- [ ] Google login tested
- [ ] Expense and income synchronization tested
- [ ] Test report email sent
- [ ] Cron routes visible in the Vercel project
