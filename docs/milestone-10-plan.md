# Milestone 10 — Interactive records and projections / Issue #31

## User outcome

Inspect a line chart by pointer, touch or keyboard, identify the selected month/year and exact values, review underlying records, then explicitly use a recorded amount as a forecast starting point. Rewrite current documentation by purpose and preserve obsolete narrative in history.

## History

Extend the existing bounded12-month overview with at most12 validated cash-flow records using its month index in the same read transaction. Show6/12-month windows and all-account/single-account filtering. Aggregate line segments require the same account-ID set in consecutive months; individual-account segments require real records at consecutive positions. Missing/overflow remains absent, never interpolated. Partial totals use hollow points. A stable inspector shows the chosen values, monthly cash flow, coverage and account breakdown. Editing uses existing guarded month navigation.

Selected-record handoff calls FirePlanner explicitly. If assumptions exist, confirm replacement of starting assets; cancel preserves everything. Acceptance preserves other assumptions and comparisons, invalidates the active result, and identifies the recorded month/coverage instead of presenting it as live assets. No write occurs.

## Forecasts

Reuse annual FireProjection points with10/30/100-year windows. Solid assets and dashed inflation-adjusted targets share the same yen axis. Up to3 comparisons produce at most6 series ×101 points. Legend toggles, selected-year inspector and keyboard slider expose exact values. If series are removed, keep at least one existing series visible. Overflow stops lines; no fabricated future points. Existing calculation/rounding/first-crossing caveats remain.

## UI and limits

SVG coordinates are presentation-only; financial amounts remain unchanged. Linear segments represent connections between observations, not intramonth history. Selection never saves data. The slider is the explicit keyboard alternative to pointer hit testing. Touch uses click selection without suppressing page scrolling. Long names and maximum yen must remain inside the responsive layout. Existing detailed tables remain accessible.

## Documentation and validation

Current docs are organized as product → usage → architecture → data → safety → tests → releases. Archive previous text with corrected relative links, retain all prior decision/release evidence, and link the history from current guides. Test segment gaps, pointer/keyboard selection, filters, handoff cancel/accept, legend/horizon/comparison values, maximum-value layouts, existing regressions and local Markdown links.

No financial formula, DBv3/JSONv2, dependency, sync or service changes. Record local verification and remote deployment separately in work-log and the linked PR.
