import { assertMonth } from "./monthly";
import { monthlyMetrics, type MetricsSource, type MetricAmount } from "./metrics";

export const HISTORY_MONTHS = 12;
export function localMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
export function shiftMonth(month: string, offset: number) {
  assertMonth(month);
  if (!Number.isInteger(offset)) throw new Error("Invalid month offset");
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + m - 1 + offset;
  const result = `${Math.floor(index / 12)}-${String((((index % 12) + 12) % 12) + 1).padStart(2, "0")}`;
  assertMonth(result);
  return result;
}
export function historyMonths(end: string) {
  assertMonth(end);
  const months = [end];
  while (months.length < HISTORY_MONTHS && months[0] > "1900-01")
    months.unshift(shiftMonth(months[0], -1));
  return months;
}
export interface PortfolioOverview {
  latest: MetricsSource | null;
  months: MetricsSource[];
}
export interface PortfolioRepository {
  readOverview(asOf: string, end?: string): Promise<PortfolioOverview>;
}
export function monthChange(
  previous: MetricsSource | undefined,
  current: MetricsSource,
): { delta: MetricAmount; percent: number | null } {
  if (!previous || previous.month === "2199-12" || shiftMonth(previous.month, 1) !== current.month)
    return { delta: null, percent: null };
  const ids = (source: MetricsSource) =>
    JSON.stringify(source.records.balances.map((b) => b.accountId).sort());
  const a = monthlyMetrics(previous).assets,
    b = monthlyMetrics(current).assets;
  if (typeof a !== "number" || typeof b !== "number" || ids(previous) !== ids(current))
    return { delta: null, percent: null };
  const delta = b - a;
  // Rounded to one decimal percent using integer arithmetic; zero has no rate.
  const signed = BigInt(b) - BigInt(a);
  const magnitude = signed < 0n ? -signed : signed;
  const tenths = a === 0 ? null : (magnitude * 1000n + BigInt(a) / 2n) / BigInt(a);
  const percent =
    tenths === null || tenths > BigInt(Number.MAX_SAFE_INTEGER)
      ? null
      : (Number(tenths) / 10) * (signed < 0n ? -1 : 1);
  return { delta, percent };
}
