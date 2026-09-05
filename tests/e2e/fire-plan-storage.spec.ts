import { expect, test } from "@playwright/test";

const values = {
  startingAssets: "1000",
  target: "2200",
  monthlyContribution: "100",
  returnBps: "0",
  inflationBps: "0",
};

test("v3 to v4 adds an empty FIRE plan store without rewriting existing records", async ({
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
    const name = "synthetic-v3-fire-plan";
    const account = {
      id: "preserved",
      name: "保持口座",
      category: "cash",
      isActive: true,
      sortOrder: 0,
    };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, 3);
      request.onupgradeneeded = (event) => {
        for (const step of storageMigrationPlan(event.oldVersion, 3)) {
          const store = step.existingStore
            ? request.transaction!.objectStore(step.store)
            : request.result.createObjectStore(step.store, { keyPath: step.keyPath });
          for (const index of step.indexes ?? [])
            store.createIndex(index.name, index.keyPath, { unique: index.unique });
        }
        request.transaction!.objectStore("accounts").add(account);
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
    });
    const db = await openAccountDatabase(name);
    const transaction = db.transaction(["accounts", "firePlans"]);
    const accountRequest = transaction.objectStore("accounts").get(account.id);
    const planCountRequest = transaction.objectStore("firePlans").count();
    const keyPath = transaction.objectStore("firePlans").keyPath;
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    const output = {
      version: db.version,
      stores: Array.from(db.objectStoreNames),
      account: accountRequest.result,
      planCount: planCountRequest.result,
      keyPath,
    };
    db.close();
    return output;
  });
  expect(result).toEqual({
    version: 4,
    stores: ["accountBalanceSnapshots", "accounts", "firePlans", "monthlyCashFlows"],
    account: {
      id: "preserved",
      name: "保持口座",
      category: "cash",
      isActive: true,
      sortOrder: 0,
    },
    planCount: 0,
    keyPath: "id",
  });
});

test("FIRE plan writes reject stale tabs and malformed stored values without overwriting", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async (scenario) => {
    const { IndexedDbFirePlanRepository } = await import(
      new URL("src/infrastructure/indexeddb-fire-plan.ts", location.href).href
    );
    const { openAccountDatabase } = await import(
      new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href
    );
    const name = "synthetic-fire-plan-concurrency";
    const first = new IndexedDbFirePlanRepository(name);
    const second = new IndexedDbFirePlanRepository(name);
    const previousFirst = await first.load();
    const previousSecond = await second.load();
    const saved = await first.save(
      {
        id: "primary",
        draft: scenario,
        current: scenario,
        comparisons: [{ id: 1, values: scenario }],
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
    const transaction = db.transaction("firePlans", "readwrite");
    transaction.objectStore("firePlans").delete("primary");
    transaction.objectStore("firePlans").put({ id: "unexpected", invalid: true });
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
    const read = verify.transaction("firePlans").objectStore("firePlans").get("unexpected");
    const stored = await new Promise<unknown>((resolve, reject) => {
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    verify.close();
    const excessDb = await openAccountDatabase(name);
    const excessTransaction = excessDb.transaction("firePlans", "readwrite");
    excessTransaction.objectStore("firePlans").put({ id: "second", invalid: true });
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
    const countRequest = countDb.transaction("firePlans").objectStore("firePlans").count();
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
