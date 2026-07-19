# Portfolio Simplification V4

## New workflow

The portfolio page now uses three clear areas:

1. **Portfolio details**
   - Add an existing holding using only a snapshot month, total invested and current value.
   - No exact historical start date is required.
   - Update a holding and its monthly value from the same card.
   - Add a future lump-sum investment from an optional expandable form.

2. **SIP details**
   - Select a holding and enter previous SIP context separately.
   - Optional original start month, earlier SIP amount and last paid month.
   - Current monthly SIP, future tracking month, debit day/account and annual step-up.
   - The app creates future SIP transactions only from the selected tracking month.

3. **Holdings and performance**
   - One compact holdings table.
   - Overall 3M, 6M, 1Y, 3Y and 5Y returns.
   - Optional fund-wise gain chart.

## Important calculation rule

`Total invested till this month` is the opening invested amount and should already include historical SIP payments. Future automatic SIP transactions are added after the tracking month, preventing past installments from being deducted again.
