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
    "기기의 저장 공간을 사용할 수 없습니다. 브라우저 설정과 여유 공간을 확인한 뒤 새로고침해 주세요. 데이터는 삭제하지 마세요.",
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
          "다른 탭에서 저장 공간을 사용 중입니다. 다른 탭을 닫고 새로고침해 주세요.",
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
          const store = step.existingStore
            ? request.transaction!.objectStore(step.store)
            : request.result.createObjectStore(step.store, { keyPath: step.keyPath });
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
      "저장된 계좌 데이터를 읽을 수 없습니다. 데이터를 삭제하지 말고 복구를 요청해 주세요.",
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
            throw new AccountError("계좌 표시 순서가 한도에 도달했습니다.");
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
    if (!isAssetAccount(expected)) throw new AccountError("수정할 계좌를 확인해 주세요.");
    return this.transaction("readwrite", (store, done, fail) => {
      const request = store.get(expected.id);
      request.onsuccess = () => {
        try {
          if (!isAssetAccount(request.result) || !sameAccount(request.result, expected)) {
            throw new AccountError(
              "다른 탭에서 계좌가 변경되었습니다. 입력 내용을 따로 보관한 뒤 새로고침해 주세요.",
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
