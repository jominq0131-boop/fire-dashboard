import { estimateWithdrawal } from "./withdrawal";

export interface DrawdownStart {
  cash: number;
  nisa: number;
  taxable: number;
  taxableCost: bigint | null;
}
export interface DrawdownAssumptions {
  monthlySpending: number;
  monthlyIncome: number;
  incomeStartMonth: number;
  years: number;
  returnBps: number;
  inflationBps: number;
  taxRate: number;
}
export interface DrawdownPoint {
  month: number;
  cash: number;
  nisa: number;
  taxable: number;
  total: number;
  spending: number;
  taxPaid: number;
  spendingPaid: number;
  incomeReceived: number;
}
export interface DrawdownResult {
  status: "funded" | "shortfall" | "unknown-cost" | "overflow";
  stoppedMonth: number | null;
  shortfall: number;
  points: DrawdownPoint[];
}
const max = BigInt(Number.MAX_SAFE_INTEGER);
const round = (n: bigint, d: bigint) => (n + d / 2n) / d;
const money = (n: number) => Number.isSafeInteger(n) && n >= 0;

/** Fixed net income joins cash before spending, then proportional stock sales cover any gap. */
export function projectDrawdown(start: DrawdownStart, s: DrawdownAssumptions): DrawdownResult {
  if (
    ![start.cash, start.nisa, start.taxable, s.monthlySpending, s.monthlyIncome].every(money) ||
    !Number.isInteger(s.incomeStartMonth) ||
    s.incomeStartMonth < 1 ||
    s.incomeStartMonth > 1200 ||
    (start.taxableCost !== null &&
      (typeof start.taxableCost !== "bigint" ||
        start.taxableCost < 0n ||
        start.taxableCost > max * 1201n)) ||
    !Number.isInteger(s.years) ||
    s.years < 1 ||
    s.years > 100 ||
    ![s.returnBps, s.inflationBps].every((n) => Number.isInteger(n) && n >= -9900 && n <= 10000) ||
    !Number.isInteger(s.taxRate) ||
    s.taxRate < 0 ||
    s.taxRate > 100000
  )
    throw new Error("인출 금액·소득·지급 시작 월(1~1200)·기간(1~100년)·비율을 확인해 주세요.");
  let cash = BigInt(start.cash),
    nisa = BigInt(start.nisa),
    taxable = BigInt(start.taxable);
  if (cash + nisa + taxable > max) throw new Error("시작 자산이 계산 범위를 초과합니다.");
  let cost = start.taxableCost;
  let spending = BigInt(s.monthlySpending),
    taxPaid = 0n,
    spendingPaid = 0n,
    incomeReceived = 0n;
  const point = (month: number): DrawdownPoint => ({
    month,
    cash: Number(cash),
    nisa: Number(nisa),
    taxable: Number(taxable),
    total: Number(cash + nisa + taxable),
    spending: Number(spending),
    taxPaid: Number(taxPaid),
    spendingPaid: Number(spendingPaid),
    incomeReceived: Number(incomeReceived),
  });
  let last = point(0);
  const result: DrawdownResult = {
    status: "funded",
    stoppedMonth: null,
    shortfall: 0,
    points: [last],
  };
  const stop = (status: DrawdownResult["status"], month: number) => {
    result.status = status;
    result.stoppedMonth = month;
    if (result.points.at(-1)!.month !== last.month) result.points.push(last);
    return result;
  };
  for (let month = 1; month <= s.years * 12; month++) {
    const need =
      month === 1 ? spending : round(spending * BigInt(120000 + s.inflationBps), 120000n);
    const grownNisa = round(nisa * BigInt(120000 + s.returnBps), 120000n);
    const grownTaxable = round(taxable * BigInt(120000 + s.returnBps), 120000n);
    const stocks = grownNisa + grownTaxable;
    const income = month >= s.incomeStartMonth ? BigInt(s.monthlyIncome) : 0n;
    const availableCash = cash + income;
    if (need > max || availableCash + stocks > max || incomeReceived + income > max)
      return stop("overflow", month);
    const fromCash = availableCash < need ? availableCash : need;
    const remaining = need - fromCash;
    let gross = 0n,
      tax = 0n,
      received = 0n,
      soldTaxable = 0n;
    if (remaining > 0n && stocks > 0n) {
      // An unknown tax basis cannot be silently treated as a zero-gain sale.
      if (grownTaxable > 0n && cost === null && s.taxRate > 0) return stop("unknown-cost", month);
      const estimate = (sale: bigint) =>
        estimateWithdrawal(Number(sale), stocks, grownTaxable, cost, s.taxRate);
      const available = BigInt(estimate(stocks).net!);
      if (available < remaining) gross = stocks;
      else {
        let low = 0n,
          high = stocks;
        // Safe yen bounds require at most 53 binary-search steps per month.
        while (low < high) {
          const mid = (low + high) / 2n;
          if (BigInt(estimate(mid).net!) >= remaining) high = mid;
          else low = mid + 1n;
        }
        gross = low;
      }
      const sale = estimate(gross);
      tax = BigInt(sale.tax!);
      received = BigInt(sale.net!);
      soldTaxable = BigInt(sale.taxableSale);
    }
    const paid = fromCash + received;
    if (taxPaid + tax > max || spendingPaid + paid > max) return stop("overflow", month);
    cash = availableCash - fromCash;
    incomeReceived += income;
    nisa = grownNisa - (gross - soldTaxable);
    taxable = grownTaxable - soldTaxable;
    if (soldTaxable > 0n && cost !== null) cost -= round(cost * soldTaxable, grownTaxable);
    if (taxable === 0n) cost = 0n;
    taxPaid += tax;
    spendingPaid += paid;
    spending = need;
    last = point(month);
    if (month % 12 === 0) result.points.push(last);
    if (paid < need) {
      result.shortfall = Number(need - paid);
      return stop("shortfall", month);
    }
  }
  return result;
}
