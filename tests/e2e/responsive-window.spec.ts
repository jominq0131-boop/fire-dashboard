import { expect, test } from "@playwright/test";
import { syntheticBackup } from "../fixtures/portfolio";

test("window resizing expands desktop content and reflows to mobile without reloading", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(async (data) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    await new IndexedDbPortfolioRepository().importBackup(data);
  }, syntheticBackup());
  await page.reload();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const sizes: { viewport: number; shell: number; chart: number }[] = [];
  for (const width of [1440, 1599, 1600, 1920, 2560, 1150, 861, 860, 560, 390, 320, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const shell = document.querySelector(".dashboard-shell")!.getBoundingClientRect();
          return Math.abs(shell.right - document.documentElement.clientWidth);
        }),
      )
      .toBeLessThanOrEqual(1);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await expect
      .poll(() =>
        page
          .locator(".recharts-surface")
          .first()
          .evaluate((node) => {
            const chart = node.getBoundingClientRect();
            return chart.width > 0 && chart.right <= document.documentElement.clientWidth;
          }),
      )
      .toBe(true);
    const metrics = await page.evaluate(() => ({
      shell: document.querySelector(".dashboard-shell")!.getBoundingClientRect().width,
      chart: document.querySelector(".recharts-surface")!.getBoundingClientRect().width,
      columns: getComputedStyle(
        document.querySelector(".workspace-grid")!,
      ).gridTemplateColumns.split(" ").length,
      nav: document.querySelector(".sidebar")!.getBoundingClientRect(),
    }));
    expect(metrics.columns).toBe(width <= 860 ? 1 : 2);
    if (width <= 860) expect(metrics.nav.bottom).toBeLessThanOrEqual(900);
    sizes.push({ viewport: width, shell: metrics.shell, chart: metrics.chart });
    if ([390, 1920, 2560].includes(width))
      await page.screenshot({ path: `test-results/window-${width}.png` });
  }
  expect(sizes[4].shell - sizes[3].shell).toBeGreaterThan(600);
  expect(sizes[4].chart).toBeGreaterThan(sizes[3].chart);
  expect(sizes[2].shell).toBeGreaterThanOrEqual(sizes[1].shell);
  expect(errors).toEqual([]);
});
