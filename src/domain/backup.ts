import { isAssetAccount, MAX_ACCOUNTS } from "./accounts";
import { isMonthlyRecord, MAX_BALANCES, MAX_MONTHS } from "./monthly";
import type { AssetAccount, MonthlyCashFlowRecord, AccountBalanceSnapshot } from "./models";
import { normalizeFirePlan, sameFirePlan, type FirePlan } from "./fire-plan";

export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
export interface Backup {
  schemaVersion: 1 | 2 | 3;
  accounts: AssetAccount[];
  monthlyCashFlows: MonthlyCashFlowRecord[];
  accountBalanceSnapshots: AccountBalanceSnapshot[];
  firePlan?: FirePlan | null;
}
export interface CurrentBackup extends Backup {
  schemaVersion: 3;
  firePlan: FirePlan | null;
}
export interface BackupRepository {
  exportBackup(): Promise<CurrentBackup>;
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
/** v1/v2 to v3 preserves records and unknown observation dates; no inferred values are added. */
export function normalizeBackup(value: unknown): CurrentBackup {
  if (!value || typeof value !== "object") throw invalid();
  const v = value as Record<string, unknown>;
  if (
    (v.schemaVersion !== 1 && v.schemaVersion !== 2 && v.schemaVersion !== 3) ||
    Object.keys(v).length !== (v.schemaVersion === 3 ? 5 : 4) ||
    !["schemaVersion", "accounts", "monthlyCashFlows", "accountBalanceSnapshots"].every((k) =>
      Object.hasOwn(v, k),
    ) ||
    (v.schemaVersion === 3 ? !Object.hasOwn(v, "firePlan") : Object.hasOwn(v, "firePlan"))
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
    !balances.every(
      (b) => isMonthlyRecord(b, false) && (v.schemaVersion !== 1 || b.asOfDate === undefined),
    )
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
  let firePlan: FirePlan | null = null;
  if (v.schemaVersion === 3 && v.firePlan !== null) firePlan = normalizeFirePlan(v.firePlan);
  const result: CurrentBackup = {
    schemaVersion: 3,
    accounts: [...accounts].sort((a, b) => compare(a.id, b.id)),
    monthlyCashFlows: [...cash].sort((a, b) => compare(a.month, b.month)),
    accountBalanceSnapshots: [...balances].sort(
      (a, b) => a.month.localeCompare(b.month) || compare(a.accountId, b.accountId),
    ),
    firePlan,
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
  let firePlan = left.firePlan;
  if (right.firePlan) {
    if (!firePlan) {
      firePlan = right.firePlan;
      added++;
    } else if (!sameFirePlan(firePlan, right.firePlan)) {
      throw new Error(
        "既存のFIRE計画と競合しています。変更は適用していません。必要な計画をJSONで別に保管してください。",
      );
    }
  }
  const backup = normalizeBackup({
    schemaVersion: 3,
    accounts: merge(left.accounts, right.accounts),
    monthlyCashFlows: merge(left.monthlyCashFlows, right.monthlyCashFlows),
    accountBalanceSnapshots: merge(left.accountBalanceSnapshots, right.accountBalanceSnapshots),
    firePlan,
  });
  return { backup, added };
}
