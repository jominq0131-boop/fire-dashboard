import type { AssetAccount } from "./models";
import { assertMonth, isMonthlyRecord, type MonthRecords } from "./monthly";
import { MAX_ACCOUNTS } from "./accounts";

export interface MetricsSource {
  month: string;
  accounts: AssetAccount[];
  records: MonthRecords;
}
export type MetricAmount = number | null | "overflow";
const safe = (value: bigint): MetricAmount =>
  value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)
    ? "overflow"
    : Number(value);

/** Derived values only: missing observations never become zero balances. */
export function monthlyMetrics({ month, accounts, records }: MetricsSource) {
  assertMonth(month);
  const ids = new Set(accounts.map((a) => a.id));
  if (
    accounts.length > MAX_ACCOUNTS ||
    ids.size !== accounts.length ||
    records.balances.length > MAX_ACCOUNTS
  )
    throw new Error("집계할 계좌를 확인해 주세요.");
  const seen = new Set<string>();
  for (const balance of records.balances) {
    if (
      !isMonthlyRecord(balance, false) ||
      balance.month !== month ||
      !ids.has(balance.accountId) ||
      seen.has(balance.accountId)
    )
      throw new Error("집계할 잔액을 확인해 주세요.");
    seen.add(balance.accountId);
  }
  const cash = records.cash;
  if (cash && (!isMonthlyRecord(cash, true) || cash.month !== month))
    throw new Error("집계할 수입·지출을 확인해 주세요.");
  const surplus = cash ? BigInt(cash.income) - BigInt(cash.expenses) : null;
  return {
    assets: records.balances.length
      ? safe(records.balances.reduce((sum, b) => sum + BigInt(b.balance), 0n))
      : null,
    recordedAccounts: seen.size,
    totalAccounts: accounts.length,
    income: cash?.income ?? null,
    expenses: cash?.expenses ?? null,
    investmentContribution: cash?.investmentContribution ?? null,
    surplus: surplus === null ? null : safe(surplus),
    remainingCash:
      surplus === null || !cash ? null : safe(surplus - BigInt(cash.investmentContribution)),
  };
}
