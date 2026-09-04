import { assertAccountCapacity, isAssetAccount, MAX_ACCOUNTS } from "../domain/accounts";
import {
  assertCapacity,
  assertMonth,
  isMonthlyRecord,
  MAX_BALANCES,
  MAX_MONTHS,
  MonthlyError,
  sameRecord,
  validId,
  validateCash,
  type CashDetails,
  type MonthlyRepository,
  type MonthRecords,
} from "../domain/monthly";
import type { MonthlyCashFlowRecord, AccountBalanceSnapshot } from "../domain/models";
import { isNonNegativeYen } from "../domain/validation";
import { ACCOUNT_STORE, CASH_STORE, BALANCE_STORE } from "../domain/storage-migrations";
import { DATABASE_NAME, openAccountDatabase } from "./indexeddb-accounts";
type RecordValue = MonthlyCashFlowRecord | AccountBalanceSnapshot;
const failureMessage =
  "月別記録を保存・読込できません。保存済みデータは削除せず、入力を控えて再読み込みしてください。";
type Read = <T>(request: IDBRequest<T>, next: (value: T) => void) => void;
export class IndexedDbMonthlyRepository implements MonthlyRepository {
  constructor(private readonly databaseName = DATABASE_NAME) {}
  private async run<T>(
    mode: IDBTransactionMode,
    operate: (tx: IDBTransaction, read: Read, done: (value: T) => void) => void,
  ): Promise<T> {
    const db = await openAccountDatabase(this.databaseName);
    return new Promise<T>((resolve, reject) => {
      let result: T, failure: unknown;
      let tx: IDBTransaction;
      try {
        tx = db.transaction([ACCOUNT_STORE, CASH_STORE, BALANCE_STORE], mode);
      } catch {
        db.close();
        reject(new MonthlyError(failureMessage));
        return;
      }
      const fail = (error: unknown) => {
        failure = error;
        tx.abort();
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onabort = () => {
        db.close();
        reject(failure ?? new MonthlyError(failureMessage));
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
      try {
        operate(tx, read, (value) => {
          result = value;
        });
      } catch (error) {
        fail(error);
      }
    });
  }
  async readMonth(month: string): Promise<MonthRecords> {
    assertMonth(month);
    return this.run("readonly", (tx, read, done) => {
      const cashStore = tx.objectStore(CASH_STORE),
        balanceStore = tx.objectStore(BALANCE_STORE),
        accounts = tx.objectStore(ACCOUNT_STORE);
      read(accounts.count(), (totalAccounts) => {
        assertAccountCapacity(totalAccounts);
        read(cashStore.count(), (totalCash) => {
          assertCapacity(totalCash, MAX_MONTHS);
          read(balanceStore.count(), (totalBalances) => {
            assertCapacity(totalBalances, MAX_BALANCES);
            read(cashStore.index("month").count(month), (cashCount) => {
              assertCapacity(cashCount, 1);
              read(balanceStore.index("month").count(month), (balanceCount) => {
                assertCapacity(balanceCount, MAX_ACCOUNTS);
                read(cashStore.index("month").getAll(month, 1), (cash) => {
                  read(balanceStore.index("month").getAll(month, MAX_ACCOUNTS), (balances) => {
                    if (
                      !cash.every((v) => isMonthlyRecord(v, true) && v.month === month) ||
                      !balances.every((v) => isMonthlyRecord(v, false) && v.month === month)
                    )
                      throw new MonthlyError(failureMessage);
                    const result = {
                      cash: cash[0] ?? null,
                      balances: balances.sort((a, b) => a.accountId.localeCompare(b.accountId)),
                    } as MonthRecords;
                    if (!balances.length) {
                      done(result);
                      return;
                    }
                    let remaining = balances.length;
                    for (const balance of balances)
                      read(accounts.get(balance.accountId), (account) => {
                        if (!isAssetAccount(account))
                          throw new MonthlyError(
                            "残高の参照口座を確認できません。データは削除していません。",
                          );
                        if (--remaining === 0) done(result);
                      });
                  });
                });
              });
            });
          });
        });
      });
    });
  }
  async saveCash(
    month: string,
    details: CashDetails,
    expected: MonthlyCashFlowRecord | null,
  ): Promise<MonthlyCashFlowRecord> {
    assertMonth(month);
    const valid = validateCash(details);
    return this.save(month, true, valid, expected) as Promise<MonthlyCashFlowRecord>;
  }
  async saveBalance(
    month: string,
    accountId: string,
    balance: number,
    expected: AccountBalanceSnapshot | null,
  ): Promise<AccountBalanceSnapshot> {
    assertMonth(month);
    if (!validId(accountId) || !isNonNegativeYen(balance))
      throw new MonthlyError("口座と整数の残高を確認してください。");
    return this.save(
      month,
      false,
      { accountId, balance },
      expected,
    ) as Promise<AccountBalanceSnapshot>;
  }
  private save(
    month: string,
    cash: boolean,
    details: CashDetails | { accountId: string; balance: number },
    expected: RecordValue | null,
  ): Promise<RecordValue> {
    if (
      expected !== null &&
      (!isMonthlyRecord(expected, cash) ||
        expected.month !== month ||
        (!cash &&
          (expected as AccountBalanceSnapshot).accountId !==
            (details as AccountBalanceSnapshot).accountId))
    )
      return Promise.reject(new MonthlyError("更新対象を確認してください。"));
    return this.run("readwrite", (tx, read, done) => {
      const store = tx.objectStore(cash ? CASH_STORE : BALANCE_STORE),
        accounts = tx.objectStore(ACCOUNT_STORE);
      const key = cash ? month : [month, (details as AccountBalanceSnapshot).accountId];
      read(accounts.count(), (accountCount) => {
        assertAccountCapacity(accountCount);
        read(store.count(), (total) => {
          assertCapacity(total, cash ? MAX_MONTHS : MAX_BALANCES, expected === null);
          read(store.index("month").count(month), (count) => {
            assertCapacity(count, cash ? 1 : MAX_ACCOUNTS, expected === null);
            read(store.index(cash ? "month" : "monthAccount").get(key), (current) => {
              if (
                expected === null
                  ? current !== undefined
                  : !isMonthlyRecord(current, cash) || !sameRecord(current, expected)
              )
                throw new MonthlyError(
                  "同じ月の記録が存在するか、別のタブで変更されています。入力を控えて再読み込みしてください。",
                );
              const write = () => {
                const now = new Date().toISOString();
                const record = {
                  id: expected?.id ?? crypto.randomUUID(),
                  month,
                  ...details,
                  createdAt: expected?.createdAt ?? now,
                  updatedAt: expected && expected.updatedAt > now ? expected.updatedAt : now,
                } as RecordValue;
                if (!isMonthlyRecord(record, cash)) throw new MonthlyError(failureMessage);
                if (expected) store.put(record);
                else store.add(record);
                done(record);
              };
              if (cash) write();
              else
                read(accounts.get((details as AccountBalanceSnapshot).accountId), (account) => {
                  if (!isAssetAccount(account))
                    throw new MonthlyError("保存先の口座が見つかりません。");
                  write();
                });
            });
          });
        });
      });
    });
  }
}
