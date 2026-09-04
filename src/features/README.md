## Everyday flow

AssetOverview displays per-account last-known amounts with provenance and today-update actions. MonthlyManager records actual confirmation dates, defaults today only in the today flow, keeps past unknown inputs empty, focuses the chosen account and renders balances before cash flows. MonthlyOverview and the chart remain explicit per-month recorded values, distinct from the cross-month current total.

## Milestone 7

AssetOverview automatically loads latest assets and a bounded history window, offers accessible SVG/table and guarded month drilldown. MonthlyManager keeps drafts and per-month summary separate from overall assets. BackupManager handles bounded file selection, preview/cancel, explicit import and JSON download. Successful import refreshes accounts/overview; monthly drafts stay mounted and require an explicit reread. No user file contents are sent to a server.

## Milestone 6

MonthlyOverview presents committed monthly metrics and coverage. MonthlyManager publishes the loaded snapshot to App without exposing unsaved drafts. A failed reread clears the summary; failed saves preserve committed values. Existing repository contracts, bounded queries and draft protections remain.

# Feature boundary

The account UI explains the 100-account cap including inactive records. Creation is disabled at capacity but editing remains available. Oversized-store errors do not silently truncate or delete records.

Feature-specific UI and application orchestration belong here. Features may use domain services and repository interfaces, but must not depend on a concrete persistence implementation.

Milestone 4 adds `accounts/AccountManager.tsx`: account creation, editing, deactivation/reactivation, loading, validation, conflict and persistence-error states. The repository is injected by the application. Failed saves retain form input; account registration alone does not populate financial metrics. Monthly input is implemented separately in the Milestone 5 feature below.

Milestone 5 adds monthly/MonthlyManager.tsx with injected monthly/account contracts. It explicitly loads one selected month, saves cash flow and each balance separately, and retains failed drafts. It warns before discarding edits and renders at most 100 account balance forms. Aggregates and charts remain unimplemented.

UI refresh (Issue #19) changes presentation only: account guidance disclosure, account identity rows, month selection empty state, grouped input fields and save-state styling. Repository calls and validation/draft preservation remain unchanged. Navigation is provided by App and does not unmount these features.
