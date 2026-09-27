import { expect, test } from "@playwright/test";
import { syntheticBackup } from "../fixtures/portfolio";

test("sparse rising and falling observations connect, with a unified design across every workspace", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-04T03:00:00Z"));
  const backup = syntheticBackup();
  backup.accounts.push({
    ...backup.accounts[0],
    id: "synthetic-investment",
    name: "합성투자계좌",
    category: "nisa_growth",
    sortOrder: 1,
  });
  backup.accountBalanceSnapshots = [
    ["2026-01", 2000000],
    ["2026-03", 2400000],
    ["2026-04", 2200000],
    ["2026-09", 3000000],
  ].map(([month, balance], i) => ({
    ...backup.accountBalanceSnapshots[0],
    id: `synthetic-${i}`,
    month: String(month),
    balance: Number(balance),
  }));
  backup.accountBalanceSnapshots.push({
    ...backup.accountBalanceSnapshots[3],
    id: "synthetic-investment-balance",
    accountId: "synthetic-investment",
    balance: 1000000,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await page.evaluate(async (data) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    await new IndexedDbPortfolioRepository().importBackup(data);
  }, backup);
  await page.reload();
  const chart = page.locator(".history-explorer .interactive-chart");
  await expect(chart.locator(".observation-bridge .recharts-line-curve")).toHaveCount(2);
  for (const path of await chart.locator(".observation-bridge .recharts-line-curve").all()) {
    await expect(path).toHaveAttribute("d", /L/);
    await expect(path).toHaveAttribute("stroke-dasharray", "6 4");
  }
  const directPaths = await chart
    .locator(".observed-trend .recharts-line-curve")
    .evaluateAll((paths) => paths.map((p) => p.getAttribute("d") ?? ""));
  expect(directPaths.some((d) => /L/.test(d))).toBe(true);
  await chart.getByRole("slider").fill("4");
  await expect(chart.locator(".chart-inspector")).toContainText("2026-02");
  await expect(chart.locator(".chart-inspector")).toContainText("잔액 미기록");
  await chart.getByRole("slider").fill("11");
  await chart.screenshot({ path: "test-results/connected-sparse-desktop.png" });
  const fire = page.locator("#fire");
  for (const [label, value] of [
    ["시작 자산(엔)", "4000000"],
    ["목표 자산·현재 가치(엔)", "30000000"],
    ["월 적립액(엔)", "100000"],
    ["가정 연 수익률(%)", "4"],
    ["가정 물가상승률(%)", "2"],
  ])
    await fire.getByLabel(label, { exact: true }).fill(value);
  await fire.getByRole("button", { name: "시뮬레이션 실행" }).click();
  await expect(fire.locator(".recharts-line-curve")).toHaveCount(2);
  await page.getByRole("navigation").getByRole("link", { name: "월별 기록", exact: true }).click();
  await page.getByLabel("대상 월", { exact: true }).fill("2026-09");
  await page.getByRole("button", { name: "기록 불러오기", exact: true }).click();
  for (const [name, locator] of [
    ["records", page.locator("#monthly")],
    ["accounts", page.locator("#accounts")],
    ["fire", fire],
    ["backup", page.locator("#backup")],
  ] as const) {
    await locator.screenshot({ path: `test-results/unified-${name}-desktop.png` });
  }
  const panels = await page
    .locator(
      ".asset-card, .account-panel, .start-card, .sidebar, .analysis-summary > div, .month-inspector, .fire-fields input",
    )
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        bg: getComputedStyle(n).backgroundColor,
        color: getComputedStyle(n).color,
      })),
    );
  for (const p of panels) {
    const rgb = p.bg
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number);
    expect(Math.max(...rgb)).toBeLessThan(85);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "test-results/unified-overview-desktop.png" });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await chart.screenshot({ path: "test-results/connected-sparse-mobile.png" });
  await page.locator("#monthly").screenshot({ path: "test-results/unified-records-mobile.png" });
  await page.locator("#backup").screenshot({ path: "test-results/unified-backup-mobile.png" });
});
