import { expect, test } from "@playwright/test";

test("summary reflects committed records, separates months and restores zero and partial balances", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of ["합성집계A", "합성집계B"]) {
    await page.getByLabel("계좌명", { exact: true }).fill(name);
    await page.getByRole("button", { name: "계좌 추가", exact: true }).click();
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
  }
  const panel = page.getByRole("region", { name: "월별 기록" });
  const summary = page.getByRole("article", { name: "월별 요약" });
  await panel.getByLabel("대상 월").fill("2026-09");
  await panel.getByRole("button", { name: "기록 불러오기" }).click();
  await expect(summary).toContainText("잔액 입력 0 / 2");
  await panel.getByLabel("수입", { exact: true }).fill("100");
  await panel.getByLabel("소비 지출", { exact: true }).fill("60");
  await panel.getByLabel("투자 납입", { exact: true }).fill("50");
  await expect(summary.locator("dd").first()).toHaveText("미입력");
  await panel.getByRole("button", { name: "현금 수입·지출 저장" }).click();
  await expect(summary.locator("dd")).toHaveText(["100 엔", "60 엔", "50 엔", "40 엔", "-10 엔"]);
  await panel.getByLabel("합성집계A 잔액", { exact: true }).fill("0");
  await panel.getByRole("button", { name: "합성집계A 잔액 저장" }).click();
  await expect(summary.locator(".asset-value")).toHaveText("0 엔");
  await expect(summary).toContainText("잔액 입력 1 / 2");
  // Failed write retains the last committed summary and the draft.
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("synthetic quota", "QuotaExceededError");
    };
  });
  await panel.getByLabel("수입", { exact: true }).fill("999");
  await panel.getByRole("button", { name: "현금 수입·지출 저장" }).click();
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(panel.getByLabel("수입", { exact: true })).toHaveValue("999");
  await expect(summary.locator("dd").first()).toHaveText("100 엔");
  page.on("dialog", (dialog) => dialog.accept());
  await panel.getByLabel("대상 월").fill("2026-10");
  await expect(summary).toHaveCount(0);
  await panel.getByRole("button", { name: "기록 불러오기" }).click();
  await expect(summary.locator("dd").first()).toHaveText("미입력");
  await page.reload();
  await panel.getByLabel("대상 월").fill("2026-09");
  await panel.getByRole("button", { name: "기록 불러오기" }).click();
  await expect(summary.locator("dd").first()).toHaveText("100 엔");
  await expect(summary.locator(".asset-value")).toHaveText("0 엔");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(summary).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/metrics-mobile.png", fullPage: true });
});

test("failed reread hides stale metrics and never claims empty data", async ({ page }) => {
  await page.goto("/");
  const panel = page.getByRole("region", { name: "월별 기록" });
  await panel.getByRole("button", { name: "기록 불러오기" }).click();
  await expect(page.getByRole("article", { name: "월별 요약" })).toBeVisible();
  await page.evaluate(() => {
    IDBObjectStore.prototype.count = function () {
      throw new Error("synthetic read failure");
    };
  });
  await panel.getByRole("button", { name: "기록 불러오기" }).click();
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("article", { name: "월별 요약" })).toHaveCount(0);
});
