import { isAssetAccount, MAX_ACCOUNTS } from "./accounts";
import { isMonthlyRecord, MAX_BALANCES, MAX_MONTHS } from "./monthly";
import type { AssetAccount, MonthlyCashFlowRecord, AccountBalanceSnapshot } from "./models";

export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
export interface Backup {
  schemaVersion: 1;
  accounts: AssetAccount[];
  monthlyCashFlows: MonthlyCashFlowRecord[];
  accountBalanceSnapshots: AccountBalanceSnapshot[];
}
export interface BackupRepository {
  exportBackup(): Promise<Backup>;
  importBackup(backup: Backup): Promise<number>;
}
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const backupBytes = (text: string) => new TextEncoder().encode(text).byteLength;
export function canonical(value: object): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}
const invalid = () =>
  new Error("バックアップの形式・件数・参照・重複を確認してください。元の記録は変更していません。");
/** First JSON format: v1 is normalized deterministically; unsupported versions are never guessed. */
export function normalizeBackup(value: unknown): Backup {
  if (!value || typeof value !== "object") throw invalid();
  const v = value as Record<string, unknown>;
  if (
    v.schemaVersion !== 1 ||
    Object.keys(v).length !== 4 ||
    !["schemaVersion", "accounts", "monthlyCashFlows", "accountBalanceSnapshots"].every((k) =>
      Object.hasOwn(v, k),
    )
  )
    throw invalid();
  const arrays = [v.accounts, v.monthlyCashFlows, v.accountBalanceSnapshots];
  const limits = [MAX_ACCOUNTS, MAX_MONTHS, MAX_BALANCES];
  if (!arrays.every((a, i) => Array.isArray(a) && a.length <= limits[i])) throw invalid();
  const accounts = v.accounts as AssetAccount[],
    cash = v.monthlyCashFlows as MonthlyCashFlowRecord[],
    balances = v.accountBalanceSnapshots as AccountBalanceSnapshot[];
  if (
    !accounts.every(isAssetAccount) ||
    !cash.every((c) => isMonthlyRecord(c, true)) ||
    !balances.every((b) => isMonthlyRecord(b, false))
  )
    throw invalid();
  const ids = new Set(accounts.map((a) => a.id));
  const unique = <T>(items: T[], key: (item: T) => string) =>
    new Set(items.map(key)).size === items.length;
  if (
    ids.size !== accounts.length ||
    !unique(cash, (c) => c.id) ||
    !unique(cash, (c) => c.month) ||
    !unique(balances, (b) => b.id) ||
    !unique(balances, (b) => JSON.stringify([b.month, b.accountId])) ||
    !balances.every((b) => ids.has(b.accountId))
  )
    throw invalid();
  const result: Backup = {
    schemaVersion: 1,
    accounts: [...accounts].sort((a, b) => compare(a.id, b.id)),
    monthlyCashFlows: [...cash].sort((a, b) => compare(a.month, b.month)),
    accountBalanceSnapshots: [...balances].sort(
      (a, b) => a.month.localeCompare(b.month) || compare(a.accountId, b.accountId),
    ),
  };
  if (backupBytes(canonical(result)) > MAX_BACKUP_BYTES)
    throw new Error("バックアップは32 MiB以内で扱えます。記録は削除していません。");
  return result;
}
export function parseBackup(text: string) {
  if (text.length > MAX_BACKUP_BYTES || backupBytes(text) > MAX_BACKUP_BYTES)
    throw new Error("ファイルは32 MiB以内にしてください。");
  return normalizeBackup(JSON.parse(text));
}
export function mergeBackup(current: Backup, incoming: Backup) {
  const left = normalizeBackup(current),
    right = normalizeBackup(incoming);
  let added = 0;
  const merge = <T extends { id: string }>(a: T[], b: T[]) => {
    const map = new Map(a.map((v) => [v.id, v]));
    for (const record of b) {
      const previous = map.get(record.id);
      if (previous) {
        if (canonical(previous) !== canonical(record))
          throw new Error(
            "既存の記録と競合しています。別の空のブラウザーへ復元するか、バックアップを確認してください。変更は適用していません。",
          );
      } else {
        map.set(record.id, record);
        added++;
      }
    }
    return [...map.values()];
  };
  const backup = normalizeBackup({
    schemaVersion: 1,
    accounts: merge(left.accounts, right.accounts),
    monthlyCashFlows: merge(left.monthlyCashFlows, right.monthlyCashFlows),
    accountBalanceSnapshots: merge(left.accountBalanceSnapshots, right.accountBalanceSnapshots),
  });
  return { backup, added };
}
