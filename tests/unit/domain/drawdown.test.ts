import { expect, it } from "vitest";
import {
  projectDrawdown,
  type DrawdownAssumptions,
  type DrawdownStart,
} from "../../../src/domain/drawdown";
import { projectGoal } from "../../../src/domain/goal-fire";
const start: DrawdownStart = { cash: 1200, nisa: 0, taxable: 0, taxableCost: 0n };
const settings: DrawdownAssumptions = {
  monthlySpending: 100,
  monthlyIncome: 0,
  incomeStartMonth: 1,
  years: 1,
  returnBps: 0,
  inflationBps: 0,
  taxRate: 20315,
};
it("funds exactly twelve months and distinguishes a shortfall on the next month", () => {
  expect(projectDrawdown(start, settings)).toMatchObject({ status: "funded", stoppedMonth: null });
  const longer = projectDrawdown(start, { ...settings, years: 2 });
  expect(longer).toMatchObject({ status: "shortfall", stoppedMonth: 13, shortfall: 100 });
  expect(longer.points.at(-1)).toMatchObject({ month: 13, total: 0, spendingPaid: 1200 });
});
it("uses cash before shares and records a partial final payment", () => {
  const r = projectDrawdown({ ...start, cash: 150, nisa: 100 }, settings);
  expect(r).toMatchObject({ status: "shortfall", stoppedMonth: 3, shortfall: 50 });
  expect(r.points.at(-1)).toMatchObject({
    cash: 0,
    nisa: 0,
    total: 0,
    spendingPaid: 250,
    taxPaid: 0,
  });
});
it("grosses up tax and reduces remaining basis after each sale", () => {
  const r = projectDrawdown(
    { cash: 0, nisa: 0, taxable: 1000, taxableCost: 500n },
    { ...settings, taxRate: 20000 },
  );
  // Nine 111-yen sales each pay 11 yen tax; the final 1-yen sale rounds tax to zero.
  expect(r).toMatchObject({ status: "shortfall", stoppedMonth: 10, shortfall: 99 });
  expect(r.points.at(-1)).toMatchObject({ total: 0, spendingPaid: 901, taxPaid: 99 });
});
it("allocates proportional stock sales and handles a 100 percent gain tax", () => {
  const r = projectDrawdown(
    { cash: 0, nisa: 100, taxable: 100, taxableCost: 0n },
    { ...settings, taxRate: 100000 },
  );
  expect(r).toMatchObject({ status: "shortfall", stoppedMonth: 2, shortfall: 100 });
  expect(r.points.at(-1)).toMatchObject({ spendingPaid: 100, taxPaid: 100, total: 0 });
});
it("stops only when unknown basis is needed, and reports the last paid month", () => {
  const r = projectDrawdown({ cash: 150, nisa: 0, taxable: 1000, taxableCost: null }, settings);
  expect(r).toMatchObject({ status: "unknown-cost", stoppedMonth: 2 });
  expect(r.points.at(-1)).toMatchObject({ month: 1, cash: 50, taxable: 1000, spendingPaid: 100 });
  expect(
    projectDrawdown(
      { cash: 0, nisa: 0, taxable: 1200, taxableCost: null },
      { ...settings, taxRate: 0 },
    ).status,
  ).toBe("funded");
});
it("grows stocks before selling, and increases spending from the second month", () => {
  const growing = projectDrawdown(
    { ...start, cash: 0, nisa: 10000 },
    { ...settings, monthlySpending: 0, returnBps: 1200 },
  );
  expect(growing.points.at(-1)?.nisa).toBe(11267);
  const r = projectDrawdown({ ...start, cash: 201 }, { ...settings, inflationBps: 1200 });
  expect(r).toMatchObject({ status: "shortfall", stoppedMonth: 3, shortfall: 102 });
  expect(r.points.at(-1)?.spendingPaid).toBe(201);
});
it("keeps loss sales tax free and never mutates input", () => {
  const original = { cash: 0, nisa: 0, taxable: 1200, taxableCost: 2400n };
  expect(projectDrawdown(original, settings).points.at(-1)).toMatchObject({
    total: 0,
    taxPaid: 0,
    spendingPaid: 1200,
  });
  expect(original.taxableCost).toBe(2400n);
});
it("bounds a century to 101 points and stops before unsafe values", () => {
  expect(
    projectDrawdown(start, { ...settings, monthlySpending: 0, years: 100 }).points,
  ).toHaveLength(101);
  const r = projectDrawdown(
    { ...start, cash: 0, nisa: Number.MAX_SAFE_INTEGER },
    { ...settings, returnBps: 10000 },
  );
  expect(r).toMatchObject({ status: "overflow", stoppedMonth: 1 });
  expect(r.points).toHaveLength(1);
});
it.each([
  { monthlyIncome: -1 },
  { monthlyIncome: 0.5 },
  { incomeStartMonth: 0 },
  { incomeStartMonth: 1201 },
  { incomeStartMonth: 1.5 },
  { years: 0 },
  { years: 101 },
  { years: 1.5 },
  { monthlySpending: -1 },
  { inflationBps: 10001 },
  { returnBps: -9901 },
  { taxRate: 100001 },
])("rejects invalid settings %o", (invalid) => {
  expect(() => projectDrawdown(start, { ...settings, ...invalid })).toThrow();
});
it("receives fixed net income at the start month and keeps the surplus in cash", () => {
  const r = projectDrawdown(
    { ...start, cash: 100 },
    { ...settings, monthlyIncome: 150, incomeStartMonth: 2 },
  );
  expect(r.status).toBe("funded");
  expect(r.points.at(-1)).toMatchObject({
    cash: 550,
    incomeReceived: 1650,
    spendingPaid: 1200,
    taxPaid: 0,
  });
  expect(
    projectDrawdown({ ...start, cash: 0 }, { ...settings, monthlyIncome: 100 }).points.at(-1),
  ).toMatchObject({ total: 0, incomeReceived: 1200, spendingPaid: 1200 });
});
it("does not borrow future income and handles income after the horizon", () => {
  expect(
    projectDrawdown(
      { ...start, cash: 50 },
      { ...settings, monthlyIncome: 100, incomeStartMonth: 2 },
    ),
  ).toMatchObject({ status: "shortfall", stoppedMonth: 1, shortfall: 50 });
  expect(
    projectDrawdown(start, { ...settings, monthlyIncome: 100, incomeStartMonth: 13 }).points.at(-1)
      ?.incomeReceived,
  ).toBe(0);
});
it("offsets spending before taxable sales and does not infer unknown basis", () => {
  const taxable = { cash: 0, nisa: 0, taxable: 1000, taxableCost: 500n };
  const paid = projectDrawdown(taxable, { ...settings, monthlyIncome: 50, taxRate: 20000 });
  expect(paid.status).toBe("funded");
  expect(paid.points.at(-1)?.spendingPaid).toBe(1200);
  expect(paid.points.at(-1)?.incomeReceived).toBe(600);
  // Each month sells 56 yen (28 yen gain), pays 6 yen tax, and receives 50 yen.
  expect(paid.points.at(-1)).toMatchObject({ taxPaid: 72, taxable: 328, total: 328 });
  expect(
    projectDrawdown({ ...taxable, taxableCost: null }, { ...settings, monthlyIncome: 100 }).status,
  ).toBe("funded");
  const unknown = projectDrawdown(
    { ...taxable, taxableCost: null },
    { ...settings, monthlyIncome: 50 },
  );
  expect(unknown.status).toBe("unknown-cost");
  expect(unknown.points.at(-1)).toMatchObject({ month: 0, incomeReceived: 0, spendingPaid: 0 });
});
it("inflates spending but keeps income nominal and bounds income overflow", () => {
  expect(
    projectDrawdown({ ...start, cash: 0 }, { ...settings, monthlyIncome: 100, inflationBps: 1200 }),
  ).toMatchObject({ stoppedMonth: 2, shortfall: 1 });
  const r = projectDrawdown(
    { ...start, cash: Number.MAX_SAFE_INTEGER },
    { ...settings, monthlyIncome: 1 },
  );
  expect(r).toMatchObject({ status: "overflow", stoppedMonth: 1 });
  expect(r.points.at(-1)?.incomeReceived).toBe(0);
  const cumulative = projectDrawdown(
    { ...start, cash: 0 },
    {
      ...settings,
      monthlySpending: Number.MAX_SAFE_INTEGER,
      monthlyIncome: Number.MAX_SAFE_INTEGER,
    },
  );
  expect(cumulative).toMatchObject({ status: "overflow", stoppedMonth: 2 });
  expect(cumulative.points.at(-1)?.incomeReceived).toBe(Number.MAX_SAFE_INTEGER);
});
it("receives the accumulated basis at the exact goal month", () => {
  const goal = projectGoal({
    startMonth: "2026-09",
    cash: 0,
    tsumitate: 0,
    growth: 0,
    taxable: 1000,
    taxableCost: 500,
    monthlyCash: 0,
    monthlyInvestment: 100,
    target: 1200,
    returnBps: 0,
    withdrawalBps: 300,
    usedTotal: 18000000,
    usedGrowth: 0,
    usedYearTsumitate: 0,
    usedYearGrowth: 0,
  });
  expect(goal.taxableCostAtGoal).toBe(700n);
  expect(goal.reached?.month).toBe(2);
});
