import { assertMonth } from "./monthly";
import { currentTotal } from "./observations";
import { monthlyMetrics } from "./metrics";
import type { PortfolioOverview } from "./portfolio";

export interface GoalAssumptions {
  startMonth: string;
  cash: number;
  tsumitate: number;
  growth: number;
  taxable: number;
  monthlyCash: number;
  monthlyInvestment: number;
  target: number;
  returnBps: number;
  withdrawalBps: number;
  usedTotal: number;
  usedGrowth: number;
  usedYearTsumitate: number;
  usedYearGrowth: number;
}
export interface GoalPoint {
  month: number;
  cash: number;
  tsumitate: number;
  growth: number;
  taxable: number;
  total: number;
}
export interface GoalResult {
  points: GoalPoint[];
  reached: GoalPoint | null;
  stopped: "overflow" | "cash-shortfall" | null;
  stoppedMonth: number | null;
  annualWithdrawal: number | null;
  monthlyWithdrawal: number | null;
}
const max = BigInt(Number.MAX_SAFE_INTEGER);
const money = (n: number) => Number.isSafeInteger(n) && n >= 0;
const round = (n: bigint, denominator: bigint) => (n + denominator / 2n) / denominator;

/** No sales during accumulation. Existing cash is retained; new purchases use both eligible NISA buckets first. */
export function projectGoal(s: GoalAssumptions): GoalResult {
  assertMonth(s.startMonth);
  const amounts = [
    s.cash,
    s.tsumitate,
    s.growth,
    s.taxable,
    s.monthlyInvestment,
    s.target,
    s.usedTotal,
    s.usedGrowth,
    s.usedYearTsumitate,
    s.usedYearGrowth,
  ];
  if (
    !amounts.every(money) ||
    !Number.isSafeInteger(s.monthlyCash) ||
    s.target === 0 ||
    !Number.isInteger(s.returnBps) ||
    s.returnBps < -9900 ||
    s.returnBps > 10000 ||
    !Number.isInteger(s.withdrawalBps) ||
    s.withdrawalBps < 0 ||
    s.withdrawalBps > 10000
  )
    throw new Error("金額・目標・率を確認してください。");
  if (
    s.usedTotal > 18000000 ||
    s.usedGrowth > 12000000 ||
    s.usedGrowth > s.usedTotal ||
    s.usedYearTsumitate > 1200000 ||
    s.usedYearGrowth > 2400000
  )
    throw new Error(
      "NISAの利用額が制度上限を超えています。取得額と今年の買付額を確認してください。",
    );
  let cash = BigInt(s.cash),
    tsumitate = BigInt(s.tsumitate),
    growth = BigInt(s.growth),
    taxable = BigInt(s.taxable);
  if (cash + tsumitate + growth + taxable > max)
    throw new Error("開始資産が安全な整数範囲を超えています。");
  let usedTotal = s.usedTotal,
    usedGrowth = s.usedGrowth;
  let yearT = s.usedYearTsumitate,
    yearG = s.usedYearGrowth;
  const point = (month: number): GoalPoint => ({
    month,
    cash: Number(cash),
    tsumitate: Number(tsumitate),
    growth: Number(growth),
    taxable: Number(taxable),
    total: Number(cash + tsumitate + growth + taxable),
  });
  const first = point(0);
  const result: GoalResult = {
    points: [first],
    reached: first.total >= s.target ? first : null,
    stopped: null,
    stoppedMonth: null,
    annualWithdrawal: null,
    monthlyWithdrawal: null,
  };
  const grow = (n: bigint) => round(n * BigInt(120000 + s.returnBps), 120000n);
  for (let month = 1; month <= 1200 && !result.reached; month++) {
    // Month zero is the current month; first contribution is the following month.
    if ((Number(s.startMonth.slice(5)) - 1 + month) % 12 === 0) {
      yearT = 0;
      yearG = 0;
    }
    const t = Math.min(s.monthlyInvestment, 1200000 - yearT, 18000000 - usedTotal);
    const g = Math.min(
      s.monthlyInvestment - t,
      2400000 - yearG,
      12000000 - usedGrowth,
      18000000 - usedTotal - t,
    );
    cash += BigInt(s.monthlyCash);
    tsumitate = grow(tsumitate) + BigInt(t);
    growth = grow(growth) + BigInt(g);
    taxable = grow(taxable) + BigInt(s.monthlyInvestment - t - g);
    usedTotal += t + g;
    usedGrowth += g;
    yearT += t;
    yearG += g;
    if (cash < 0n || cash + tsumitate + growth + taxable > max) {
      result.stopped = cash < 0n ? "cash-shortfall" : "overflow";
      result.stoppedMonth = month;
      break;
    }
    const p = point(month);
    if (p.total >= s.target) result.reached = p;
    // Includes exact arrival and at most 101 samples (0 + annual samples + arrival).
    if (month % 12 === 0 || result.reached) result.points.push(p);
  }
  if (result.reached) {
    const stocks =
      BigInt(result.reached.tsumitate) +
      BigInt(result.reached.growth) +
      BigInt(result.reached.taxable);
    result.annualWithdrawal = Number(round(stocks * BigInt(s.withdrawalBps), 10000n));
    result.monthlyWithdrawal = Number(round(stocks * BigInt(s.withdrawalBps), 120000n));
  }
  return result;
}

/** Only already bounded overview records; missing months never count as zero savings. */
export function goalSeed(overview: PortfolioOverview, currentMonth: string) {
  assertMonth(currentMonth);
  const total = currentTotal(overview.current);
  if (typeof total !== "number")
    throw new Error("利用できる残高がありません。現在の資産を入力してください。");
  if (overview.months.length > 12) throw new Error("参照月数の上限を超えています。");
  const balances = { cash: 0, tsumitate: 0, growth: 0, taxable: 0 };
  let other = 0;
  for (const b of overview.current.balances) {
    const category = overview.current.accounts.find((a) => a.id === b.accountId)!.category;
    if (category === "other") other += b.balance;
    else
      balances[
        category === "nisa_tsumitate"
          ? "tsumitate"
          : category === "nisa_growth"
            ? "growth"
            : category
      ] += b.balance;
  }
  const months = overview.months.filter((m) => m.month < currentMonth && m.records.cash);
  let cash = 0n,
    investment = 0n;
  for (const m of months) {
    const metrics = monthlyMetrics(m);
    if (
      typeof metrics.remainingCash !== "number" ||
      typeof metrics.investmentContribution !== "number"
    )
      throw new Error("月別収支の計算範囲を超えています。");
    cash += BigInt(metrics.remainingCash);
    investment += BigInt(metrics.investmentContribution);
  }
  const mean = (n: bigint) =>
    Number(n < 0n ? -round(-n, BigInt(months.length)) : round(n, BigInt(months.length)));
  return {
    ...balances,
    other,
    missing: overview.current.accounts.length - overview.current.balances.length,
    months: months.map((m) => m.month),
    monthlyCash: months.length ? mean(cash) : null,
    monthlyInvestment: months.length ? mean(investment) : null,
  };
}
