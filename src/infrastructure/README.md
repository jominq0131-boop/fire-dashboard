# Infrastructure boundary

Storage and external-service adapters belong here.

- UI and domain code must not call IndexedDB or future cloud APIs directly.
- MVP persistence will be an IndexedDB adapter behind a small repository interface.
- JSON is a versioned import/export and backup format, not the primary store.

No persistence adapter has been implemented in Milestone 1.
