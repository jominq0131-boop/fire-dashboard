import { expect, test } from "@playwright/test";
import { syntheticBackup } from "../fixtures/portfolio";
test("inspect history with keyboard and pointer, filter, drill down and guarded forecast handoff", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-04T03:00:00Z"));
  await page.goto("/");
  await page.evaluate(async (data) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    await new IndexedDbPortfolioRepository().importBackup(data);
  }, syntheticBackup());
  await page.reload();
  const overview = page.getByRole("region", { name: "資産の全体像", exact: true }),
    detail = page.getByRole("region", { name: "選択月の詳細" }),
    fire = page.locator("#fire");
  await expect(detail).toContainText("2026-09 の記録");
  await expect(detail.locator("dd")).toHaveText(["100 円", "20 円", "30 円"]);
  await expect(detail).toContainText("20 円");
  await expect(overview.locator(".recharts-line-curve")).toHaveCount(1);
  await expect(overview.locator(".recharts-area-area")).toHaveCount(1);
  const slider = overview.getByRole("slider", { name: "月別資産チャートの選択位置" });
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(detail).toContainText("2026-08 の記録");
  await expect(detail.locator("dd")).toHaveText(["未入力", "未入力", "未入力"]);
  await expect(detail).toContainText("100 円");
  await detail.getByRole("button", { name: "選択月の入力・編集へ" }).click();
  await expect(
    page.getByRole("region", { name: "月別記録", exact: true }).getByLabel("対象月"),
  ).toHaveValue("2026-08");
  await detail.getByRole("button", { name: "この記録額からFIREを試算" }).click();
  await expect(fire.getByLabel("開始資産（円）", { exact: true })).toHaveValue("100");
  await fire.getByLabel("開始資産（円）", { exact: true }).fill("999");
  page.once("dialog", (dialog) => dialog.dismiss());
  await detail.getByRole("button", { name: "この記録額からFIREを試算" }).click();
  await expect(fire.getByLabel("開始資産（円）", { exact: true })).toHaveValue("999");
  page.once("dialog", (dialog) => dialog.accept());
  await detail.getByRole("button", { name: "この記録額からFIREを試算" }).click();
  await expect(fire.getByLabel("開始資産（円）", { exact: true })).toHaveValue("100");
  await overview.getByLabel("表示する口座", { exact: true }).selectOption("synthetic-a");
  await expect(overview.locator(".chart-inspector")).toContainText("合成資産口座");
  const svg = overview.getByRole("img", { name: "月別資産チャート" });
  const box = (await svg.boundingBox())!;
  await svg.click({ position: { x: (box.width * 704) / 736, y: box.height * 0.5 } });
  await expect(detail).toContainText("2026-09 の記録");
  await overview.getByLabel("表示期間", { exact: true }).selectOption("6");
  await expect(slider).toHaveAttribute("max", "5");
  await slider.fill("0");
  await expect(detail.getByRole("button", { name: "この記録額からFIREを試算" })).toBeDisabled();
  await slider.fill("5");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await overview
    .locator(".history-explorer")
    .screenshot({ path: "test-results/history-interactive-mobile.png" });
});

test("forecast and comparison line toggles, horizon and year inspection", async ({ page }) => {
  await page.goto("/");
  const fire = page.locator("#fire");
  for (const [label, value] of [
    ["開始資産（円）", "0"],
    ["目標資産・今日の価値（円）", "1200"],
    ["毎月の積立額（円）", "100"],
    ["想定年利（%）", "0"],
    ["想定インフレ率（%）", "0"],
  ])
    await fire.getByLabel(label, { exact: true }).fill(value);
  await fire.getByRole("button", { name: "シミュレーションする" }).click();
  const chart = page.getByRole("region", { name: "今回の予測チャート", exact: true });
  await chart.getByRole("slider").fill("10");
  await expect(chart.locator(".chart-inspector")).toContainText("12,000 円");
  await chart.getByRole("button", { name: "今回の試算 目標（破線）" }).click();
  await expect(chart.locator(".recharts-line-curve")).toHaveCount(1);
  await chart.getByLabel("予測グラフの期間").selectOption("100");
  await expect(chart.getByRole("slider")).toHaveAttribute("max", "100");
  await fire.getByRole("button", { name: "この結果を比較に追加" }).click();
  await fire.getByLabel("毎月の積立額（円）", { exact: true }).fill("200");
  await expect(chart).toHaveCount(0);
  await fire.getByRole("button", { name: "シミュレーションする" }).click();
  await fire.getByRole("button", { name: "この結果を比較に追加" }).click();
  const comparison = page.getByRole("region", { name: "シナリオ比較チャート", exact: true });
  await comparison.getByRole("slider").fill("10");
  await expect(comparison.locator(".chart-inspector")).toContainText("12,000 円");
  await expect(comparison.locator(".chart-inspector")).toContainText("24,000 円");
  await expect(comparison.locator(".recharts-line-curve")).toHaveCount(4);
  await comparison.screenshot({ path: "test-results/forecast-interactive-desktop.png" });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});
test("overview cash reads are bounded, validated and read-only", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async (data) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    const repo = new IndexedDbPortfolioRepository();
    await repo.importBackup(data);
    const original = IDBIndex.prototype.getAll,
      limits: number[] = [];
    IDBIndex.prototype.getAll = function (query, count) {
      if (this.objectStore.name === "monthlyCashFlows") {
        if (!count || count > 12) throw new Error("unbounded cash");
        limits.push(count);
      }
      return original.call(this, query, count);
    };
    let income;
    try {
      income = (await repo.readOverview("2026-09")).months.at(-1).records.cash.income;
    } finally {
      IDBIndex.prototype.getAll = original;
    }
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("fire-dashboard", 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("monthlyCashFlows", "readwrite");
        tx.objectStore("monthlyCashFlows").put({ ...data.monthlyCashFlows[0], income: -1 });
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
    let rejected = false;
    try {
      await repo.readOverview("2026-09");
    } catch {
      rejected = true;
    }
    return { income, limits, rejected };
  }, syntheticBackup());
  expect(result).toEqual({ income: 100, limits: [12], rejected: true });
});
test("overflow totals stay distinct from missing data and cannot seed a forecast", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-04T03:00:00Z"));
  await page.goto("/");
  const backup = syntheticBackup();
  backup.accounts.push({ ...backup.accounts[0], id: "second", name: "合成2", sortOrder: 1 });
  backup.accountBalanceSnapshots[1].balance = Number.MAX_SAFE_INTEGER;
  backup.accountBalanceSnapshots.push({
    ...backup.accountBalanceSnapshots[1],
    id: "second-b",
    accountId: "second",
    balance: 1,
  });
  await page.evaluate(async (data) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    await new IndexedDbPortfolioRepository().importBackup(data);
  }, backup);
  await page.reload();
  const detail = page.getByRole("region", { name: "選択月の詳細" });
  await expect(detail).toContainText("計算範囲超過");
  await expect(detail.getByRole("button", { name: "この記録額からFIREを試算" })).toBeDisabled();
});
