import { expect, test } from "@playwright/test";

test("navigation and storage disclosure remain usable on desktop and narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "본문으로 이동" })).toBeFocused();
  await page.getByRole("navigation").getByRole("link", { name: "월별 기록", exact: true }).click();
  await expect(page).toHaveURL(/#monthly$/);
  await expect(page.getByLabel("대상 월")).toBeInViewport();
  await page.getByRole("navigation").getByRole("link", { name: "계좌 관리", exact: true }).click();
  await page.getByText("저장과 계좌 안내", { exact: true }).click();
  await expect(page.getByText(/계좌번호는 입력하지 마세요. 중지한 계좌/)).toBeVisible();
  await page.getByText("저장과 계좌 안내", { exact: true }).click();
  await page.goto("/");
  await expect(page.getByRole("button", { name: "계좌 추가", exact: true })).toBeEnabled();
  await page.screenshot({ path: "test-results/design-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/design-mobile.png", fullPage: true });
  await page.getByRole("navigation").getByRole("link", { name: "월별 기록", exact: true }).click();
  await expect(page.getByLabel("대상 월")).toBeInViewport();
});
