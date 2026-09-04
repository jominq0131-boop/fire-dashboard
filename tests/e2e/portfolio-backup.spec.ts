import { expect, test } from "@playwright/test";
import { syntheticBackup } from "../fixtures/portfolio";

test("automatic latest assets, bounded chart, missing months, future exclusion and drilldown", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async (backup) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    const repo = new IndexedDbPortfolioRepository();
    backup.accounts.push({
      ...backup.accounts[0],
      id: "synthetic-b",
      name: "合成未入力",
      sortOrder: 1,
    });
    backup.accountBalanceSnapshots.push({
      ...backup.accountBalanceSnapshots[0],
      id: "future",
      month: "2199-12",
      balance: 999,
    });
    await repo.importBackup(backup);
  }, syntheticBackup());
  await page.reload();
  const overview = page.getByRole("region", { name: "資産の全体像" });
  await expect(overview.locator(".asset-value")).toHaveText("120 円");
  await expect(overview).toContainText("2026-09 月末として入力");
  await expect(overview).toContainText("残高入力 1 / 2");
  await expect(overview.locator("tbody tr")).toHaveCount(12);
  await expect(overview.locator("tr").filter({ hasText: "2026-09" })).toContainText("20 円 (20%)");
  await overview.getByRole("button", { name: "2026-08", exact: true }).click();
  const monthly = page.getByRole("region", { name: "月別記録" });
  await expect(monthly.getByLabel("対象月")).toHaveValue("2026-08");
  await expect(monthly.getByLabel("合成資産口座の残高")).toHaveValue("100");
  await expect(overview.locator(".asset-value")).toHaveText("120 円");
  await monthly.getByLabel("合成資産口座の残高").fill("999");
  page.once("dialog", (dialog) => dialog.dismiss());
  await overview.getByRole("button", { name: "2026-09", exact: true }).click();
  await expect(monthly.getByLabel("対象月")).toHaveValue("2026-08");
  await expect(monthly.getByLabel("合成資産口座の残高")).toHaveValue("999");
  await overview.getByLabel("グラフの終了月").fill("2025-12");
  await expect(overview.locator("tbody tr").last()).toContainText("2025-12");
  await expect(overview.locator("tbody")).not.toContainText("120 円");
  await expect(overview.locator(".asset-value")).toHaveText("120 円");
  await expect(overview.locator("svg")).toContainText("残高の記録はありません");
  await overview.getByLabel("グラフの終了月").fill("2026-09");
  await expect(overview.locator("tbody tr").last()).toContainText("2026-09");
  await page.screenshot({ path: "test-results/portfolio-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/portfolio-mobile.png", fullPage: true });
});

test("JSON preview, cancel, import, idempotence, export and round trip to empty browser", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const panel = page.getByRole("region", { name: "バックアップと復元" });
  const file = {
    name: "synthetic.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(syntheticBackup())),
  };
  await panel.getByLabel("復元するJSONファイル").setInputFiles(file);
  await expect(panel).toContainText("口座 1 件 / 現金収支 1 件 / 残高 2 件");
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await panel.getByRole("button", { name: "取り込みをキャンセル" }).click();
  await expect(panel.getByRole("heading", { name: "復元内容の確認" })).toHaveCount(0);
  await panel.getByLabel("復元するJSONファイル").setInputFiles(file);
  await panel.getByRole("button", { name: "確認した記録を取り込む" }).click();
  await expect(panel.getByRole("status")).toContainText("4 件を追加");
  await expect(page.getByRole("listitem")).toContainText("合成資産口座");
  await panel.getByLabel("復元するJSONファイル").setInputFiles(file);
  await panel.getByRole("button", { name: "確認した記録を取り込む" }).click();
  await expect(panel.getByRole("status")).toContainText("0 件を追加");
  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: "JSONバックアップを保存" }).click();
  const downloaded = await download;
  const path = await downloaded.path();
  expect(path).not.toBeNull();
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(page.url());
  const target = other.getByRole("region", { name: "バックアップと復元" });
  await target.getByLabel("復元するJSONファイル").setInputFiles(path!);
  await target.getByRole("button", { name: "確認した記録を取り込む" }).click();
  await expect(target.getByRole("status")).toContainText("4 件を追加");
  await expect(
    other.getByRole("region", { name: "資産の全体像" }).locator(".asset-value"),
  ).toHaveText("120 円");
  await context.close();
  const conflict = syntheticBackup();
  conflict.accountBalanceSnapshots[0].balance = 999;
  await panel
    .getByLabel("復元するJSONファイル")
    .setInputFiles({ ...file, buffer: Buffer.from(JSON.stringify(conflict)) });
  await panel.getByRole("button", { name: "確認した記録を取り込む" }).click();
  await expect(panel.getByRole("alert")).toContainText("競合");
  await panel
    .getByLabel("復元するJSONファイル")
    .setInputFiles({ ...file, buffer: Buffer.from('{"schemaVersion":99}') });
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(panel.getByRole("button", { name: "確認した記録を取り込む" })).toHaveCount(0);
});

