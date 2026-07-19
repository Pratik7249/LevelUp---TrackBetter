# Portfolio V7 fixes

## SIP double-count protection

Historical SIP months are already included in each holding's opening `invested` amount. The analytics layer now ignores legacy SIP transaction documents whose month is at or before the holding's historical cutoff (`lastPaidMonth`, or the month before `trackingStartDate`).

If an old duplicate transaction still exists, the historical month shows a **Remove duplicate** action in the SIP calendar. Removing it reverses the linked account deduction while keeping the month shown as historically paid.

## Tickable SIP months

A SIP checkbox is enabled only when all of these are true:

- The month is on or after `trackingStartDate`.
- The month is not after the current month.
- The SIP amount is greater than zero.
- A debit account is selected.
- The month is not part of the previously paid period.

Example: to tick July 2026, set `lastPaidMonth` to June 2026 or earlier and set the tracking month to July 2026.

## Page sequence

1. Portfolio analytics
2. Asset allocation
3. Holdings and performance, including the SIP calendar
4. Goal setup
5. Goal analytics
6. Year-wise growth
7. Custom year predictor
8. SIP configuration
9. Portfolio add/update details

## Other changes

- Removed the calculated 3M/6M/1Y/3Y/5Y summary tiles.
- Added one manually maintained return snapshot per mutual fund or ETF.
- Added editable, independently allocated multiple goals.
- Added goal-specific monthly SIP instructions in plain language.
- Added Indian-rupee amounts in words throughout portfolio summaries and tables.
- Replaced the custom "years" input with starting year and ending year, including a year-wise projection table.
- Fixed the React `defaultOpen` DOM warning in collapsible cards.
- Stable analytics and allocation use the latest stored valuation month, not the currently selected review month.
