# TrackBetter Portfolio Upgrade V3

## Portfolio changes

- Replaced the duplicate monthly valuation controls with one **Manage holding and monthly updates** section.
- Holdings table is now read-only and contains a **Manage** action.
- Added collapsible/minimizable portfolio cards.
- Added two existing-portfolio import modes:
  - Complete overall snapshot
  - Month-wise value history (`YYYY-MM,value`)
- Added editable holding settings:
  - Name and symbol
  - Asset class
  - Individual goal
  - Expected annual return assumption
  - SIP amount, debit day and account
  - SIP auto-tracking start date
  - Annual SIP step-up
  - Look-through fund allocation percentages
- Added contribution-adjusted returns for 3 months, 6 months, 1 year, 3 years and 5 years.
- Added year-wise SIP calendar with monthly amount, recorded/due/upcoming status, yearly total and projected year-end gain.
- Added overall and holding-level goal guidance:
  - Current distance from goal
  - Current monthly SIP
  - Estimated value by goal date
  - Required monthly SIP
  - Suggested monthly increase
  - Return assumption used
- Added actual-vs-invested-vs-projected portfolio graph.
- Updated the complete light and dark palette from green to soft indigo, blue, violet, coral and neutral slate.

## Existing portfolio safety

When importing an existing portfolio, leave **Deduct opening investment from this account** disabled. This prevents historical invested money from being deducted again from the current account balance.

For an existing SIP, use **Auto-track transactions from** to choose the first date from which TrackBetter should create new SIP transactions. Earlier SIPs remain included in the entered total invested amount and are not backfilled automatically.

## Return calculation note

Period returns use monthly values and subtract contributions made within the selected period. XIRR uses dated investment cash flows. Goal projections use entered return assumptions or available historical trend data. Projections are estimates and are not guaranteed market outcomes.

## Deployment

No new environment variable is required. Deploy the same Firebase and Vercel configuration used by the previous release.

```powershell
npm ci
npm run typecheck
npm run build
```

Then commit and push the changed files to the GitHub branch connected to Vercel.
