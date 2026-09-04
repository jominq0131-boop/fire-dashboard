# Domain boundary

Financial concepts, calculations, validation, and schema migrations belong here.

- Must not import React, IndexedDB, network clients, or browser UI modules.
- Monetary values will be represented as integer Japanese yen, not floating-point values.
- Every data-schema change must include a deterministic migration and tests.

Milestone 2 defines the financial models in `models.ts` and primitive validation in `validation.ts`.
Milestone 4 adds account validation and the repository contract in `accounts.ts`, and the deterministic initial storage plan in `storage-migrations.ts`. Account IDs are stable; deactivation does not delete history. Monthly records and FIRE calculations are not implemented yet.
