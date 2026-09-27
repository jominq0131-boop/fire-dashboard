import { expect, test } from "@playwright/test";

test("shows the dashboard empty state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FIRE 대시보드" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "금융 기록을 월별로 남겨 보세요" })).toBeVisible();
  await expect(page.getByText("총 금융자산", { exact: true })).toBeVisible();
});
