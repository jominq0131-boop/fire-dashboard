import { expect, test } from "@playwright/test";

test("shows the dashboard empty state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FIRE Dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "まだ金融記録がありません" })).toBeVisible();
  await expect(page.getByText("金融資産", { exact: true })).toBeVisible();
});
