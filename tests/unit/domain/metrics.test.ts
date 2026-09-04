import { describe, expect, it } from "vitest";
import { monthlyMetrics, type MetricsSource } from "../../../src/domain/metrics";

const time = "2026-09-01T00:00:00.000Z";
const source = (): MetricsSource => ({
  month: "2026-09",
  accounts: [
    { id: "a", name: "Synthetic", category: "cash", isActive: false, sortOrder: 0 },
    { id: "b", name: "Synthetic 2", category: "other", isActive: true, sortOrder: 1 },
  ],
  records: {
    cash: {
      id: "c",
      month: "2026-09",
      income: 100,
      expenses: 60,
      investmentContribution: 50,
      createdAt: time,
      updatedAt: time,
    },
    balances: [
      { id: "s", month: "2026-09", accountId: "a", balance: 123, createdAt: time, updatedAt: time },
    ],
  },
});
describe("monthly metrics", () => {
  it("keeps investment separate, includes inactive balances and preserves source", () => {
    const s = source(),
      original = structuredClone(s);
    expect(monthlyMetrics(s)).toEqual({
      assets: 123,
      recordedAccounts: 1,
      totalAccounts: 2,
      income: 100,
      expenses: 60,
      investmentContribution: 50,
      surplus: 40,
      remainingCash: -10,
    });
    expect(s).toEqual(original);
  });
  it("distinguishes missing from explicit zero", () => {
    const s = source();
    s.records = { cash: null, balances: [] };
    expect(monthlyMetrics(s)).toMatchObject({
      assets: null,
      income: null,
      surplus: null,
      remainingCash: null,
    });
    const zero = source();
    zero.records.balances[0].balance = 0;
    Object.assign(zero.records.cash!, { income: 0, expenses: 0, investmentContribution: 0 });
    expect(monthlyMetrics(zero)).toMatchObject({
      assets: 0,
      income: 0,
      surplus: 0,
      remainingCash: 0,
    });
  });
  it("detects asset and negative cash overflow independently without rounding", () => {
    const s = source(),
      max = Number.MAX_SAFE_INTEGER;
    s.records.balances[0].balance = max;
    expect(monthlyMetrics(s).assets).toBe(max);
    s.records.balances.push({ ...s.records.balances[0], id: "s2", accountId: "b", balance: 1 });
    Object.assign(s.records.cash!, { income: 0, expenses: max, investmentContribution: 1 });
    expect(monthlyMetrics(s)).toMatchObject({
      assets: "overflow",
      surplus: -max,
      remainingCash: "overflow",
    });
    Object.assign(s.records.cash!, { income: max, expenses: max, investmentContribution: max });
    expect(monthlyMetrics(s).remainingCash).toBe(-max);
  });
  it.each([
    "duplicate",
    "missing account",
    "wrong month",
    "invalid amount",
    "wrong cash month",
    "too many accounts",
  ])("rejects %s observations", (kind) => {
    const s = source();
    if (kind === "duplicate") s.records.balances.push({ ...s.records.balances[0] });
    if (kind === "missing account") s.accounts = [];
    if (kind === "wrong month") s.records.balances[0].month = "2026-08";
    if (kind === "invalid amount") s.records.balances[0].balance = 0.5;
    if (kind === "wrong cash month") s.records.cash!.month = "2026-08";
    if (kind === "too many accounts")
      s.accounts = Array.from({ length: 101 }, (_, i) => ({ ...s.accounts[0], id: String(i) }));
    expect(() => monthlyMetrics(s)).toThrow();
  });
});
