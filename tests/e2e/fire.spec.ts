import { expect, test } from "@playwright/test";
import { syntheticBackup } from "../fixtures/portfolio";
test("loads recorded assets explicitly without writing records", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-04T03:00:00Z"));
  await page.goto("/");
  await page.evaluate(async (backup) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    await new IndexedDbPortfolioRepository().importBackup(backup);
  }, syntheticBackup());
  const fire = page.getByRole("region", { name: "FIREシミュレーション" });
  await fire.getByRole("button", { name: "記録した総資産を使う" }).click();
  await expect(fire.getByLabel("開始資産（円）", { exact: true })).toHaveValue("120");
  await expect(fire).toContainText("1/1口座の最後の記録");
  await fire.getByLabel("開始資産（円）", { exact: true }).fill("999");
  await fire.getByRole("button", { name: "記録した総資産を使う" }).click();
  await expect(fire.getByLabel("開始資産（円）", { exact: true })).toHaveValue("120");
});
test("explicit scenario, invalidation, reset and session-only inputs", async ({ page }) => {
  await page.goto("/");
  const fire = page.getByRole("region", { name: "FIREシミュレーション" });
  await fire.getByRole("button", { name: "記録した総資産を使う" }).click();
  await expect(fire.getByRole("alert")).toContainText("利用できる残高がありません");
  for (const [label, value] of [
    ["開始資産（円）", "0"],
    ["目標資産・今日の価値（円）", "1200"],
    ["毎月の積立額（円）", "100"],
    ["想定年利（%）", "0"],
    ["想定インフレ率（%）", "0"],
  ])
    await fire.getByLabel(label, { exact: true }).fill(value);
  await fire.getByRole("button", { name: "シミュレーションする" }).click();
  await expect(fire.getByRole("status")).toContainText("1年0か月後");
  await fire.getByLabel("毎月の積立額（円）", { exact: true }).fill("0");
  await expect(fire.getByRole("status")).toHaveCount(0);
  await fire.getByRole("button", { name: "シミュレーションする" }).click();
  await expect(fire.getByRole("status")).toContainText("100年以内に目標に届きません");
  await fire.getByLabel("想定年利（%）", { exact: true }).fill("100.01");
  await fire.getByRole("button", { name: "シミュレーションする" }).click();
  await expect(fire.getByRole("alert")).toBeVisible();
  await expect(fire.getByRole("status")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await fire.getByRole("button", { name: "仮定をクリア" }).click();
  await expect(fire.getByLabel("開始資産（円）", { exact: true })).toHaveValue("");
  await fire.getByLabel("開始資産（円）", { exact: true }).fill("123");
  await page.reload();
  await expect(fire.getByLabel("開始資産（円）", { exact: true })).toHaveValue("");
});