test("backup transaction rollback, conflict races, preservation and bounded history reads", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async (backup) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    const repo = new IndexedDbPortfolioRepository("synthetic-backup-atomic");
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (value, key) {
      if (this.name === "accountBalanceSnapshots")
        throw new DOMException("synthetic quota", "QuotaExceededError");
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    };
    let failed = false;
    try {
      await repo.importBackup(backup);
    } catch {
      failed = true;
    } finally {
      IDBObjectStore.prototype.add = original;
    }
    const empty = await repo.exportBackup();
    const race = await Promise.allSettled([repo.importBackup(backup), repo.importBackup(backup)]);
    const preserved = await repo.exportBackup();
    const alternate = structuredClone(backup);
    alternate.monthlyCashFlows[0].id = "other-id";
    let duplicate = false;
    try {
      await repo.importBackup(alternate);
    } catch {
      duplicate = true;
    }
    const before = JSON.stringify(await repo.exportBackup());
    const addition = {
      schemaVersion: 1,
      accounts: [{ ...backup.accounts[0], id: "new-account" }],
      monthlyCashFlows: [],
      accountBalanceSnapshots: [
        { ...backup.accountBalanceSnapshots[0], id: "new-balance", accountId: "new-account" },
      ],
    };
    // A late asynchronous constraint error must roll back the earlier account add.
    IDBObjectStore.prototype.add = function (value, key) {
      if (this.name === "accountBalanceSnapshots")
        return original.call(this, backup.accountBalanceSnapshots[0]);
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    };
    let lateAbort = false;
    try {
      await repo.importBackup(addition);
    } catch {
      lateAbort = true;
    } finally {
      IDBObjectStore.prototype.add = original;
    }
    const preservedAfterAbort = before === JSON.stringify(await repo.exportBackup());
    const indexGet = IDBIndex.prototype.getAll;
    const requests: number[] = [];
    IDBIndex.prototype.getAll = function (query, count) {
      if (!count || count > 1200) throw new Error("unbounded history");
      requests.push(count);
      return indexGet.call(this, query, count);
    };
    const view = await repo.readOverview("2026-09");
    IDBIndex.prototype.getAll = indexGet;
    const count = IDBObjectStore.prototype.count;
    IDBObjectStore.prototype.count = function (query) {
      const r = count.call(this, query);
      if (this.name === "accounts") Object.defineProperty(r, "result", { get: () => 101 });
      return r;
    };
    let oversized = false;
    try {
      await repo.exportBackup();
    } catch {
      oversized = true;
    } finally {
      IDBObjectStore.prototype.count = count;
    }
    return {
      failed,
      empty,
      race: race.map((r) => (r.status === "fulfilled" ? r.value : "error")),
      preserved,
      duplicate,
      lateAbort,
      preservedAfterAbort,
      requests,
      months: view.months.length,
      oversized,
      unchanged: before === JSON.stringify(await repo.exportBackup()),
    };
  }, syntheticBackup());
  expect(result.failed).toBe(true);
  expect(result.empty.accounts).toEqual([]);
  expect(result.empty.monthlyCashFlows).toEqual([]);
  expect(result.empty.accountBalanceSnapshots).toEqual([]);
  expect(result.race.sort()).toEqual([0, 4]);
  expect(result.preserved).toEqual({ ...syntheticBackup(), schemaVersion: 2 });
  expect(result.duplicate).toBe(true);
  expect(result.lateAbort).toBe(true);
  expect(result.preservedAfterAbort).toBe(true);
  expect(result.requests).toEqual([1200]);
  expect(result.months).toBe(12);
  expect(result.oversized).toBe(true);
  expect(result.unchanged).toBe(true);
});
