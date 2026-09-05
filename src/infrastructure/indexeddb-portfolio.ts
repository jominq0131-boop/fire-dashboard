import { MAX_ACCOUNTS, isAssetAccount } from "../domain/accounts";
import type { AccountBalanceSnapshot, MonthlyCashFlowRecord } from "../domain/models";
import { monthEnd, isObservationDate } from "../domain/observations";
import {
  assertCapacity,
  assertMonth,
  MAX_BALANCES,
  MAX_MONTHS,
  isMonthlyRecord,
} from "../domain/monthly";
import {
  historyMonths,
  type PortfolioOverview,
  type PortfolioRepository,
} from "../domain/portfolio";
import { monthlyMetrics, type MetricsSource } from "../domain/metrics";
import {
  backupBytes,
  canonical,
  MAX_BACKUP_BYTES,
  mergeBackup,
  normalizeBackup,
  type Backup,
  type BackupRepository,
  type CurrentBackup,
} from "../domain/backup";
import { normalizeFirePlan } from "../domain/fire-plan";
import {
  ACCOUNT_STORE,
  CASH_STORE,
  BALANCE_STORE,
  FIRE_PLAN_STORE,
} from "../domain/storage-migrations";
import { DATABASE_NAME, openAccountDatabase } from "./indexeddb-accounts";

