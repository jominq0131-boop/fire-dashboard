import { expect, test } from "@playwright/test";

test("brand metadata and install icons ship from the app base", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("fire. | 資産記録とFIRE試算");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /端末内で安全に管理/,
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0b1420");

  for (const selector of [
    'link[rel="icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="manifest"]',
  ]) {
    const href = await page.locator(selector).getAttribute("href");
    expect(href).toBeTruthy();
    expect((await request.get(new URL(href!, page.url()).href)).ok()).toBe(true);
  }

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(new URL(manifestHref!, page.url()).href)).json();
  expect(manifest).toMatchObject({
    short_name: "fire.",
    display: "standalone",
    theme_color: "#0b1420",
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "app-icon.svg", purpose: "any maskable" }),
      expect.objectContaining({ src: "apple-touch-icon.png", sizes: "180x180" }),
    ]),
  );

  const iconSize = await page.evaluate(
    () =>
      new Promise<[number, number]>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
        image.onerror = () => reject(new Error("Apple touch icon failed to load"));
        image.src = new URL(
          document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')!.href,
        ).href;
      }),
  );
  expect(iconSize).toEqual([180, 180]);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({ path: "test-results/branded-shell-desktop.png", fullPage: true });
});

test("mobile navigation behaves like a safe-area tab bar and typography stays readable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const sidebar = page.locator(".sidebar");
  const navItems = sidebar.getByRole("link");
  await expect(navItems).toHaveCount(5);
  const shell = await sidebar.evaluate((node) => {
    const styles = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return {
      position: styles.position,
      bottom: Math.round(innerHeight - rect.bottom),
      columns: getComputedStyle(node.querySelector("nav")!).gridTemplateColumns.split(" ").length,
    };
  });
  expect(shell).toEqual({ position: "fixed", bottom: 0, columns: 5 });

  for (const item of await navItems.all()) {
    await expect(item.locator("svg")).toBeVisible();
    expect(
      Number.parseFloat(await item.evaluate((node) => getComputedStyle(node).fontSize)),
    ).toBeGreaterThanOrEqual(11);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/branded-shell-mobile.png" });
  await page.screenshot({ path: "test-results/branded-flow-mobile.png", fullPage: true });
});

test("reduced-motion preference removes product transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page
    .getByRole("button", { name: "口座を追加", exact: true })
    .evaluate((node) => getComputedStyle(node).transitionDuration);
  expect(duration.split(",").every((value) => Number.parseFloat(value) <= 0.01)).toBe(true);
});
