# Portfolio SIP-First V6

## Page order

1. SIP details and common monthly payment calendar
2. Multiple goal setup (collapses after a goal is added)
3. Goal analytics
4. Stable latest-snapshot portfolio analytics
5. Stable latest-snapshot asset allocation
6. Year-wise growth
7. Custom growth predictor
8. Holdings and performance
9. Portfolio details at the bottom

## SIP payment behavior

- Historical SIP months entered through Previous SIP Information are displayed as previous paid months.
- Future and current SIPs are counted in invested amount only after their month is ticked as paid.
- Ticking a month creates `transactions/sip-{holdingId}-{YYYY-MM}` and deducts the configured account.
- Unticking reverses the account balance and removes the transaction.
- Future months cannot be ticked.
- Annual step-up changes are marked in the calendar.
- A multi-year progress calendar is shown from the first entered SIP month.

## Stable analytics

Portfolio progress/projection and asset allocation use the latest stored portfolio state. Changing the review month only changes the holdings review and period-return section.
