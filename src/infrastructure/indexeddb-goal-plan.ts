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
    "別のタブで目標計画が変更されました。入力は残しています。再読み込みして最新の計画を確認してください。",
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
            fail(new Error("保存済みの目標計画が上限を超えています。データは削除していません。"));
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
        reject(failure ?? new Error("目標計画を読み込めません。データは変更していません。"));
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
            fail(new Error("保存済みの目標計画が上限を超えています。データは削除していません。"));
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
        reject(failure ?? new Error("目標計画を保存できません。入力は残しています。"));
      };
      tx.onerror = () => {
        failure ??= tx.error;
      };
    });
  }
}
