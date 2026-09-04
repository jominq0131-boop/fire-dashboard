import type { AccountBalanceSnapshot, AssetAccount } from "./models";
import { isMonthKey } from "./validation";
import { MAX_ACCOUNTS } from "./accounts";

export function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function monthEnd(month: string) {
  if (!isMonthKey(month) || month < "1900-01" || month > "2199-12")
    throw new Error("Invalid month");
  const [y, m] = month.split("-").map(Number);
  return `${month}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
}
export function isObservationDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    return value.slice(8) >= "01" && value <= monthEnd(value.slice(0, 7));
  } catch {
    return false;
  }
}
export function observationStatus(balance: AccountBalanceSnapshot | undefined, today: string) {
  if (!balance) return "未記録";
  if (!balance.asOfDate) return `${balance.month} 月末として入力・確認日未記録`;
  const days = Math.floor(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${balance.asOfDate}T00:00:00Z`)) / 86400000,
  );
  return `${balance.asOfDate} 確認${days < 0 ? "・未来日" : days > 31 ? "・更新から32日以上" : ""}`;
}
export interface CurrentAssets {
  accounts: AssetAccount[];
  balances: AccountBalanceSnapshot[];
}
export function currentTotal({ accounts, balances }: CurrentAssets): number | null | "overflow" {
  if (accounts.length > MAX_ACCOUNTS || balances.length > MAX_ACCOUNTS)
    throw new Error("Account limit");
  const ids = new Set(accounts.map((a) => a.id)),
    seen = new Set<string>();
  if (ids.size !== accounts.length) throw new Error("Duplicate account");
  let sum = 0n;
  for (const b of balances) {
    if (
      !ids.has(b.accountId) ||
      seen.has(b.accountId) ||
      !Number.isSafeInteger(b.balance) ||
      b.balance < 0
    )
      throw new Error("Invalid current balance");
    seen.add(b.accountId);
    sum += BigInt(b.balance);
  }
  return balances.length === 0
    ? null
    : sum > BigInt(Number.MAX_SAFE_INTEGER)
      ? "overflow"
      : Number(sum);
}
