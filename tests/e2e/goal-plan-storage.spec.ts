import { expect, test } from "@playwright/test";
import { initialGoalValues } from "../../src/domain/goal-plan";
const values = { ...initialGoalValues(), target: "2200" };
test("legacy goal read/export leaves original bytes intact and tax edits use conflict protection", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async (draft) => {
    const { IndexedDbGoalPlanRepository } = await import(
      new URL("src/infrastructure/indexeddb-goal-plan.ts", location.href).href
    );
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    const { openAccountDatabase } = await import(
      new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href
    );
    const name = "synthetic-legacy-tax-plan";
    const oldDraft = Object.fromEntries(
      Object.entries(draft).filter(
        ([key]) => key !== "taxableCost" && key !== "taxRate" && !key.startsWith("drawdown"),
      ),
    );
    const old = {
      id: "primary" as const,
      draft: oldDraft,
      referenceMonth: "2026-09",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    const db = await openAccountDatabase(name);
    const write = db.transaction("goalPlans", "readwrite");
    write.objectStore("goalPlans").put(old);
    await new Promise<void>((resolve, reject) => {
      write.oncomplete = () => resolve();
      write.onabort = () => reject(write.error);
    });
    db.close();
    const repo = new IndexedDbGoalPlanRepository(name);
    const backup = new IndexedDbPortfolioRepository(name);
    const loaded = await repo.load();
    const exported = await backup.exportBackup();
    const inspect = await openAccountDatabase(name);
    const read = inspect.transaction("goalPlans").objectStore("goalPlans").get("primary");
    const raw = await new Promise((resolve) => {
      read.onsuccess = () => resolve(read.result);
    });
    inspect.close();
    const saved = await repo.save(
      { ...loaded!, draft: { ...loaded!.draft, taxableCost: "500", taxRate: "20.315" } },
      loaded,
    );
    let conflict = false;
    try {
      await repo.save({ ...loaded!, draft: { ...loaded!.draft, taxableCost: "999" } }, loaded);
    } catch {
      conflict = true;
    }
    const oldBackup = { ...exported, schemaVersion: 4, goalPlan: old };
    const isolated = new IndexedDbPortfolioRepository("synthetic-legacy-tax-restore");
    const restoredCount = await isolated.importBackup(oldBackup);
    const restored = await isolated.exportBackup();
    let restoreConflict = "";
    try {
      await backup.importBackup(oldBackup);
    } catch (error) {
      restoreConflict = (error as Error).message;
    }
    return {
      old,
      raw,
      loaded,
      exported,
      saved,
      conflict,
      restoreConflict,
      restoredCount,
      restored,
      preserved: await repo.load(),
    };
  }, values);
  expect(result.raw).toEqual(result.old);
  expect(result.loaded?.draft).toEqual(values);
  expect(result.exported.schemaVersion).toBe(6);
  expect(result.exported.goalPlan).toEqual(result.loaded);
  expect(result.conflict).toBe(true);
  expect(result.restoredCount).toBe(1);
  expect(result.restored).toEqual(result.exported);
  expect(result.restoreConflict).toContain("目標計画と競合");
  expect(result.preserved).toEqual(result.saved);
});
test("Goal plan writes reject stale tabs and malformed stored values without overwriting", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async (scenario) => {
    const { IndexedDbGoalPlanRepository } = await import(
      new URL("src/infrastructure/indexeddb-goal-plan.ts", location.href).href
    );
    const { openAccountDatabase } = await import(
      new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href
    );
    const name = "synthetic-fire-plan-concurrency";
    const first = new IndexedDbGoalPlanRepository(name);
    const second = new IndexedDbGoalPlanRepository(name);
    const previousFirst = await first.load();
    const previousSecond = await second.load();
    const saved = await first.save(
      {
        id: "primary",
        draft: scenario,
        referenceMonth: "2026-09",
        updatedAt: "2026-09-05T00:00:00.000Z",
      },
      previousFirst,
    );
    let conflict = "";
    try {
      await second.save(
        { ...saved, draft: { ...scenario, target: "3300" }, updatedAt: "2026-09-05T00:01:00.000Z" },
        previousSecond,
      );
    } catch (error) {
      conflict = (error as Error).message;
    }
    const afterConflict = await first.load();

    const db = await openAccountDatabase(name);
    const transaction = db.transaction("goalPlans", "readwrite");
    transaction.objectStore("goalPlans").delete("primary");
    transaction.objectStore("goalPlans").put({ id: "unexpected", invalid: true });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
    let corrupt = "";
    try {
      await first.load();
    } catch (error) {
      corrupt = (error as Error).message;
    }
    const verify = await openAccountDatabase(name);
    const read = verify.transaction("goalPlans").objectStore("goalPlans").get("unexpected");
    const stored = await new Promise<unknown>((resolve, reject) => {
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    verify.close();
    const excessDb = await openAccountDatabase(name);
    const excessTransaction = excessDb.transaction("goalPlans", "readwrite");
    excessTransaction.objectStore("goalPlans").put({ id: "second", invalid: true });
    await new Promise<void>((resolve, reject) => {
      excessTransaction.oncomplete = () => resolve();
      excessTransaction.onerror = () => reject(excessTransaction.error);
    });
    excessDb.close();
    let excess = "";
    try {
      await first.load();
    } catch (error) {
      excess = (error as Error).message;
    }
    const countDb = await openAccountDatabase(name);
    const countRequest = countDb.transaction("goalPlans").objectStore("goalPlans").count();
    const count = await new Promise<number>((resolve, reject) => {
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    });
    countDb.close();
    return { conflict, afterConflict, corrupt, stored, excess, count };
  }, values);
  expect(result.conflict).toContain("別のタブ");
  expect(result.afterConflict?.draft.target).toBe("2200");
  expect(result.corrupt).toContain("検証できません");
  expect(result.stored).toEqual({ id: "unexpected", invalid: true });
  expect(result.excess).toContain("上限を超えています");
  expect(result.count).toBe(2);
});

