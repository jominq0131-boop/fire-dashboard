import { expect, test, type Page } from "@playwright/test";

// Only this test's isolated context receives these synthetic records.
async function seed(page: Page, count: number) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "口座を追加", exact: true })).toBeEnabled();
  await page.evaluate(async (total) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("fire-dashboard", 3);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("accounts", "readwrite");
        for (let index = 0; index < total; index++) {
          tx.objectStore("accounts").add({
            id: `synthetic-${index}`,
            name: `上限テスト${index}`,
            category: "cash",
            isActive: index % 2 === 0,
            sortOrder: index,
          });
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }, count);
}

test("concurrent creates respect the total cap, with bounded reads and editing at capacity", async ({
  page,
}) => {
  await seed(page, 99);
  const result = await page.evaluate(async () => {
    const modulePath = new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href;
    const { IndexedDbAccountRepository } = await import(modulePath);
    const repository = new IndexedDbAccountRepository();
    const original = IDBObjectStore.prototype.getAll;
    const limits: number[] = [];
    IDBObjectStore.prototype.getAll = function (query, count) {
      if (!count || count > 100) throw new Error("Unbounded account read");
      limits.push(count);
      return original.call(this, query, count);
    };
    try {
      const results = await Promise.allSettled([
        repository.create({ name: "最後の候補A", category: "cash", isActive: true }),
        repository.create({ name: "最後の候補B", category: "cash", isActive: true }),
      ]);
      const accounts = await repository.list();
      return {
        success: results.filter((item) => item.status === "fulfilled").length,
        failures: results
          .filter((item) => item.status === "rejected")
          .map((item) => item.reason.message),
        total: accounts.length,
        inactiveIncluded: accounts.some((item: { isActive: boolean }) => !item.isActive),
        limits,
      };
    } finally {
      IDBObjectStore.prototype.getAll = original;
    }
  });
  expect(result.success).toBe(1);
  expect(result.failures).toHaveLength(1);
  expect(result.failures[0]).toContain("100件");
  expect(result.total).toBe(100);
  expect(result.inactiveIncluded).toBe(true);
  expect(result.limits.length).toBeGreaterThan(0);
  expect(result.limits.every((limit) => limit === 100)).toBe(true);
  await page.reload();
  await expect(page.getByRole("listitem")).toHaveCount(100);
  await expect(page.getByRole("button", { name: "口座を追加", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "上限テスト0を編集", exact: true }).click();
  await page.getByLabel("口座名", { exact: true }).fill("上限でも編集可能");
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("保存しました");
  await page.reload();
  await expect(page.getByRole("listitem")).toHaveCount(100);
  await expect(
    page.getByRole("button", { name: "上限でも編集可能を編集", exact: true }),
  ).toBeVisible();
});

test("oversized existing stores are preserved and rejected before materializing records", async ({
  page,
}) => {
  await seed(page, 101);
  await page.addInitScript(() => {
    IDBObjectStore.prototype.getAll = function () {
      throw new Error("Oversized store must not be read");
    };
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("100件");
  await expect(page.getByRole("alert")).toContainText("削除していません");
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "口座を追加", exact: true })).toBeDisabled();
  const preserved = await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open("fire-dashboard", 3);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("accounts");
        const store = tx.objectStore("accounts");
        const count = store.count();
        const first = store.get("synthetic-0");
        const last = store.get("synthetic-100");
        tx.oncomplete = () => {
          db.close();
          resolve({ count: count.result, first: first.result.name, last: last.result.name });
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  });
  expect(preserved).toEqual({ count: 101, first: "上限テスト0", last: "上限テスト100" });
});

test("repeated reads and edits keep row counts and payloads bounded without using Web Storage", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new Error("Account data must not use Web Storage");
    };
  });
  await seed(page, 100);
  const result = await page.evaluate(async () => {
    const modulePath = new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href;
    const { IndexedDbAccountRepository } = await import(modulePath);
    const repository = new IndexedDbAccountRepository();
    let largestRead = 0;
    for (let index = 0; index < 20; index++) {
      const accounts = await repository.list();
      largestRead = Math.max(largestRead, accounts.length);
      await repository.update(accounts[0], { ...accounts[0], name: `反復テスト${index}` });
    }
    const final = await repository.list();
    return {
      largestRead,
      total: final.length,
      fieldCounts: Array.from(new Set(final.map((item: object) => Object.keys(item).length))),
      latest: final[0].name,
    };
  });
  expect(result).toEqual({
    largestRead: 100,
    total: 100,
    fieldCounts: [5],
    latest: "反復テスト19",
  });
  await page.reload();
  await expect(page.getByRole("listitem")).toHaveCount(100);
  await page.getByRole("button", { name: "反復テスト19を休止", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("休止しました");
  await expect(page.getByRole("listitem")).toHaveCount(100);
});
