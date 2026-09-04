import { expect, it } from "vitest";
import {
  isObservationDate,
  monthEnd,
  observationStatus,
  currentTotal,
} from "../../../src/domain/observations";
import { isMonthlyRecord } from "../../../src/domain/monthly";
import { normalizeBackup, canonical } from "../../../src/domain/backup";
import { storageMigrationPlan } from "../../../src/domain/storage-migrations";
import { syntheticBackup } from "../../fixtures/portfolio";

it("validates real calendar dates and matching observation months", () => {
  expect(monthEnd("2024-02")).toBe("2024-02-29");
  expect(monthEnd("2100-02")).toBe("2100-02-28");
  for (const date of ["2026-02-29", "2026-09-00", "2026-09-31", "2026-9-04", "1899-12-31"])
    expect(isObservationDate(date)).toBe(false);
  expect(isObservationDate("2026-09-04")).toBe(true);
  const b = syntheticBackup().accountBalanceSnapshots[1];
  expect(isMonthlyRecord({ ...b, asOfDate: "2026-09-04" }, false)).toBe(true);
  expect(isMonthlyRecord({ ...b, asOfDate: "2026-08-31" }, false)).toBe(false);
  expect(isMonthlyRecord({ ...b, asOfDate: "" }, false)).toBe(false);
});
it("migrates JSON v1 without inventing dates and round-trips v2", () => {
  const v1 = syntheticBackup(),
    before = canonical(v1);
  const v2 = normalizeBackup(v1);
  expect(v2).toEqual({ ...v1, schemaVersion: 2 });
  expect(canonical(v1)).toBe(before);
  v2.accountBalanceSnapshots = v2.accountBalanceSnapshots.map((b) => ({
    ...b,
    asOfDate: monthEnd(b.month),
  }));
  expect(normalizeBackup(JSON.parse(canonical(v2)))).toEqual(v2);
  expect(() => normalizeBackup({ ...v2, schemaVersion: 1 })).toThrow();
});
it("adds only the account/month index in v3 and retains all prior migration plans", () => {
  const migration = storageMigrationPlan(2, 3);
  expect(migration).toEqual([
    {
      version: 3,
      store: "accountBalanceSnapshots",
      keyPath: "id",
      existingStore: true,
      indexes: [{ name: "accountMonth", keyPath: ["accountId", "month"], unique: true }],
    },
  ]);
  expect(storageMigrationPlan(0)).toEqual([...storageMigrationPlan(0, 2), ...migration]);
  expect(storageMigrationPlan(3)).toEqual([]);
});
it("distinguishes missing, unknown-date, fresh and stale records", () => {
  const b = syntheticBackup().accountBalanceSnapshots[0];
  expect(observationStatus(undefined, "2026-09-04")).toBe("未記録");
  expect(observationStatus(b, "2026-09-04")).toContain("確認日未記録");
  expect(observationStatus({ ...b, asOfDate: "2026-08-04" }, "2026-09-04")).not.toContain(
    "32日以上",
  );
  expect(observationStatus({ ...b, asOfDate: "2026-08-03" }, "2026-09-04")).toContain("32日以上");
});
it("sums the last observation once per account with missing and overflow protection", () => {
  const b = syntheticBackup();
  expect(currentTotal({ accounts: b.accounts, balances: [] })).toBeNull();
  expect(currentTotal({ accounts: b.accounts, balances: [b.accountBalanceSnapshots[0]] })).toBe(
    100,
  );
  expect(() =>
    currentTotal({ accounts: b.accounts, balances: b.accountBalanceSnapshots }),
  ).toThrow();
  const accounts = [...b.accounts, { ...b.accounts[0], id: "other" }];
  expect(
    currentTotal({
      accounts,
      balances: [
        { ...b.accountBalanceSnapshots[0], balance: Number.MAX_SAFE_INTEGER },
        { ...b.accountBalanceSnapshots[1], accountId: "other", balance: 1 },
      ],
    }),
  ).toBe("overflow");
});
