export const DATABASE_VERSION = 2;
export const ACCOUNT_STORE = "accounts";
export const CASH_STORE = "monthlyCashFlows";
export const BALANCE_STORE = "accountBalanceSnapshots";
interface MigrationStep {
  version: number;
  store: string;
  keyPath: string;
  indexes?: { name: string; keyPath: string | string[]; unique: boolean }[];
}
/** Pure ordered schema additions; existing records are never read or rewritten. */
export function storageMigrationPlan(from: number, to: number = DATABASE_VERSION): MigrationStep[] {
  if (
    !Number.isInteger(from) ||
    from < 0 ||
    !Number.isInteger(to) ||
    to < 1 ||
    to > DATABASE_VERSION ||
    from > to
  )
    throw new Error("Unsupported database version");
  const steps: MigrationStep[] = [];
  if (from < 1) steps.push({ version: 1, store: ACCOUNT_STORE, keyPath: "id" });
  if (from < 2 && to >= 2)
    steps.push(
      {
        version: 2,
        store: CASH_STORE,
        keyPath: "id",
        indexes: [{ name: "month", keyPath: "month", unique: true }],
      },
      {
        version: 2,
        store: BALANCE_STORE,
        keyPath: "id",
        indexes: [
          { name: "monthAccount", keyPath: ["month", "accountId"], unique: true },
          { name: "month", keyPath: "month", unique: false },
        ],
      },
    );
  return steps;
}
