import {
  normalizeFirePlan,
  sameFirePlan,
  type FirePlan,
  type FirePlanRepository,
} from "../domain/fire-plan";
import { FIRE_PLAN_STORE } from "../domain/storage-migrations";
import { DATABASE_NAME, openAccountDatabase } from "./indexeddb-accounts";

const conflict = () =>
  new Error(
    "다른 탭에서 FIRE 계획이 변경되었습니다. 입력은 남겨 두었습니다. 새로고침해 최신 계획을 확인해 주세요.",
  );

export class IndexedDbFirePlanRepository implements FirePlanRepository {
  constructor(private readonly databaseName = DATABASE_NAME) {}

  async load(): Promise<FirePlan | null> {
    const db = await openAccountDatabase(this.databaseName);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FIRE_PLAN_STORE, "readonly");
      const store = tx.objectStore(FIRE_PLAN_STORE);
      let result: FirePlan | null = null;
      let failure: unknown;
      const fail = (error: unknown) => {
        failure = error;
        tx.abort();
      };
      const count = store.count();
      count.onsuccess = () => {
        try {
          if (count.result > 1) {
            fail(new Error("저장된 FIRE 계획이 한도를 초과합니다. 데이터는 삭제하지 않았습니다."));
            return;
          }
          const request = store.getAll(undefined, 1);
          request.onsuccess = () => {
            try {
              result = request.result.length === 0 ? null : normalizeFirePlan(request.result[0]);
            } catch (error) {
              fail(error);
            }
          };
        } catch (error) {
          fail(error);
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onabort = () => {
        db.close();
        reject(
          failure ?? new Error("FIRE 계획을 불러올 수 없습니다. 데이터는 변경하지 않았습니다."),
        );
      };
      tx.onerror = () => {
        failure ??= tx.error;
      };
    });
  }

  async save(nextInput: FirePlan, previousInput: FirePlan | null): Promise<FirePlan> {
    const next = normalizeFirePlan(nextInput);
    const previous = previousInput === null ? null : normalizeFirePlan(previousInput);
    const db = await openAccountDatabase(this.databaseName);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FIRE_PLAN_STORE, "readwrite");
      const store = tx.objectStore(FIRE_PLAN_STORE);
      let failure: unknown;
      const fail = (error: unknown) => {
        failure = error;
        tx.abort();
      };
      const count = store.count();
      count.onsuccess = () => {
        try {
          if (count.result > 1) {
            fail(new Error("저장된 FIRE 계획이 한도를 초과합니다. 데이터는 삭제하지 않았습니다."));
            return;
          }
          const request = store.getAll(undefined, 1);
          request.onsuccess = () => {
            try {
              const current =
                request.result.length === 0 ? null : normalizeFirePlan(request.result[0]);
              if (!sameFirePlan(current, previous)) {
                fail(conflict());
                return;
              }
              store.put(next);
            } catch (error) {
              fail(error);
            }
          };
        } catch (error) {
          fail(error);
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve(next);
      };
      tx.onabort = () => {
        db.close();
        reject(failure ?? new Error("FIRE 계획을 저장할 수 없습니다. 입력은 남겨 두었습니다."));
      };
      tx.onerror = () => {
        failure ??= tx.error;
      };
    });
  }
}
