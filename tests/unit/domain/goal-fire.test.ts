import { describe, expect, it } from "vitest";
import { projectGoal, goalSeed, type GoalAssumptions } from "../../../src/domain/goal-fire";
const base: GoalAssumptions = {
  startMonth: "2026-09",
  cash: 0,
  tsumitate: 0,
  growth: 0,
  taxable: 0,
  monthlyCash: 0,
  monthlyInvestment: 0,
  target: 50000000,
  returnBps: 0,
  withdrawalBps: 300,
  usedTotal: 0,
  usedGrowth: 0,
  usedYearTsumitate: 0,
  usedYearGrowth: 0,
};
describe("goal-driven FIRE", () => {
  it("finds the exact month and excludes cash from self-dividends", () => {
    const r = projectGoal({
      ...base,
      cash: 10000000,
      taxable: 39000000,
      monthlyCash: 100000,
      monthlyInvestment: 100000,
    });
    expect(r.reached).toMatchObject({
      month: 5,
      total: 50000000,
      cash: 10500000,
      tsumitate: 500000,
      taxable: 39000000,
    });
    expect(r.annualWithdrawal).toBe(1185000);
    expect(r.monthlyWithdrawal).toBe(98750);
  });
  it("recognizes an already reached target without future contributions", () => {
    const r = projectGoal({ ...base, cash: 50000000 });
    expect(r.reached?.month).toBe(0);
    expect(r.points).toHaveLength(1);
    expect(r.annualWithdrawal).toBe(0);
  });
  it("uses annual tsumitate then growth then taxable limits", () => {
    const r = projectGoal({ ...base, monthlyInvestment: 4000000, target: 4000000 });
    expect(r.reached).toMatchObject({ tsumitate: 1200000, growth: 2400000, taxable: 400000 });
  });
  it("resets calendar-year capacity in January", () => {
    const r = projectGoal({
      ...base,
      startMonth: "2026-11",
      monthlyInvestment: 100000,
      target: 200000,
      usedYearTsumitate: 1200000,
      usedYearGrowth: 2400000,
    });
    expect(r.reached).toMatchObject({ month: 2, taxable: 100000, tsumitate: 100000 });
  });
  it("checks lifetime acquisition cost, not market value", () => {
    const r = projectGoal({
      ...base,
      tsumitate: 30000000,
      usedTotal: 17999999,
      usedGrowth: 12000000,
      monthlyInvestment: 100,
      target: 30000100,
    });
    expect(r.reached).toMatchObject({ tsumitate: 30000001, taxable: 99, growth: 0 });
  });
  it("honors the growth lifetime sublimit even with total capacity", () => {
    const r = projectGoal({
      ...base,
      usedTotal: 12000000,
      usedGrowth: 12000000,
      usedYearTsumitate: 1200000,
      monthlyInvestment: 100,
      target: 100,
    });
    expect(r.reached?.taxable).toBe(100);
  });
  it("keeps new growth inside remaining lifetime capacity", () => {
    const r = projectGoal({
      ...base,
      usedTotal: 17999950,
      usedGrowth: 11000000,
      usedYearTsumitate: 1200000,
      monthlyInvestment: 100,
      target: 100,
    });
    expect(r.reached).toMatchObject({ growth: 50, taxable: 50 });
  });
  it("rounds monthly stock returns before contributions and leaves cash unchanged", () => {
    const r = projectGoal({ ...base, cash: 100, taxable: 100, returnBps: 600, target: 201 });
    expect(r.reached).toMatchObject({ month: 1, cash: 100, taxable: 101 });
  });
  it("supports falling stock prices and bounded nonarrival", () => {
    const r = projectGoal({ ...base, taxable: 1000000, returnBps: -9900 });
    expect(r.reached).toBeNull();
    expect(r.points).toHaveLength(101);
    expect(r.points.at(-1)?.month).toBe(1200);
  });
  it("stops on cash shortfall rather than inventing a sale", () => {
    const r = projectGoal({ ...base, cash: 100, taxable: 1000000, monthlyCash: -60 });
    expect(r.stopped).toBe("cash-shortfall");
    expect(r.stoppedMonth).toBe(2);
    expect(r.reached).toBeNull();
  });
  it("rejects unsafe starting sums and stops on growth overflow", () => {
    expect(() => projectGoal({ ...base, cash: Number.MAX_SAFE_INTEGER, taxable: 1 })).toThrow();
    const r = projectGoal({
      ...base,
      taxable: Number.MAX_SAFE_INTEGER - 1,
      target: Number.MAX_SAFE_INTEGER,
      returnBps: 10000,
    });
    expect(r.stopped).toBe("overflow");
    expect(r.reached).toBeNull();
  });
  it.each([
    { usedTotal: 18000001 },
    { usedGrowth: 1 },
    { usedYearTsumitate: 1200001 },
    { usedYearGrowth: 2400001 },
    { withdrawalBps: -1 },
    { target: 0 },
    { monthlyInvestment: -1 },
  ])("rejects invalid assumptions %o", (invalid) => {
    expect(() => projectGoal({ ...base, ...invalid })).toThrow();
  });
  it("never infers missing balances or monthly history", () => {
    expect(() =>
      goalSeed({ current: { accounts: [], balances: [] }, latest: null, months: [] }, "2026-09"),
    ).toThrow();
  });
});
