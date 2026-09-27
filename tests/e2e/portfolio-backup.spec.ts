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
      name: "합성미입력",
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
  const overview = page.getByRole("region", { name: "전체 자산 현황" });
  await expect(overview.locator(".asset-value")).toHaveText("120 엔");
  await expect(overview).toContainText("2026-09 월말 기준 입력");
  await expect(overview).toContainText("잔액 입력 1 / 2");
  await expect(overview.locator("tbody tr")).toHaveCount(12);
  await expect(overview.locator("tr").filter({ hasText: "2026-09" })).toContainText("20 엔 (20%)");
  await overview.getByRole("button", { name: "2026-08", exact: true }).click();
  const monthly = page.getByRole("region", { name: "월별 기록" });
  await expect(monthly.getByLabel("대상 월")).toHaveValue("2026-08");
  await expect(monthly.getByLabel("합성자산계좌 잔액", { exact: true })).toHaveValue("100");
  await expect(overview.locator(".asset-value")).toHaveText("120 엔");
  await monthly.getByLabel("합성자산계좌 잔액", { exact: true }).fill("999");
  page.once("dialog", (dialog) => dialog.dismiss());
  await overview.getByRole("button", { name: "2026-09", exact: true }).click();
  await expect(monthly.getByLabel("대상 월")).toHaveValue("2026-08");
  await expect(monthly.getByLabel("합성자산계좌 잔액", { exact: true })).toHaveValue("999");
  await overview.getByLabel("그래프 종료 월").fill("2025-12");
  await expect(overview.locator("tbody tr").last()).toContainText("2025-12");
  await expect(overview.locator("tbody")).not.toContainText("120 엔");
  await expect(overview.locator(".asset-value")).toHaveText("120 엔");
  await expect(overview.locator(".chart-empty")).toContainText("표시할 기록이 없습니다");
  await overview.getByLabel("그래프 종료 월").fill("2026-09");
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
  const panel = page.getByRole("region", { name: "백업과 복원" });
  const file = {
    name: "synthetic.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(syntheticBackup())),
  };
  await panel.getByLabel("복원할 JSON 파일").setInputFiles(file);
  await expect(panel).toContainText("계좌 1개 / 현금 수입·지출 1개 / 잔액 2개");
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await panel.getByRole("button", { name: "가져오기 취소" }).click();
  await expect(panel.getByRole("heading", { name: "복원 내용 확인" })).toHaveCount(0);
  await panel.getByLabel("복원할 JSON 파일").setInputFiles(file);
  await panel.getByRole("button", { name: "확인한 기록 가져오기" }).click();
  await expect(panel.getByRole("status")).toContainText("4개를 추가");
  await expect(page.getByRole("listitem")).toContainText("합성자산계좌");
  await panel.getByLabel("복원할 JSON 파일").setInputFiles(file);
  await panel.getByRole("button", { name: "확인한 기록 가져오기" }).click();
  await expect(panel.getByRole("status")).toContainText("0개를 추가");
  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: "JSON 백업 저장" }).click();
  const downloaded = await download;
  const path = await downloaded.path();
  expect(path).not.toBeNull();
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(page.url());
  const target = other.getByRole("region", { name: "백업과 복원" });
  await target.getByLabel("복원할 JSON 파일").setInputFiles(path!);
  await target.getByRole("button", { name: "확인한 기록 가져오기" }).click();
  await expect(target.getByRole("status")).toContainText("4개를 추가");
  await expect(
    other.getByRole("region", { name: "전체 자산 현황" }).locator(".asset-value"),
  ).toHaveText("120 엔");
  await context.close();
  const conflict = syntheticBackup();
  conflict.accountBalanceSnapshots[0].balance = 999;
  await panel
    .getByLabel("복원할 JSON 파일")
    .setInputFiles({ ...file, buffer: Buffer.from(JSON.stringify(conflict)) });
  await panel.getByRole("button", { name: "확인한 기록 가져오기" }).click();
  await expect(panel.getByRole("alert")).toContainText("충돌");
  await panel
    .getByLabel("복원할 JSON 파일")
    .setInputFiles({ ...file, buffer: Buffer.from('{"schemaVersion":99}') });
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(panel.getByRole("button", { name: "확인한 기록 가져오기" })).toHaveCount(0);
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
  expect(result.preserved).toEqual({
    ...syntheticBackup(),
    schemaVersion: 7,
    firePlan: null,
    goalPlan: null,
  });
  expect(result.duplicate).toBe(true);
  expect(result.lateAbort).toBe(true);
  expect(result.preservedAfterAbort).toBe(true);
  expect(result.requests).toEqual([1200, 12]);
  expect(result.months).toBe(12);
  expect(result.oversized).toBe(true);
  expect(result.unchanged).toBe(true);
});
