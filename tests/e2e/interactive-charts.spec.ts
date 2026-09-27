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
  const overview = page.getByRole("region", { name: "전체 자산 현황", exact: true }),
    detail = page.getByRole("region", { name: "선택 월 상세" }),
    fire = page.locator("#fire");
  await expect(detail).toContainText("2026-09 기록");
  await expect(detail.locator("dd")).toHaveText(["100 엔", "20 엔", "30 엔"]);
  await expect(detail).toContainText("20 엔");
  await expect(overview.locator(".recharts-line-curve")).toHaveCount(1);
  await expect(overview.locator(".recharts-area-area")).toHaveCount(1);
  const slider = overview.getByRole("slider", { name: "월별 자산 차트 선택 위치" });
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(detail).toContainText("2026-08 기록");
  await expect(detail.locator("dd")).toHaveText(["미입력", "미입력", "미입력"]);
  await expect(detail).toContainText("100 엔");
  await detail.getByRole("button", { name: "선택 월 입력·편집으로" }).click();
  await expect(
    page.getByRole("region", { name: "월별 기록", exact: true }).getByLabel("대상 월"),
  ).toHaveValue("2026-08");
  await detail.getByRole("button", { name: "이 기록액으로 FIRE 계산" }).click();
  await expect(fire.getByLabel("시작 자산(엔)", { exact: true })).toHaveValue("100");
  await fire.getByLabel("시작 자산(엔)", { exact: true }).fill("999");
  page.once("dialog", (dialog) => dialog.dismiss());
  await detail.getByRole("button", { name: "이 기록액으로 FIRE 계산" }).click();
  await expect(fire.getByLabel("시작 자산(엔)", { exact: true })).toHaveValue("999");
  page.once("dialog", (dialog) => dialog.accept());
  await detail.getByRole("button", { name: "이 기록액으로 FIRE 계산" }).click();
  await expect(fire.getByLabel("시작 자산(엔)", { exact: true })).toHaveValue("100");
  await overview.getByLabel("표시할 계좌", { exact: true }).selectOption("synthetic-a");
  await expect(overview.locator(".chart-inspector")).toContainText("합성자산계좌");
  const svg = overview.getByRole("img", { name: "월별 자산 차트" });
  const box = (await svg.boundingBox())!;
  await svg.click({ position: { x: (box.width * 704) / 736, y: box.height * 0.5 } });
  await expect(detail).toContainText("2026-09 기록");
  await overview.getByLabel("표시 기간", { exact: true }).selectOption("6");
  await expect(slider).toHaveAttribute("max", "5");
  await slider.fill("0");
  await expect(detail.getByRole("button", { name: "이 기록액으로 FIRE 계산" })).toBeDisabled();
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
    ["시작 자산(엔)", "0"],
    ["목표 자산·현재 가치(엔)", "1200"],
    ["월 적립액(엔)", "100"],
    ["가정 연 수익률(%)", "0"],
    ["가정 물가상승률(%)", "0"],
  ])
    await fire.getByLabel(label, { exact: true }).fill(value);
  await fire.getByRole("button", { name: "시뮬레이션 실행" }).click();
  const chart = page.getByRole("region", { name: "현재 예측 차트", exact: true });
  await chart.getByRole("slider").fill("10");
  await expect(chart.locator(".chart-inspector")).toContainText("12,000 엔");
  await chart.getByRole("button", { name: "현재 계산 목표(파선)" }).click();
  await expect(chart.locator(".recharts-line-curve")).toHaveCount(1);
  await chart.getByLabel("예측 그래프 기간").selectOption("100");
  await expect(chart.getByRole("slider")).toHaveAttribute("max", "100");
  await fire.getByRole("button", { name: "이 결과를 비교에 추가" }).click();
  await fire.getByLabel("월 적립액(엔)", { exact: true }).fill("200");
  await expect(chart).toHaveCount(0);
  await fire.getByRole("button", { name: "시뮬레이션 실행" }).click();
  await fire.getByRole("button", { name: "이 결과를 비교에 추가" }).click();
  const comparison = page.getByRole("region", { name: "시나리오 비교 차트", exact: true });
  await comparison.getByRole("slider").fill("10");
  await expect(comparison.locator(".chart-inspector")).toContainText("12,000 엔");
  await expect(comparison.locator(".chart-inspector")).toContainText("24,000 엔");
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
      const request = indexedDB.open("fire-dashboard", 5);
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
  backup.accounts.push({ ...backup.accounts[0], id: "second", name: "합성2", sortOrder: 1 });
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
  const detail = page.getByRole("region", { name: "선택 월 상세" });
  await expect(detail).toContainText("계산 범위 초과");
  await expect(detail.getByRole("button", { name: "이 기록액으로 FIRE 계산" })).toBeDisabled();
});
