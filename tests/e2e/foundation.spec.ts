import { expect, test } from "@playwright/test";

test("loads the project foundation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FIRE Dashboard" })).toBeVisible();
});

