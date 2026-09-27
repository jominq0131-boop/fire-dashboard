import { expect, test } from "@playwright/test";
import { syntheticBackup } from "../fixtures/portfolio";
test.use({ hasTouch: true });
test("chart download failure keeps account recording usable", async ({ page }) => {
  await page.route("**/FinancialChart.tsx", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("차트를 표시할 수 없습니다");
  await page.getByLabel("계좌명", { exact: true }).fill("합성오프라인계좌");
  await page.getByRole("button", { name: "계좌 추가", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("계좌를 이 기기에 저장했습니다");
  await expect(page.getByRole("listitem").filter({ hasText: "합성오프라인계좌" })).toBeVisible();
});

test("professional workspace: composite series, exact tooltip, zoom, cash flow and responsive layout", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-04T03:00:00Z"));
  const data = syntheticBackup();
  data.accounts.push({
    ...data.accounts[0],
    id: "synthetic-investment",
    name: "합성NISA",
    category: "nisa_growth",
    sortOrder: 1,
  });
  data.accountBalanceSnapshots = Array.from({ length: 9 }, (_, i) => [
    {
      ...data.accountBalanceSnapshots[0],
      id: `cash-${i}`,
      month: `2026-0${i + 1}`,
      balance: 2400000 + i * 85000,
    },
    {
      ...data.accountBalanceSnapshots[0],
      id: `investment-${i}`,
      accountId: "synthetic-investment",
      month: `2026-0${i + 1}`,
      balance: 3200000 + i * 170000,
    },
  ]).flat();
  data.monthlyCashFlows = Array.from({ length: 9 }, (_, i) => ({
    ...data.monthlyCashFlows[0],
    id: `flow-${i}`,
    month: `2026-0${i + 1}`,
    income: 450000,
    expenses: 190000 + i * 1000,
    investmentContribution: 150000,
  }));
  await page.goto("/");
  await page.evaluate(async (backup) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    await new IndexedDbPortfolioRepository().importBackup(backup);
  }, data);
  await page.reload();
  const workspace = page.locator(".history-explorer"),
    chart = workspace.locator(".interactive-chart");
  await expect(chart.locator(".recharts-area-area")).toHaveCount(1);
  await expect(chart.locator(".recharts-bar-rectangle")).toHaveCount(9);
  await expect(chart.locator(".chart-inspector")).toContainText("7,640,000 엔");
  await expect(chart.locator(".chart-inspector")).toContainText("4,560,000 엔");
  await chart.getByLabel("월별 자산 차트 확대 시작").selectOption("9");
  await expect(chart.getByRole("slider")).toHaveAttribute("min", "9");
  const plot = chart.getByRole("img");
  await plot.hover({ position: { x: 90, y: 110 } });
  await expect(chart.locator(".financial-tooltip")).toBeVisible();
  await expect(chart.locator(".financial-tooltip")).toContainText("2026-07");
  await expect(chart.locator(".financial-tooltip")).toContainText("7,130,000 엔");
  await chart.screenshot({ path: "test-results/pro-chart-tooltip.png" });
  await expect(workspace.getByRole("region", { name: "선택 월 상세" })).toContainText(
    "2026-07 기록",
  );
  await chart.getByLabel("월별 자산 차트 확대 종료").selectOption("9");
  await expect(chart.getByRole("slider")).toHaveAttribute("max", "9");
  await expect(chart.locator(".chart-inspector")).toContainText("7,130,000 엔");
  await chart.getByRole("button", { name: "전체 기간으로 돌아가기" }).click();
  await expect(chart.getByRole("slider")).toHaveAttribute("min", "0");
  await expect(chart.getByRole("slider")).toHaveAttribute("max", "11");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await chart.screenshot({ path: "test-results/pro-chart-desktop.png" });
  await workspace.getByRole("button", { name: "수입·지출·투자 비교", exact: true }).click();
  await expect(workspace.getByLabel("표시할 계좌", { exact: true })).toBeDisabled();
  await expect(chart.locator(".chart-inspector")).toContainText("450,000 엔");
  await expect(chart.locator(".chart-inspector")).toContainText("150,000 엔");
  await expect(chart.locator(".recharts-bar-rectangle")).toHaveCount(18);
  await chart.getByRole("slider").fill("0");
  await expect(chart.locator(".chart-inspector")).toContainText("기록 없음");
  await chart.getByRole("slider").fill("11");
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  expect((await chart.locator(".financial-plot").boundingBox())!.height).toBeGreaterThanOrEqual(
    300,
  );
  await chart.getByLabel("월별 수입·지출 차트 확대 시작").selectOption("9");
  const touchPlot = chart.getByRole("img"),
    bounds = (await touchPlot.boundingBox())!;
  await touchPlot.tap({ position: { x: bounds.width - 30, y: 150 } });
  await expect(chart.locator(".financial-tooltip")).toContainText("198,000 엔");
  await expect(chart.locator(".financial-tooltip")).toContainText("2026-09");
  const tipBounds = (await chart.locator(".financial-tooltip").boundingBox())!;
  expect(tipBounds.x).toBeGreaterThanOrEqual(bounds.x);
  expect(tipBounds.x + tipBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  await chart.screenshot({ path: "test-results/pro-cash-mobile.png" });
});

test("maximum yen stays exact; changed coverage uses a guide instead of a comparable segment", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-04T03:00:00Z"));
  const data = syntheticBackup();
  data.accounts[0].name = "합성".repeat(50);
  data.accounts.push({
    ...data.accounts[0],
    id: "investment",
    name: "합성투자",
    category: "taxable",
  });
  data.accountBalanceSnapshots[0].balance = 0;
  data.accountBalanceSnapshots[1].balance = 0;
  data.accountBalanceSnapshots.push({
    ...data.accountBalanceSnapshots[1],
    id: "investment-sep",
    accountId: "investment",
    balance: Number.MAX_SAFE_INTEGER,
  });
  await page.goto("/");
  await page.evaluate(async (backup) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    await new IndexedDbPortfolioRepository().importBackup(backup);
  }, data);
  await page.reload();
  const chart = page.locator(".history-explorer .interactive-chart");
  await expect(chart.locator(".chart-inspector")).toContainText("9,007,199,254,740,991 엔");
  // Comparable paths stay separate; an explicit dashed guide links the real observations.
  await expect(chart.locator(".observed-trend")).toHaveCount(3);
  await expect(chart.locator(".observed-trend .recharts-line-curve")).toHaveCount(3);
  for (const path of await chart.locator(".observed-trend .recharts-line-curve").all()) {
    expect(await path.getAttribute("d")).not.toMatch(/[LC]/);
  }
  await expect(chart.locator(".observation-bridge .recharts-line-curve")).toHaveCount(1);
  await expect(chart.locator(".observation-bridge .recharts-line-curve")).toHaveAttribute("d", /L/);
  await expect(chart.locator(".observation-bridge .recharts-line-curve")).toHaveAttribute(
    "stroke-dasharray",
    "6 4",
  );
  await expect(chart.locator(".financial-plot circle")).toHaveCount(3);
  await page
    .locator(".history-explorer")
    .getByLabel("표시할 계좌", { exact: true })
    .selectOption("synthetic-a");
  await expect(chart.locator(".chart-inspector")).toContainText("0 엔");
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});
