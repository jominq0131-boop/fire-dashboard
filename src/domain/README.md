# Domain boundary

Financial concepts, calculations, validation, and schema migrations belong here.

- Must not import React, IndexedDB, network clients, or browser UI modules.
- Monetary values will be represented as integer Japanese yen, not floating-point values.
- Every data-schema change must include a deterministic migration and tests.

No financial model has been implemented in Milestone 1.

