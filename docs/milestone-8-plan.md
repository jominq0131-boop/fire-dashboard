# Milestone 8 — Explicit FIRE scenarios / Issue #27

This milestone lets users compare the time to a chosen asset target without inventing return or withdrawal assumptions. Inputs are temporary React state, blank initially, excluded from backups, and lost on reload. No DB or JSON schema changes, new dependencies, services, or synchronization.

- Starting assets and monthly contributions are nonnegative safe-integer yen; target is positive safe-integer yen in today's purchasing power.
- Users enter annual nominal return and inflation percentages (-99..100, at most two decimals). These are converted to integer basis points, never inferred from account categories or recommended defaults.
- Monthly assets = round(previous assets × (120000 + returnBps) /120000) + contribution. Monthly target = round(previous target × (120000 + inflationBps) /120000). Nonnegative values round half up to yen with exact BigInt intermediates. This is nominal annual rate divided by12, not effective annual rate. Rounding small values can produce plateaus, including under negative rates.
- Contributions are fixed nominal month-end payments. Target grows or shrinks with inflation. Up to1200 monthly steps and101 annual rows; no unbounded history scan or projection. Any unsafe output stops the projection with explicit overflow month.
- Report first crossing including month0, distinct from no crossing within100 years or indeterminate after overflow. First arrival is not sustained retirement affordability. Rows continue after crossing to show potential later decline.
- Recorded assets load only on user action using existing bounded queries. Show account coverage and differing/old/unknown dates; permit manual correction. Missing records are not zero. This value is last-known gross financial assets, not live net wealth.
- Editing inputs invalidates results. Failed reads keep drafts. No source record is changed. Clear affects only assumptions. Taxes, fees, liabilities, withdrawals and random market volatility are excluded and stated in the UI.

Settings persistence and backup integration require a separately approved storage contract. Withdrawal-based target estimation, sensitivity comparisons and retirement drawdown are follow-up scope, not claimed complete here. Local checks and remote release state are recorded separately in work-log and the linked PR.
