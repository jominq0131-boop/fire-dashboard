# Infrastructure boundary

Storage and external-service adapters belong here.

- UI and domain code must not call IndexedDB or future cloud APIs directly.
- MVP persistence will be an IndexedDB adapter behind a small repository interface.
- JSON is a versioned import/export and backup format, not the primary store.

Milestone 4 implements `IndexedDbAccountRepository` in `indexeddb-accounts.ts` using the browser's native IndexedDB API, without another dependency. Each operation closes its database connection after transaction completion/abort. Writes resolve only after commit. Updates compare the expected record inside the write transaction to reject stale edits. A blocked upgrade, unknown database version or malformed record is never fixed by deleting user data.

The database is `fire-dashboard` v1 with the `accounts` store (`id` keyPath); the domain migration plan describes initial creation. Native browser tests cover persistence, concurrent operations and rollback. Monthly records, backup/restore and synchronization are out of scope.