const stores = [ACCOUNT_STORE, CASH_STORE, BALANCE_STORE, FIRE_PLAN_STORE];
const limits = [MAX_ACCOUNTS, MAX_MONTHS, MAX_BALANCES, 1];
const validSnapshotRecord = (value: unknown, index: number) => {
  if (index === 0) return isAssetAccount(value);
  if (index === 3) {
    normalizeFirePlan(value);
    return true;
  }
  return isMonthlyRecord(value, index === 1);
};
type Read = <T>(request: IDBRequest<T>, next: (value: T) => void) => void;
export class IndexedDbPortfolioRepository implements PortfolioRepository, BackupRepository {
  constructor(private readonly databaseName = DATABASE_NAME) {}
  private async run<T>(
    mode: IDBTransactionMode,
    operate: (tx: IDBTransaction, read: Read, done: (value: T) => void) => void,
  ): Promise<T> {
    const db = await openAccountDatabase(this.databaseName);
    return new Promise((resolve, reject) => {
      let result: T, failure: unknown;
      let tx: IDBTransaction;
      try {
        tx = db.transaction(stores, mode);
      } catch (error) {
        db.close();
        reject(error);
        return;
      }
      const fail = (error: unknown) => {
        failure = error;
        tx.abort();
      };
      const read: Read = (request, next) => {
        request.onsuccess = () => {
          try {
            next(request.result);
          } catch (error) {
            fail(error);
          }
        };
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onabort = () => {
        db.close();
        reject(
          failure ?? new Error("保存領域の処理に失敗しました。既存の記録は変更していません。"),
        );
      };
      try {
        this.counts(tx, read, () =>
          operate(tx, read, (value) => {
            result = value;
          }),
        );
      } catch (error) {
        fail(error);
      }
    });
  }
  private counts(tx: IDBTransaction, read: Read, done: () => void) {
    let remaining = stores.length;
    stores.forEach((name, i) =>
      read(tx.objectStore(name).count(), (count) => {
        assertCapacity(count, limits[i]);
        if (--remaining === 0) done();
      }),
    );
  }
  readOverview(asOf: string, end?: string, today = monthEnd(asOf)): Promise<PortfolioOverview> {
    assertMonth(asOf);
    if (!isObservationDate(today) || today.slice(0, 7) !== asOf)
      throw new Error("Invalid as-of date");
    if (end) assertMonth(end);
    return this.run("readonly", (tx, read, done) => {
      read(tx.objectStore(ACCOUNT_STORE).getAll(undefined, MAX_ACCOUNTS), (accounts) => {
        if (!accounts.every(isAssetAccount)) throw new Error("口座を読み込めません。");
        const index = tx.objectStore(BALANCE_STORE).index("month");
        read(index.openKeyCursor(IDBKeyRange.bound("1900-01", asOf), "prev"), (cursor) => {
          const latestMonth = cursor ? String(cursor.key) : null;
          if (latestMonth) assertMonth(latestMonth);
          const months = historyMonths(end ?? latestMonth ?? asOf);
          const range = IDBKeyRange.bound(months[0], months[months.length - 1]);
          read(index.count(range), (count) => {
            assertCapacity(count, months.length * MAX_ACCOUNTS);
            read(index.getAll(range, months.length * MAX_ACCOUNTS), (balances) => {
              if (!balances.every((b) => isMonthlyRecord(b, false) && months.includes(b.month)))
                throw new Error("残高を読み込めません。");
              const sources: MetricsSource[] = months.map((month) => ({
                month,
                accounts,
                records: { cash: null, balances: balances.filter((b) => b.month === month) },
              }));
              sources.forEach(monthlyMetrics);
              const finish = (latest: MetricsSource | null) => {
                if (latest) monthlyMetrics(latest);
                const currentBalances: AccountBalanceSnapshot[] = [];
                const currentIndex = tx.objectStore(BALANCE_STORE).index("accountMonth");
                let remaining = accounts.length;
                const complete = () => {
                  const cashIndex = tx.objectStore(CASH_STORE).index("month");
                  read(cashIndex.count(range), (count) => {
                    assertCapacity(count, months.length);
                    read(cashIndex.getAll(range, months.length), (cashRows) => {
                      if (
                        !cashRows.every((c) => isMonthlyRecord(c, true) && months.includes(c.month))
                      )
                        throw new Error("収支を読み込めません。");
                      for (const source of sources) {
                        source.records.cash =
                          (cashRows as MonthlyCashFlowRecord[]).find(
                            (c) => c.month === source.month,
                          ) ?? null;
                        monthlyMetrics(source);
                      }
                      done({
                        latest,
                        months: sources,
                        current: {
                          accounts,
                          balances: currentBalances.sort((a, b) =>
                            a.accountId < b.accountId ? -1 : 1,
                          ),
                        },
                      });
                    });
                  });
                };
                if (!remaining) {
                  complete();
                  return;
                }
                for (const account of accounts) {
                  let visited = 0;
                  read(
                    currentIndex.openCursor(
                      IDBKeyRange.bound([account.id, "1900-01"], [account.id, asOf]),
                      "prev",
                    ),
                    (cursor) => {
                      if (!cursor) {
                        if (--remaining === 0) complete();
                        return;
                      }
                      if (++visited > 2) throw new Error("Unexpected current balance range");
                      const b = cursor.value as AccountBalanceSnapshot;
                      if (!isMonthlyRecord(b, false) || b.accountId !== account.id)
                        throw new Error("Invalid current balance");
                      if (b.asOfDate && b.asOfDate > today) {
                        cursor.continue();
                        return;
                      }
                      currentBalances.push(b);
                      if (--remaining === 0) complete();
                    },
                  );
                }
              };
              if (!latestMonth) {
                finish(null);
                return;
              }
              const existing = sources.find((s) => s.month === latestMonth);
              if (existing) {
                finish(existing);
                return;
              }
              read(index.count(latestMonth), (total) => {
                assertCapacity(total, MAX_ACCOUNTS);
                read(index.getAll(latestMonth, MAX_ACCOUNTS), (rows) =>
                  finish({ month: latestMonth, accounts, records: { cash: null, balances: rows } }),
                );
              });
            });
          });
        });
      });
    });
  }
  private snapshot(tx: IDBTransaction, read: Read, done: (backup: CurrentBackup) => void) {
    const values: unknown[][] = stores.map(() => []);
    let bytes = 100,
      remaining = stores.length;
    stores.forEach((name, i) => {
      read(tx.objectStore(name).openCursor(), (cursor) => {
        if (!cursor) {
          if (--remaining === 0)
            done(
              normalizeBackup({
                schemaVersion: 3,
                accounts: values[0],
                monthlyCashFlows: values[1],
                accountBalanceSnapshots: values[2],
                firePlan: values[3][0] ?? null,
              }),
            );
          return;
        }
        assertCapacity(values[i].length, limits[i], true);
        const value: unknown = cursor.value;
        if (!validSnapshotRecord(value, i))
          throw new Error("保存済み記録を検証できません。元のデータを保持しています。");
        bytes += backupBytes(canonical(value as object)) + 1;
        if (bytes > MAX_BACKUP_BYTES)
          throw new Error("バックアップは32 MiB以内で扱えます。記録は削除していません。");
        values[i].push(value);
        cursor.continue();
      });
    });
  }
  exportBackup() {
    return this.run<CurrentBackup>("readonly", (tx, read, done) => this.snapshot(tx, read, done));
  }
  async importBackup(input: Backup) {
    // Validate before opening any write transaction; freeze a canonical copy across the await.
    const incoming = normalizeBackup(JSON.parse(canonical(normalizeBackup(input))));
    return this.run<number>("readwrite", (tx, read, done) =>
      this.snapshot(tx, read, (current) => {
        const { backup, added } = mergeBackup(current, incoming);
        const existing = [
          current.accounts,
          current.monthlyCashFlows,
          current.accountBalanceSnapshots,
          current.firePlan ? [current.firePlan] : [],
        ];
        const merged = [
          backup.accounts,
          backup.monthlyCashFlows,
          backup.accountBalanceSnapshots,
          backup.firePlan ? [backup.firePlan] : [],
        ];
        stores.forEach((name, i) => {
          const ids = new Set(existing[i].map((r) => r.id));
          for (const record of merged[i]) if (!ids.has(record.id)) tx.objectStore(name).add(record);
        });
        done(added);
      }),
    );
  }
}
