export const DATABASE_VERSION = 1;
export const ACCOUNT_STORE = "accounts";

/** Pure, deterministic plan. Version zero means no database exists yet. */
export function storageMigrationPlan(from: number, to: number = DATABASE_VERSION) {
  if (!Number.isInteger(from) || from < 0 || to !== DATABASE_VERSION || from > to) {
    throw new Error("Unsupported database version");
  }
  return from === 0 ? [{ version: 1, store: ACCOUNT_STORE, keyPath: "id" }] : [];
}
