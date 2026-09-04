# Milestone 9 — scenario comparison and consistent layout / Issue #29

The user requested stable placement regardless of entered values and completion/deployment of the next milestone. This takes the documented sensitivity-comparison follow-up from Milestone8 and reinforces layout across existing features.

- Up to3 session-only comparison snapshots. Each copies the five explicit input strings and retains the immutable, already calculated result. No recommended assumptions or new financial formula. Parent edits/clear do not rewrite snapshots; reload removes them. Addition requires a valid current result; full capacity requires explicit removal before adding.
- Show assumptions, first arrival, overflow and10/20/30-year assets. Missing projection years are calculation-range errors, never zero. Existing nominal-rate, rounding, first-crossing and horizon meanings apply. Different starting assets/targets remain visible so comparisons are not presented as guaranteed or like-for-like advice.
- Account names occupy their own wrapping region. Update/save actions have short fixed visible labels and full account-specific accessible labels. Columns shrink within their parent; input, button and numeric styles are consistent. Main totals use container-scaled type; table numbers remain unbroken and right aligned.
- Tables have predictable fixed columns and a local, keyboard-focusable scroll viewport. No global overflow hiding or financial truncation. Small-screen navigation wraps to a grid. Control minimum height is44px. Arbitrary text may increase row height; positions across different viewport sizes are intentionally responsive, not pixel-identical.
- Validate100-character names, maximum safe-integer yen, zero/missing values and long errors at320–1440px, plus comparison lifecycle and existing regressions. Inspect desktop/mobile screenshots using synthetic data only.

DBv3, JSONv2, financial calculations, dependencies and external services are unchanged. Persistent scenarios and retirement drawdown remain future work. Release proof belongs to the linked PR after CI and live-file verification.
