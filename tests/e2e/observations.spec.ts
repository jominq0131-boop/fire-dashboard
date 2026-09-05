import { expect, test } from "@playwright/test";
import { syntheticBackup } from "../fixtures/portfolio";

test("resume today, retain last-known accounts, show actual dates and preserve failed drafts", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-04T03:00:00Z"));
  await page.goto("/");
  await page.evaluate(async (backup) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    backup.schemaVersion = 2;
    backup.accounts.push(
      { ...backup.accounts[0], id: "old", name: "合成古い口座", sortOrder: 1 },
      { ...backup.accounts[0], id: "missing", name: "合成未記録", sortOrder: 2 },
    );
    backup.accountBalanceSnapshots.push({
      ...backup.accountBalanceSnapshots[0],
      id: "old-b",
      accountId: "old",
      month: "2026-07",
      balance: 300,
      asOfDate: "2026-07-01",
    });
    await new IndexedDbPortfolioRepository().importBackup(backup);
  }, syntheticBackup());
  await page.reload();
  const overview = page.getByRole("region", { name: "資産の全体像" }),
    monthly = page.getByRole("region", { name: "月別記録" });
  await expect(overview.locator(".asset-value")).toHaveText("420 円");
  await expect(overview).toContainText("更新から32日以上");
  await expect(overview).toContainText("未記録");
  await overview.getByRole("button", { name: "合成古い口座を更新" }).click();
  await expect(monthly.getByLabel("合成古い口座の残高", { exact: true })).toBeFocused();
  await expect(monthly.getByLabel("合成古い口座の確認日")).toHaveValue("2026-09-04");
  await monthly.getByLabel("合成古い口座の残高", { exact: true }).fill("350");
  await monthly.getByRole("button", { name: "合成古い口座の残高を保存" }).click();
  await expect(overview.locator(".asset-value")).toHaveText("470 円");
  await expect(overview).toContainText("2026-09-04 確認");
  await expect(monthly.getByLabel("収入", { exact: true })).toHaveValue("100");
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("synthetic", "QuotaExceededError");
    };
  });
  await monthly.getByLabel("合成古い口座の残高", { exact: true }).fill("999");
  await monthly.getByRole("button", { name: "合成古い口座の残高を保存" }).click();
  await expect(monthly.getByRole("alert")).toBeVisible();
  await expect(overview.locator(".asset-value")).toHaveText("470 円");
  await expect(monthly.getByLabel("合成古い口座の残高", { exact: true })).toHaveValue("999");
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(overview.locator(".asset-value")).toHaveText("470 円");
  await page.screenshot({ path: "test-results/everyday-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/everyday-mobile.png", fullPage: true });
});

test("v2 to v4 migration rolls back on failure and preserves legacy records", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async (backup) => {
    const { storageMigrationPlan } = await import(
      new URL("src/domain/storage-migrations.ts", location.href).href
    );
    const { openAccountDatabase } = await import(
      new URL("src/infrastructure/indexeddb-accounts.ts", location.href).href
    );
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    const name = "synthetic-v2-observations";
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open(name, 2);
      r.onupgradeneeded = () => {
        for (const step of storageMigrationPlan(0, 2)) {
          const store = r.result.createObjectStore(step.store, { keyPath: step.keyPath });
          for (const i of step.indexes ?? [])
            store.createIndex(i.name, i.keyPath, { unique: i.unique });
        }
        for (const [store, rows] of Object.entries({
          accounts: backup.accounts,
          monthlyCashFlows: backup.monthlyCashFlows,
          accountBalanceSnapshots: backup.accountBalanceSnapshots,
        }))
          for (const row of rows) r.transaction!.objectStore(store).add(row);
      };
      r.onsuccess = () => {
        r.result.close();
        resolve();
      };
      r.onerror = () => reject(r.error);
    });
    const original = IDBObjectStore.prototype.createIndex;
    IDBObjectStore.prototype.createIndex = function (name, key, options) {
      if (name === "accountMonth") throw new Error("synthetic index failure");
      return original.call(this, name, key, options);
    };
    let failed = false;
    try {
      await openAccountDatabase(name);
    } catch {
      failed = true;
    } finally {
      IDBObjectStore.prototype.createIndex = original;
    }
    const oldVersion = await new Promise<number>((resolve, reject) => {
      const r = indexedDB.open(name, 2);
      r.onsuccess = () => {
        const version = r.result.version;
        r.result.close();
        resolve(version);
      };
      r.onerror = () => reject(r.error);
    });
    const db = await openAccountDatabase(name);
    const version = db.version;
    const index = db
      .transaction("accountBalanceSnapshots")
      .objectStore("accountBalanceSnapshots")
      .index("accountMonth");
    const indexKey = index.keyPath;
    const firePlanKey = db.transaction("firePlans").objectStore("firePlans").keyPath;
    db.close();
    const repo = new IndexedDbPortfolioRepository(name);
    const exported = await repo.exportBackup();
    const view = await repo.readOverview("2026-09", undefined, "2026-09-04");
    return {
      failed,
      oldVersion,
      version,
      indexKey,
      firePlanKey,
      exported,
      current: view.current.balances,
    };
  }, syntheticBackup());
  expect(result.failed).toBe(true);
  expect(result.oldVersion).toBe(2);
  expect(result.version).toBe(4);
  expect(result.indexKey).toEqual(["accountId", "month"]);
  expect(result.firePlanKey).toBe("id");
  expect(result.exported).toEqual({ ...syntheticBackup(), schemaVersion: 3, firePlan: null });
  expect(result.current).toEqual([syntheticBackup().accountBalanceSnapshots[1]]);
});