test("v4 upgrade preserves both existing records and plans and rolls back failed schema changes", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { storageMigrationPlan } = await import(
      new URL("src/domain/storage-migrations.ts", location.href).href
    );
    const { openAccountDatabase } = await import(
      new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href
    );
    const account = {
      id: "synthetic",
      name: "保持",
      category: "cash",
      isActive: true,
      sortOrder: 0,
    };
    const legacy = {
      id: "primary",
      draft: {
        startingAssets: "",
        target: "",
        monthlyContribution: "",
        returnBps: "",
        inflationBps: "",
      },
      current: null,
      comparisons: [],
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    const create = (name: string) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name, 4);
        request.onupgradeneeded = () => {
          for (const step of storageMigrationPlan(0, 4)) {
            const store = step.existingStore
              ? request.transaction!.objectStore(step.store)
              : request.result.createObjectStore(step.store, { keyPath: step.keyPath });
            for (const index of step.indexes ?? [])
              store.createIndex(index.name, index.keyPath, { unique: index.unique });
          }
          request.transaction!.objectStore("accounts").add(account);
          request.transaction!.objectStore("firePlans").add(legacy);
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
      });
    const inspect = async (db: IDBDatabase) => {
      const tx = db.transaction(["accounts", "firePlans"]);
      const a = tx.objectStore("accounts").get("synthetic");
      const f = tx.objectStore("firePlans").get("primary");
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
      const output = {
        version: db.version,
        stores: Array.from(db.objectStoreNames),
        account: a.result,
        legacy: f.result,
      };
      db.close();
      return output;
    };
    await create("synthetic-v4-upgrade");
    const db = await openAccountDatabase("synthetic-v4-upgrade");
    const count = await new Promise<number>((resolve) => {
      const r = db.transaction("goalPlans").objectStore("goalPlans").count();
      r.onsuccess = () => resolve(r.result);
    });
    const upgraded = await inspect(db);
    await create("synthetic-v4-rollback");
    const original = IDBDatabase.prototype.createObjectStore;
    let failed = false;
    IDBDatabase.prototype.createObjectStore = function (name, options) {
      if (name === "goalPlans") throw new Error("synthetic migration failure");
      return original.call(this, name, options);
    };
    try {
      await openAccountDatabase("synthetic-v4-rollback");
    } catch {
      failed = true;
    } finally {
      IDBDatabase.prototype.createObjectStore = original;
    }
    const prior = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("synthetic-v4-rollback", 4);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return { upgraded, count, failed, rollback: await inspect(prior), account, legacy };
  });
  expect(result.upgraded.version).toBe(5);
  expect(result.upgraded.account).toEqual(result.account);
  expect(result.upgraded.legacy).toEqual(result.legacy);
  expect(result.count).toBe(0);
  expect(result.failed).toBe(true);
  expect(result.rollback.version).toBe(4);
  expect(result.rollback.stores).not.toContain("goalPlans");
  expect(result.rollback.account).toEqual(result.account);
  expect(result.rollback.legacy).toEqual(result.legacy);
});

test("a goal conflict cancels all backup additions and old backups preserve the goal", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async (draft) => {
    const { IndexedDbGoalPlanRepository } = await import(
      new URL("src/infrastructure/indexeddb-goal-plan.ts", location.href).href
    );
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    const name = "synthetic-goal-atomic";
    const plans = new IndexedDbGoalPlanRepository(name);
    const backup = new IndexedDbPortfolioRepository(name);
    const saved = await plans.save(
      { id: "primary", draft, referenceMonth: "2026-09", updatedAt: "2026-09-01T00:00:00.000Z" },
      null,
    );
    const current = await backup.exportBackup();
    let conflict = false;
    try {
      await backup.importBackup({
        ...current,
        accounts: [{ id: "new", name: "合成", category: "cash", isActive: true, sortOrder: 0 }],
        goalPlan: { ...saved, draft: { ...draft, cash: "123" } },
      });
    } catch {
      conflict = true;
    }
    const after = await backup.exportBackup();
    await backup.importBackup({
      schemaVersion: 1,
      accounts: [],
      monthlyCashFlows: [],
      accountBalanceSnapshots: [],
    });
    return { conflict, after, old: await plans.load(), saved };
  }, values);
  expect(result.conflict).toBe(true);
  expect(result.after.accounts).toEqual([]);
  expect(result.after.goalPlan).toEqual(result.saved);
  expect(result.old).toEqual(result.saved);
});
