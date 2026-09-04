import { expect, test } from "@playwright/test";

test("navigation and storage disclosure remain usable on desktop and narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "本文へ移動" })).toBeFocused();
  await page.getByRole("navigation").getByRole("link", { name: "月別記録", exact: true }).click();
  await expect(page).toHaveURL(/#monthly$/);
  await expect(page.getByLabel("対象月")).toBeInViewport();
  await page.getByRole("navigation").getByRole("link", { name: "口座管理", exact: true }).click();
  await page.getByText("保存と口座について", { exact: true }).click();
  await expect(page.getByText(/口座番号は入力しないでください。口座は休止中/)).toBeVisible();
  await page.getByText("保存と口座について", { exact: true }).click();
  await page.goto("/");
  await expect(page.getByRole("button", { name: "口座を追加", exact: true })).toBeEnabled();
  await page.screenshot({ path: "test-results/design-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/design-mobile.png", fullPage: true });
  await page.getByRole("navigation").getByRole("link", { name: "月別記録", exact: true }).click();
  await expect(page.getByLabel("対象月")).toBeInViewport();
});
