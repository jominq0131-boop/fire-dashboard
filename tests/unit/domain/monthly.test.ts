import { describe, expect, it } from "vitest";
import {
  assertMonth,
  parseYen,
  assertCapacity,
  isMonthlyRecord,
  validateCash,
  sameRecord,
  MAX_MONTHS,
  MAX_BALANCES,
} from "../../../src/domain/monthly";
import { isIsoDateTime, isMonthKey } from "../../../src/domain/validation";
import { storageMigrationPlan } from "../../../src/domain/storage-migrations";
const record = {
  id: "synthetic",
  month: "2026-09",
  income: 0,
  expenses: 2,
  investmentContribution: 3,
  createdAt: "2026-09-04T00:00:00.000Z",
  updatedAt: "2026-09-04T00:00:00.000Z",
};
describe("bounded monthly domain", () => {
  it.each(["1900-01", "2199-12", "2026-09"])("accepts supported month %s", (v) =>
    expect(() => assertMonth(v)).not.toThrow(),
  );
  it.each([
    "1899-12",
    "2200-01",
    "02026-09",
    "2026-9",
    "2026-13",
    "2026-00",
    "0000-01",
    "2026-09\n",
  ])("rejects invalid month %s", (v) => expect(() => assertMonth(v)).toThrow());
  it("rejects extended year in the primitive", () => expect(isMonthKey("12026-09")).toBe(false));
  it.each([
    "",
    " ",
    "-1",
    "+1",
    "1.0",
    "1e3",
    "1,000",
    "9007199254740992",
    "00000000000000000",
    "１",
    "1\n",
  ])("rejects amount %s", (v) => expect(() => parseYen(v)).toThrow());
  it("distinguishes zero and safe maximum", () => {
    expect(parseYen("0")).toBe(0);
    expect(parseYen("9007199254740991")).toBe(Number.MAX_SAFE_INTEGER);
  });
  it.each([
    "2025-02-29T00:00:00.000Z",
    "2026-04-31T00:00:00.000Z",
    "September 4, 2026",
    "2026-09-04T24:00:00.000Z",
    "2026-09-04T00:00:00Z",
  ])("rejects invalid timestamp %s", (v) => expect(isIsoDateTime(v)).toBe(false));
  it("accepts leap day and requires canonical UTC", () =>
    expect(isIsoDateTime("2024-02-29T00:00:00.000Z")).toBe(true));
  it("validates complete records, field bounds and chronology", () => {
    expect(isMonthlyRecord(record, true)).toBe(true);
    for (const patch of [
      { income: -1 },
      { expenses: NaN },
      { investmentContribution: 0.5 },
      { note: "x".repeat(1001) },
      { id: "x".repeat(101) },
      { unexpected: 1 },
      { createdAt: "2026-09-05T00:00:00.000Z" },
    ])
      expect(isMonthlyRecord({ ...record, ...patch }, true)).toBe(false);
    expect(() => validateCash({ ...record, note: "x".repeat(1000) })).not.toThrow();
    const balance = {
      id: "b",
      month: record.month,
      accountId: "a",
      balance: 0,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    expect(isMonthlyRecord(balance, false)).toBe(true);
    expect(isMonthlyRecord({ ...balance, accountId: "" }, false)).toBe(false);
    expect(isMonthlyRecord({ ...balance, balance: Number.MAX_SAFE_INTEGER + 1 }, false)).toBe(
      false,
    );
  });
  it.each([MAX_MONTHS, MAX_BALANCES])(
    "allows edits at cap %s but blocks new rows and excess reads",
    (limit) => {
      expect(() => assertCapacity(limit, limit)).not.toThrow();
      expect(() => assertCapacity(limit - 1, limit, true)).not.toThrow();
      expect(() => assertCapacity(limit, limit, true)).toThrow();
      expect(() => assertCapacity(limit + 1, limit)).toThrow();
      for (const invalid of [-1, NaN, Infinity, 0.5])
        expect(() => assertCapacity(invalid, limit)).toThrow();
    },
  );
  it("compares values without depending on field insertion order", () => {
    expect(sameRecord({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameRecord({ a: 1 }, { a: 2 })).toBe(false);
  });
  it("adds deterministic empty stores and unique keys, preserves v1 plan", () => {
    const v2 = storageMigrationPlan(1);
    expect(v2.map((s) => s.store)).toEqual(["monthlyCashFlows", "accountBalanceSnapshots"]);
    expect(v2[0].indexes).toEqual([{ name: "month", keyPath: "month", unique: true }]);
    expect(v2[1].indexes).toEqual([
      { name: "monthAccount", keyPath: ["month", "accountId"], unique: true },
      { name: "month", keyPath: "month", unique: false },
    ]);
    expect(storageMigrationPlan(0)).toEqual([...storageMigrationPlan(0, 1), ...v2]);
    expect(storageMigrationPlan(2)).toEqual([]);
    expect(storageMigrationPlan(1)).toEqual(v2);
  });
});
