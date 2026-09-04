import {
  AccountError,
  MAX_ACCOUNTS,
  assertAccountCapacity,
  isAssetAccount,
  sameAccount,
  validateAccountDetails,
  type AccountDetails,
  type AccountRepository,
} from "../domain/accounts";
import type { AssetAccount } from "../domain/models";
import {
  ACCOUNT_STORE,
  DATABASE_VERSION,
  storageMigrationPlan,
} from "../domain/storage-migrations";

export const DATABASE_NAME = "fire-dashboard";
const storageError = () =>
  new AccountError(
    "端末の保存領域を利用できません。ブラウザーの設定や空き容量を確認し、再読み込みしてください。データは削除しないでください。",
  );

export function openAccountDatabase(name = DATABASE_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let finished = false;
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(name, DATABASE_VERSION);
    } catch {
      reject(storageError());
      return;
    }
    request.onblocked = () => {
      finished = true;
      reject(
        new AccountError(
          "別のタブが保存領域を使用しています。他のタブを閉じて再読み込みしてください。",
        ),
      );
    };
    request.onupgradeneeded = (event) => {
      if (finished) {
        request.transaction?.abort();
        return;
      }
      try {
        for (const step of storageMigrationPlan(event.oldVersion)) {
          const store = request.result.createObjectStore(step.store, { keyPath: step.keyPath });
          for (const index of step.indexes ?? [])
            store.createIndex(index.name, index.keyPath, { unique: index.unique });
        }
      } catch {
        request.transaction?.abort();
      }
    };
    request.onerror = () => {
      finished = true;
      reject(storageError());
    };
    request.onsuccess = () => {
      const db = request.result;
      if (finished) {
        db.close();
        return;
      }
      finished = true;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

function readAccounts(values: unknown[]): AssetAccount[] {
  assertAccountCapacity(values.length);
  if (!values.every(isAssetAccount)) {
    throw new AccountError(
      "保存済みの口座データを読み取れません。データは削除せず、復旧を依頼してください。",
    );
  }
  return values.sort(
    (a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Count and bounded read share the caller's transaction (including create). */
function readBoundedAccounts(
  store: IDBObjectStore,
  adding: boolean,
  done: (accounts: AssetAccount[]) => void,
  fail: (error: unknown) => void,
): void {
  const count = store.count();
  count.onsuccess = () => {
    try {
      assertAccountCapacity(count.result, adding);
      // Never materialize an oversized store, even when an older app wrote it.
      const request = store.getAll(undefined, MAX_ACCOUNTS);
      request.onsuccess = () => {
        try {
          done(readAccounts(request.result));
        } catch (error) {
          fail(error);
        }
      };
    } catch (error) {
      fail(error);
    }
  };
}

export class IndexedDbAccountRepository implements AccountRepository {
  constructor(private readonly databaseName = DATABASE_NAME) {}

  private async transaction<T>(
    mode: IDBTransactionMode,
    operate: (
      store: IDBObjectStore,
      done: (value: T) => void,
      fail: (error: unknown) => void,
    ) => void,
  ): Promise<T> {
    const db = await openAccountDatabase(this.databaseName);
    return new Promise<T>((resolve, reject) => {
      let result: T;
      let failure: unknown;
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(ACCOUNT_STORE, mode);
      } catch {
        db.close();
        reject(storageError());
        return;
      }
      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };
      transaction.onabort = () => {
        db.close();
        reject(failure ?? storageError());
      };
      const fail = (error: unknown) => {
        failure = error;
        transaction.abort();
      };
      try {
        operate(
          transaction.objectStore(ACCOUNT_STORE),
          (value) => {
            result = value;
          },
          fail,
        );
      } catch (error) {
        fail(error);
      }
    });
  }

  list(): Promise<AssetAccount[]> {
    return this.transaction("readonly", (store, done, fail) => {
      readBoundedAccounts(store, false, done, fail);
    });
  }

  async create(details: AccountDetails): Promise<AssetAccount> {
    const valid = validateAccountDetails(details);
    return this.transaction("readwrite", (store, done, fail) => {
      readBoundedAccounts(
        store,
        true,
        (accounts) => {
          const sortOrder = accounts.length ? accounts[accounts.length - 1].sortOrder + 1 : 0;
          if (!Number.isSafeInteger(sortOrder))
            throw new AccountError("口座の表示順が上限に達しました。");
          const account = { ...valid, id: crypto.randomUUID(), sortOrder };
          store.add(account);
          done(account);
        },
        fail,
      );
    });
  }

  async update(expected: AssetAccount, details: AccountDetails): Promise<AssetAccount> {
    const valid = validateAccountDetails(details);
    if (!isAssetAccount(expected)) throw new AccountError("更新対象の口座を確認してください。");
    return this.transaction("readwrite", (store, done, fail) => {
      const request = store.get(expected.id);
      request.onsuccess = () => {
        try {
          if (!isAssetAccount(request.result) || !sameAccount(request.result, expected)) {
            throw new AccountError(
              "口座が別のタブで変更されています。入力内容を控えて再読み込みしてください。",
            );
          }
          const account = { id: expected.id, sortOrder: expected.sortOrder, ...valid };
          store.put(account);
          done(account);
        } catch (error) {
          fail(error);
        }
      };
    });
  }
}
