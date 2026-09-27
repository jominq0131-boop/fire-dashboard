import { normalizeGoalPlan, sameGoalPlan, type GoalPlan } from "./goal-plan";
import { isAssetAccount, MAX_ACCOUNTS } from "./accounts";
import { isMonthlyRecord, MAX_BALANCES, MAX_MONTHS } from "./monthly";
import type { AssetAccount, MonthlyCashFlowRecord, AccountBalanceSnapshot } from "./models";
import { normalizeFirePlan, sameFirePlan, type FirePlan } from "./fire-plan";

export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
export interface Backup {
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  accounts: AssetAccount[];
  monthlyCashFlows: MonthlyCashFlowRecord[];
  accountBalanceSnapshots: AccountBalanceSnapshot[];
  goalPlan?: GoalPlan | null;
  firePlan?: FirePlan | null;
}
export interface CurrentBackup extends Backup {
  schemaVersion: 7;
  goalPlan: GoalPlan | null;
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
  new Error("백업 형식·개수·참조·중복을 확인해 주세요. 기존 기록은 변경하지 않았습니다.");
/** Older backups preserve records; missing goal assumptions receive versioned defaults in memory. */
export function normalizeBackup(value: unknown): CurrentBackup {
  if (!value || typeof value !== "object") throw invalid();
  const v = value as Record<string, unknown>;
  if (
    (v.schemaVersion !== 1 &&
      v.schemaVersion !== 2 &&
      v.schemaVersion !== 3 &&
      v.schemaVersion !== 4 &&
      v.schemaVersion !== 5 &&
      v.schemaVersion !== 6 &&
      v.schemaVersion !== 7) ||
    Object.keys(v).length !== (Number(v.schemaVersion) >= 4 ? 6 : v.schemaVersion === 3 ? 5 : 4) ||
    !["schemaVersion", "accounts", "monthlyCashFlows", "accountBalanceSnapshots"].every((k) =>
      Object.hasOwn(v, k),
    ) ||
    (Number(v.schemaVersion) >= 3 ? !Object.hasOwn(v, "firePlan") : Object.hasOwn(v, "firePlan")) ||
    (Number(v.schemaVersion) >= 4 ? !Object.hasOwn(v, "goalPlan") : Object.hasOwn(v, "goalPlan"))
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
  if (Number(v.schemaVersion) >= 3 && v.firePlan !== null) firePlan = normalizeFirePlan(v.firePlan);
  const result: CurrentBackup = {
    schemaVersion: 7,
    accounts: [...accounts].sort((a, b) => compare(a.id, b.id)),
    monthlyCashFlows: [...cash].sort((a, b) => compare(a.month, b.month)),
    accountBalanceSnapshots: [...balances].sort(
      (a, b) => a.month.localeCompare(b.month) || compare(a.accountId, b.accountId),
    ),
    firePlan,
    goalPlan:
      Number(v.schemaVersion) >= 4 && v.goalPlan !== null
        ? normalizeGoalPlan(
            v.goalPlan,
            v.schemaVersion === 4
              ? "legacy"
              : v.schemaVersion === 5
                ? "tax"
                : v.schemaVersion === 6
                  ? "drawdown"
                  : "current",
          )
        : null,
  };
  if (backupBytes(canonical(result)) > MAX_BACKUP_BYTES)
    throw new Error("백업은 32 MiB까지 처리할 수 있습니다. 기록은 삭제하지 않았습니다.");
  return result;
}
export function parseBackup(text: string) {
  if (text.length > MAX_BACKUP_BYTES || backupBytes(text) > MAX_BACKUP_BYTES)
    throw new Error("파일 크기는 32 MiB 이하여야 합니다.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(
      "JSON 파일을 읽을 수 없습니다. 파일 형식을 확인해 주세요. 기존 기록은 변경하지 않았습니다.",
    );
  }
  return normalizeBackup(value);
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
            "기존 기록과 충돌합니다. 비어 있는 다른 브라우저에 복원하거나 백업을 확인해 주세요. 변경은 적용하지 않았습니다.",
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
        "기존 FIRE 계획과 충돌합니다. 변경은 적용하지 않았습니다. 필요한 계획은 JSON으로 따로 보관해 주세요.",
      );
    }
  }
  let goalPlan = left.goalPlan;
  if (right.goalPlan) {
    if (!goalPlan) {
      goalPlan = right.goalPlan;
      added++;
    } else if (!sameGoalPlan(goalPlan, right.goalPlan))
      throw new Error("기존 목표 계획과 충돌합니다. 변경은 적용하지 않았습니다.");
  }
  const backup = normalizeBackup({
    schemaVersion: 7,
    accounts: merge(left.accounts, right.accounts),
    monthlyCashFlows: merge(left.monthlyCashFlows, right.monthlyCashFlows),
    accountBalanceSnapshots: merge(left.accountBalanceSnapshots, right.accountBalanceSnapshots),
    firePlan,
    goalPlan,
  });
  return { backup, added };
}
