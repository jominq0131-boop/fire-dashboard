import { expect, test } from "@playwright/test";

test("summary reflects committed records, separates months and restores zero and partial balances", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of ["合成集計A", "合成集計B"]) {
    await page.getByLabel("口座名", { exact: true }).fill(name);
    await page.getByRole("button", { name: "口座を追加", exact: true }).click();
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
  }
  const panel = page.getByRole("region", { name: "月別記録" });
  const summary = page.getByRole("article", { name: "月別サマリー" });
  await panel.getByLabel("対象月").fill("2026-09");
  await panel.getByRole("button", { name: "記録を読み込む" }).click();
  await expect(summary).toContainText("残高入力 0 / 2");
  await panel.getByLabel("収入", { exact: true }).fill("100");
  await panel.getByLabel("消費支出", { exact: true }).fill("60");
  await panel.getByLabel("投資への拠出", { exact: true }).fill("50");
  await expect(summary.locator("dd").first()).toHaveText("未入力");
  await panel.getByRole("button", { name: "現金収支を保存" }).click();
  await expect(summary.locator("dd")).toHaveText(["100 円", "60 円", "50 円", "40 円", "-10 円"]);
  await panel.getByLabel("合成集計Aの月末残高").fill("0");
  await panel.getByRole("button", { name: "合成集計Aの残高を保存" }).click();
  await expect(summary.locator(".asset-value")).toHaveText("0 円");
  await expect(summary).toContainText("残高入力 1 / 2");
  // Failed write retains the last committed summary and the draft.
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("synthetic quota", "QuotaExceededError");
    };
  });
  await panel.getByLabel("収入", { exact: true }).fill("999");
  await panel.getByRole("button", { name: "現金収支を保存" }).click();
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(panel.getByLabel("収入", { exact: true })).toHaveValue("999");
  await expect(summary.locator("dd").first()).toHaveText("100 円");
  page.on("dialog", (dialog) => dialog.accept());
  await panel.getByLabel("対象月").fill("2026-10");
  await expect(summary).toHaveCount(0);
  await panel.getByRole("button", { name: "記録を読み込む" }).click();
  await expect(summary.locator("dd").first()).toHaveText("未入力");
  await page.reload();
  await panel.getByLabel("対象月").fill("2026-09");
  await panel.getByRole("button", { name: "記録を読み込む" }).click();
  await expect(summary.locator("dd").first()).toHaveText("100 円");
  await expect(summary.locator(".asset-value")).toHaveText("0 円");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(summary).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/metrics-mobile.png", fullPage: true });
});

test("failed reread hides stale metrics and never claims empty data", async ({ page }) => {
  await page.goto("/");
  const panel = page.getByRole("region", { name: "月別記録" });
  await panel.getByRole("button", { name: "記録を読み込む" }).click();
  await expect(page.getByRole("article", { name: "月別サマリー" })).toBeVisible();
  await page.evaluate(() => {
    IDBObjectStore.prototype.count = function () {
      throw new Error("synthetic read failure");
    };
  });
  await panel.getByRole("button", { name: "記録を読み込む" }).click();
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("article", { name: "月別サマリー" })).toHaveCount(0);
});
