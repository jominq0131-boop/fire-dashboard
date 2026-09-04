# Everyday recording product contract

Issue #25 responds to missed month-end entry. The primary action is to record a balance observed today, with a real observation date, without requiring a reconstructed month-end amount or cash-flow fields.

- Current card: one last-known record per account, including inactive accounts, with amount and date/unknown-date provenance. Missing accounts are not treated as zero. Older records remain visible until explicitly updated. More than31 calendar days triggers a freshness prompt, not a financial accuracy guarantee.
- Monthly history: one record per account/month, actual observed date optional for legacy data. Repeated updates edit that month representative; this is not daily history. Missing months remain gaps; current totals and monthly observation totals are different views.
- Today action defaults today and focuses the selected account. Past entries require an actual date unless preserving a legacy record with unknown date. If month-end is forgotten, consult account history/statements or resume today; never invent historical values.
- DB v3: add accountMonth [accountId,month] index in existing upgrade transaction. No field inference, bulk application reads or record rewrite. Index building may use resources proportional to existing data. Failed upgrade rolls back; older tabs close on versionchange.
- JSON v2: optional asOfDate, v1 upgrade preserves all existing fields and unknown date. Same identity/duplicate/reference/size policy. No destructive restore.
- Delivery gates: date/amount and migration tests, full preserved regressions, isolated browser workflow and preservation tests, documentation, PR CI and deployment artifact verification. External financial service integration, automatic sync, daily history and FIRE assumptions remain future design work.
