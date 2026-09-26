import { expect, it } from "vitest";
import { projectGoal, type GoalAssumptions } from "../../../src/domain/goal-fire";
import { parseTaxRate } from "../../../src/domain/withdrawal";
const base: GoalAssumptions = {
  startMonth: "2026-09",
  cash: 0,
  tsumitate: 0,
  growth: 0,
  taxable: 10000000,
  monthlyCash: 0,
  monthlyInvestment: 0,
  target: 1,
  returnBps: 0,
  withdrawalBps: 300,
  usedTotal: 0,
  usedGrowth: 0,
  usedYearTsumitate: 0,
  usedYearGrowth: 0,
  taxableCost: 5000000,
  taxRate: 20315,
};
it("taxes only the proportional profit and rounds annual/monthly independently", () => {
  const result = projectGoal(base);
  expect(result.annualNetWithdrawal).toEqual({
    gross: 300000,
    nisaSale: 0,
    taxableSale: 300000,
    taxableGain: 150000,
    tax: 30473,
    net: 269527,
  });
  expect(result.monthlyNetWithdrawal).toEqual({
    gross: 25000,
    nisaSale: 0,
    taxableSale: 25000,
    taxableGain: 12500,
    tax: 2539,
    net: 22461,
  });
});
it("allocates sales between NISA and taxable stocks, excluding cash", () => {
  const result = projectGoal({ ...base, cash: 9000000, tsumitate: 6000000, growth: 4000000 });
  expect(result.annualNetWithdrawal).toEqual({
    gross: 600000,
    nisaSale: 300000,
    taxableSale: 300000,
    taxableGain: 150000,
    tax: 30473,
    net: 569527,
  });
});
it("adds only taxable purchases to cost without growing the cost basis", () => {
  const r = projectGoal({
    ...base,
    taxable: 1000000,
    taxableCost: 500000,
    monthlyInvestment: 1000000,
    target: 2000000,
    usedTotal: 18000000,
  });
  expect(r.reached?.month).toBe(1);
  expect(r.annualNetWithdrawal).toMatchObject({
    gross: 60000,
    taxableGain: 15000,
    tax: 3047,
    net: 56953,
  });
  const growing = projectGoal({
    ...base,
    taxable: 1000000,
    taxableCost: 500000,
    returnBps: 1200,
    target: 1010000,
  });
  expect(growing.annualNetWithdrawal).toMatchObject({
    gross: 30300,
    taxableGain: 15300,
    tax: 3108,
  });
});
it("does not infer an unknown existing basis, but knows the basis of new purchases", () => {
  expect(projectGoal({ ...base, taxableCost: null }).annualNetWithdrawal).toMatchObject({
    net: null,
    tax: null,
    taxableGain: null,
    gross: 300000,
  });
  const r = projectGoal({
    ...base,
    taxable: 0,
    taxableCost: null,
    monthlyInvestment: 4000000,
    target: 4000000,
  });
  expect(r.annualNetWithdrawal).toMatchObject({
    nisaSale: 108000,
    taxableSale: 12000,
    taxableGain: 0,
    tax: 0,
    net: 120000,
  });
});
it("handles loss, zero basis, no stocks, zero withdrawal and zero/full tax rates", () => {
  expect(projectGoal({ ...base, taxableCost: 20000000 }).annualNetWithdrawal?.tax).toBe(0);
  expect(projectGoal({ ...base, taxableCost: 0 }).annualNetWithdrawal?.tax).toBe(60945);
  expect(
    projectGoal({ ...base, taxable: 0, taxableCost: null, cash: 1 }).annualNetWithdrawal?.net,
  ).toBe(0);
  expect(
    projectGoal({ ...base, taxableCost: null, withdrawalBps: 0 }).annualNetWithdrawal?.net,
  ).toBe(0);
  expect(projectGoal({ ...base, taxableCost: null, taxRate: 0 }).annualNetWithdrawal).toMatchObject(
    { net: 300000, taxableGain: null },
  );
  expect(
    projectGoal({ ...base, taxableCost: 0, taxRate: 100000, withdrawalBps: 10000 })
      .annualNetWithdrawal?.net,
  ).toBe(0);
  expect(
    projectGoal({ ...base, taxable: 0, taxableCost: null, growth: 10000000 }).annualNetWithdrawal
      ?.net,
  ).toBe(300000);
});
it("keeps safe integer and bounded nonarrival behavior", () => {
  const r = projectGoal({
    ...base,
    taxable: Number.MAX_SAFE_INTEGER,
    taxableCost: 0,
    withdrawalBps: 10000,
  });
  expect(r.annualNetWithdrawal?.gross).toBe(Number.MAX_SAFE_INTEGER);
  expect(Number.isSafeInteger(r.annualNetWithdrawal?.net)).toBe(true);
  expect(projectGoal({ ...base, target: 20000000 }).annualNetWithdrawal).toBeNull();
});
it("keeps allocation totals exact at rounding boundaries and large accumulated basis", () => {
  const small = projectGoal({
    ...base,
    taxable: 1,
    tsumitate: 2,
    taxableCost: 0,
    withdrawalBps: 5000,
    taxRate: 100000,
  });
  expect(small.annualNetWithdrawal).toEqual({
    gross: 2,
    nisaSale: 1,
    taxableSale: 1,
    taxableGain: 1,
    tax: 1,
    net: 1,
  });
  const large = projectGoal({
    ...base,
    taxable: 1,
    taxableCost: Number.MAX_SAFE_INTEGER,
    target: 10000001,
    monthlyInvestment: 10000000,
    usedTotal: 18000000,
  });
  expect(large.reached?.month).toBe(1);
  expect(large.annualNetWithdrawal).toMatchObject({ taxableGain: 0, tax: 0, net: 300000 });
});
it.each([
  { taxableCost: -1 },
  { taxableCost: 0.5 },
  { taxableCost: Number.MAX_SAFE_INTEGER + 1 },
  { taxRate: -1 },
  { taxRate: 100001 },
  { taxRate: 20.315 },
  { taxable: 0, taxableCost: 1 },
])("rejects invalid tax assumptions %o", (invalid) => {
  expect(() => projectGoal({ ...base, ...invalid })).toThrow();
});
it("parses thousandths of a percent exactly", () => {
  expect(parseTaxRate("20.315")).toBe(20315);
  expect(parseTaxRate("0.001")).toBe(1);
  expect(parseTaxRate("100")).toBe(100000);
  for (const invalid of ["", "-1", "20.3151", "100.001", "1e1", " 20", "NaN"])
    expect(() => parseTaxRate(invalid)).toThrow();
});
