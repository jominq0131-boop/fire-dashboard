import type { Backup } from "../../src/domain/backup";
export function syntheticBackup(): Backup {
  const time = "2026-09-01T00:00:00.000Z";
  return {
    schemaVersion: 1,
    accounts: [
      { id: "synthetic-a", name: "合成資産口座", category: "cash", isActive: true, sortOrder: 0 },
    ],
    monthlyCashFlows: [
      {
        id: "synthetic-c",
        month: "2026-09",
        income: 100,
        expenses: 20,
        investmentContribution: 30,
        createdAt: time,
        updatedAt: time,
      },
    ],
    accountBalanceSnapshots: [
      {
        id: "synthetic-aug",
        accountId: "synthetic-a",
        month: "2026-08",
        balance: 100,
        createdAt: time,
        updatedAt: time,
      },
      {
        id: "synthetic-sep",
        accountId: "synthetic-a",
        month: "2026-09",
        balance: 120,
        createdAt: time,
        updatedAt: time,
      },
    ],
  };
}
