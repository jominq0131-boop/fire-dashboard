import {
  normalizeGoalPlan,
  sameGoalPlan,
  type GoalPlan,
  type GoalPlanRepository,
} from "../domain/goal-plan";
import { GOAL_PLAN_STORE } from "../domain/storage-migrations";
import { DATABASE_NAME, openAccountDatabase } from "./indexeddb-accounts";

const conflict = () =>
  new Error(
    "다른 탭에서 목표 계획이 변경되었습니다. 입력은 남겨 두었습니다. 새로고침해 최신 계획을 확인해 주세요.",
  );

export class IndexedDbGoalPlanRepository implements GoalPlanRepository {
  constructor(private readonly databaseName = DATABASE_NAME) {}

  async load(): Promise<GoalPlan | null> {
    const db = await openAccountDatabase(this.databaseName);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(GOAL_PLAN_STORE, "readonly");
      const store = tx.objectStore(GOAL_PLAN_STORE);
      let result: GoalPlan | null = null;
      let failure: unknown;
      const fail = (error: unknown) => {
        failure = error;
        tx.abort();
      };
      const count = store.count();
      count.onsuccess = () => {
        try {
          if (count.result > 1) {
            fail(new Error("저장된 목표 계획이 한도를 초과합니다. 데이터는 삭제하지 않았습니다."));
            return;
          }
          const request = store.getAll(undefined, 1);
          request.onsuccess = () => {
            try {
              result = request.result.length === 0 ? null : normalizeGoalPlan(request.result[0]);
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
          failure ?? new Error("목표 계획을 불러올 수 없습니다. 데이터는 변경하지 않았습니다."),
        );
      };
      tx.onerror = () => {
        failure ??= tx.error;
      };
    });
  }

  async save(nextInput: GoalPlan, previousInput: GoalPlan | null): Promise<GoalPlan> {
    const next = normalizeGoalPlan(nextInput);
    const previous = previousInput === null ? null : normalizeGoalPlan(previousInput);
    const db = await openAccountDatabase(this.databaseName);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(GOAL_PLAN_STORE, "readwrite");
      const store = tx.objectStore(GOAL_PLAN_STORE);
      let failure: unknown;
      const fail = (error: unknown) => {
        failure = error;
        tx.abort();
      };
      const count = store.count();
      count.onsuccess = () => {
        try {
          if (count.result > 1) {
            fail(new Error("저장된 목표 계획이 한도를 초과합니다. 데이터는 삭제하지 않았습니다."));
            return;
          }
          const request = store.getAll(undefined, 1);
          request.onsuccess = () => {
            try {
              const current =
                request.result.length === 0 ? null : normalizeGoalPlan(request.result[0]);
              if (!sameGoalPlan(current, previous)) {
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
        reject(failure ?? new Error("목표 계획을 저장할 수 없습니다. 입력은 남겨 두었습니다."));
      };
      tx.onerror = () => {
        failure ??= tx.error;
      };
    });
  }
}
