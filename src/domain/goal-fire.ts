import { assertMonth } from "./monthly";
import { currentTotal } from "./observations";
import { monthlyMetrics } from "./metrics";
import type { PortfolioOverview } from "./portfolio";
import { estimateWithdrawal, type WithdrawalEstimate } from "./withdrawal";

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
  taxableCost?: number | null;
  taxRate?: number;
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
  annualNetWithdrawal: WithdrawalEstimate | null;
  monthlyNetWithdrawal: WithdrawalEstimate | null;
  taxableCostAtGoal: bigint | null;
}
const max = BigInt(Number.MAX_SAFE_INTEGER);
const money = (n: number) => Number.isSafeInteger(n) && n >= 0;
const round = (n: bigint, denominator: bigint) => (n + denominator / 2n) / denominator;

/** No sales during accumulation. Existing cash is retained; new purchases use both eligible NISA buckets first. */
export function projectGoal(s: GoalAssumptions): GoalResult {
  assertMonth(s.startMonth);
  const taxRate = s.taxRate ?? 20315;
  if (
    (s.taxableCost != null && !money(s.taxableCost)) ||
    !Number.isInteger(taxRate) ||
    taxRate < 0 ||
    taxRate > 100000
  )
    throw new Error("과세 계좌의 취득원가·가정 세율을 확인해 주세요.");
  if (s.taxable === 0 && s.taxableCost != null && s.taxableCost !== 0)
    throw new Error("과세 계좌 평가액이 0엔이면 취득원가는 0엔 또는 빈칸으로 입력해 주세요.");
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
    throw new Error("금액·목표·비율을 확인해 주세요.");
  if (
    s.usedTotal > 18000000 ||
    s.usedGrowth > 12000000 ||
    s.usedGrowth > s.usedTotal ||
    s.usedYearTsumitate > 1200000 ||
    s.usedYearGrowth > 2400000
  )
    throw new Error(
      "NISA 사용액이 제도상 한도를 초과합니다. 취득원가와 올해 매수액을 확인해 주세요.",
    );
  let cash = BigInt(s.cash),
    tsumitate = BigInt(s.tsumitate),
    growth = BigInt(s.growth),
    taxable = BigInt(s.taxable);
  if (cash + tsumitate + growth + taxable > max)
    throw new Error("시작 자산이 안전한 정수 범위를 초과합니다.");
  let usedTotal = s.usedTotal,
    usedGrowth = s.usedGrowth;
  let yearT = s.usedYearTsumitate,
    yearG = s.usedYearGrowth;
  let taxableCost = s.taxableCost == null ? (s.taxable === 0 ? 0n : null) : BigInt(s.taxableCost);
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
    annualNetWithdrawal: null,
    monthlyNetWithdrawal: null,
    taxableCostAtGoal: null,
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
    if (taxableCost !== null) taxableCost += BigInt(s.monthlyInvestment - t - g);
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
    result.taxableCostAtGoal = taxableCost;
    const stocks =
      BigInt(result.reached.tsumitate) +
      BigInt(result.reached.growth) +
      BigInt(result.reached.taxable);
    result.annualWithdrawal = Number(round(stocks * BigInt(s.withdrawalBps), 10000n));
    result.monthlyWithdrawal = Number(round(stocks * BigInt(s.withdrawalBps), 120000n));
    result.annualNetWithdrawal = estimateWithdrawal(
      result.annualWithdrawal,
      stocks,
      taxable,
      taxableCost,
      taxRate,
    );
    result.monthlyNetWithdrawal = estimateWithdrawal(
      result.monthlyWithdrawal,
      stocks,
      taxable,
      taxableCost,
      taxRate,
    );
  }
  return result;
}

/** Only already bounded overview records; missing months never count as zero savings. */
export function goalSeed(overview: PortfolioOverview, currentMonth: string) {
  assertMonth(currentMonth);
  const total = currentTotal(overview.current);
  if (typeof total !== "number")
    throw new Error("사용할 수 있는 잔액이 없습니다. 현재 자산을 입력해 주세요.");
  if (overview.months.length > 12) throw new Error("참조할 수 있는개월 수를 초과합니다.");
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
      throw new Error("월별 수입·지출 계산 범위를 초과합니다.");
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
