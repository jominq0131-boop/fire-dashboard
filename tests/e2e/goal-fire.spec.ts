import { expect, test, type Page } from "@playwright/test";
import { syntheticBackup } from "../fixtures/portfolio";

async function fillGoal(page: Page, overrides: Record<string, string> = {}) {
  const goal = page.getByRole("region", { name: "今のペースで、目標に届くのはいつ？" });
  const values = {
    "現金・預金（円）": "10000000",
    "NISA・つみたて（円）": "0",
    "NISA・成長（円）": "0",
    "特定・一般口座の株式（円）": "39000000",
    "毎月の現金貯蓄（マイナス可）（円）": "100000",
    "毎月の株式・投信積立（円）": "100000",
    "目標金額（額面）（円）": "50000000",
    "株式の想定年利（%）": "0",
    "到達時の年間取り崩し率（%）": "3",
    "新NISAの保有取得額・合計（円）": "0",
    "うち成長投資枠の保有取得額（円）": "0",
    "今年のつみたて枠・買付済額（円）": "0",
    "今年の成長枠・買付済額（円）": "0",
    ...overrides,
  };
  for (const [label, value] of Object.entries(values))
    await goal.getByLabel(label, { exact: true }).fill(value);
  await goal.getByRole("button", { name: "目標到達を計算する" }).click();
  return goal;
}

test("exact goal arrival, composition, self-withdrawals and mobile chart", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date("2026-09-05T03:00:00Z"));
  await page.goto("/");
  const goal = await fillGoal(page);
  await expect(goal.getByRole("status")).toContainText("2027年2月 に到達");
  await expect(goal.getByRole("status")).toContainText("月 98,750 円");
  await expect(goal.getByRole("status")).toContainText("年間 1,185,000 円");
  await expect(goal.getByRole("region", { name: "目標到達時の資産構成" })).toContainText(
    "10,500,000 円",
  );
  await expect(goal.locator(".goal-breakdown")).toContainText("21.0%");
  await expect(goal.locator(".recharts-line-curve").first()).toBeVisible();
  const slider = goal.getByRole("slider");
  await slider.focus();
  await slider.press("End");
  await expect(goal.locator(".chart-inspector")).toContainText("50,000,000 円");
  for (const width of [390, 320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await goal.locator(".goal-result").screenshot({ path: "test-results/goal-fire-mobile.png" });
  await goal.getByLabel("目標金額（額面）（円）", { exact: true }).fill("60000000");
  await expect(goal.locator(".goal-result")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("bounded record seed uses completed-month cash savings without doubling investment", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-05T03:00:00Z"));
  await page.goto("/");
  const backup = syntheticBackup();
  backup.monthlyCashFlows.push({
    ...backup.monthlyCashFlows[0],
    id: "synthetic-old",
    month: "2026-08",
    income: 1000,
    expenses: 200,
    investmentContribution: 300,
  });
  await page.evaluate(async (data) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    await new IndexedDbPortfolioRepository().importBackup(data);
  }, backup);
  const goal = page.getByRole("region", { name: "今のペースで、目標に届くのはいつ？" });
  await goal.getByRole("button", { name: "現在の資産・貯蓄ペースを読み込む" }).click();
  await expect(goal.getByLabel("現金・預金（円）", { exact: true })).toHaveValue("120");
  await expect(goal.getByLabel("毎月の現金貯蓄（マイナス可）（円）", { exact: true })).toHaveValue(
    "500",
  );
  await expect(goal.getByLabel("毎月の株式・投信積立（円）", { exact: true })).toHaveValue("300");
  await expect(goal).toContainText("2026-08 の1件平均");
  await expect(goal.getByLabel("新NISAの保有取得額・合計（円）", { exact: true })).toHaveValue("");
});

test("nonarrival, shortfall, invalid limits and initial arrival are explicit", async ({ page }) => {
  await page.goto("/");
  let goal = await fillGoal(page, {
    "毎月の現金貯蓄（マイナス可）（円）": "0",
    "毎月の株式・投信積立（円）": "0",
  });
  await expect(goal.getByRole("status")).toContainText("100年以内には未到達");
  goal = await fillGoal(page, { "毎月の現金貯蓄（マイナス可）（円）": "-10000001" });
  await expect(goal.getByRole("alert")).toContainText("現金が不足");
  goal = await fillGoal(page, { "新NISAの保有取得額・合計（円）": "18000001" });
  await expect(goal.getByRole("alert")).toContainText("制度上限");
  goal = await fillGoal(page, { "目標金額（額面）（円）": "1" });
  await expect(goal.getByRole("status")).toContainText("すでに目標に到達");
});
