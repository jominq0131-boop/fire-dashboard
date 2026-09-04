## Milestone 6

metrics.ts provides pure bounded monthly aggregation, reference/month validation, missing-value semantics and exact integer intermediate arithmetic with explicit overflow results. No persisted model or migration changes.

# Domain boundary

Account capacity is 100 including inactive accounts. Raw names and stored IDs are limited to 100 UTF-16 code units. Stored records must have exactly the five account fields. Invalid records are rejected, never repaired or deleted.

Financial concepts, calculations, validation, and schema migrations belong here.

- Must not import React, IndexedDB, network clients, or browser UI modules.
- Monetary values will be represented as integer Japanese yen, not floating-point values.
- Every data-schema change must include a deterministic migration and tests.

Milestone 2 defines the financial models in `models.ts` and primitive validation in `validation.ts`.
Milestone 4 adds account validation and the repository contract in `accounts.ts`, and the deterministic initial storage plan in `storage-migrations.ts`. Account IDs are stable; deactivation does not delete history. Monthly records and FIRE calculations are not implemented yet.

Milestone 5 adds monthly.ts: supported calendar months, integer-yen parsing, bounded record validation, comparison and MonthlyRepository. storage-migrations.ts retains the v1 plan and adds deterministic v2 stores/indexes without touching records.
