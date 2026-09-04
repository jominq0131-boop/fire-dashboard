import { expect, test } from "@playwright/test";
import { syntheticBackup } from "../fixtures/portfolio";

test("three immutable comparison snapshots, cap, removal, overflow and reload", async ({
  page,
}) => {
  await page.goto("/");
  const fire = page.locator("#fire"),
    comparison = page.getByRole("region", { name: "仮定を並べて比較", exact: true });
  const add = comparison.getByRole("button", { name: "この結果を比較に追加" });
  await expect(add).toBeDisabled();
  for (const [label, value] of [
    ["開始資産（円）", "0"],
    ["目標資産・今日の価値（円）", "1200"],
    ["毎月の積立額（円）", "100"],
    ["想定年利（%）", "0"],
    ["想定インフレ率（%）", "0"],
  ])
    await fire.getByLabel(label, { exact: true }).fill(value);
  await fire.getByRole("button", { name: "シミュレーションする" }).click();
  await add.click();
  await fire.getByLabel("毎月の積立額（円）", { exact: true }).fill("200");
  await expect(add).toBeDisabled();
  await expect(comparison).toContainText("1年0か月後");
  await fire.getByRole("button", { name: "シミュレーションする" }).click();
  await add.click();
  await expect(comparison).toContainText("0年6か月後");
  const contribution = comparison
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: "月の積立額", exact: true }) });
  await expect(contribution.getByRole("cell")).toHaveText(["100 円", "200 円"]);
  await fire.getByLabel("毎月の積立額（円）", { exact: true }).fill("0");
  await fire.getByRole("button", { name: "シミュレーションする" }).click();
  await add.click();
  await expect(add).toBeDisabled();
  await expect(comparison).toContainText("100年以内に目標に届きません");
  await comparison.getByRole("button", { name: "シナリオ2を比較から外す" }).click();
  await fire
    .getByLabel("目標資産・今日の価値（円）", { exact: true })
    .fill(String(Number.MAX_SAFE_INTEGER));
  await fire.getByLabel("想定インフレ率（%）", { exact: true }).fill("100");
  await fire.getByRole("button", { name: "シミュレーションする" }).click();
  await add.click();
  await expect(comparison).toContainText("計算上限のため到達時期を判定できません");
  await fire.getByRole("button", { name: "仮定をクリア" }).click();
  await expect(comparison.getByRole("button", { name: /比較から外す/ })).toHaveCount(3);
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  const scroll = comparison.locator(".history-table");
  await scroll.focus();
  await page.keyboard.press("End");
  await expect.poll(() => scroll.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await comparison.screenshot({ path: "test-results/comparison-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await comparison.screenshot({ path: "test-results/comparison-desktop.png" });
  await page.evaluate(async () => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    IndexedDbPortfolioRepository.prototype.readOverview = async () => {
      throw new Error("synthetic-error-".repeat(80));
    };
  });
  await fire.getByRole("button", { name: "記録した総資産を使う" }).click();
  await expect(fire.getByRole("alert")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await expect(comparison.getByRole("button", { name: /比較から外す/ })).toHaveCount(3);
  await page.reload();
  await expect(comparison.getByRole("table")).toHaveCount(0);
});

test("long names and maximum yen keep cards, actions and fields within their tracks", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-04T03:00:00Z"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const card = page.locator(".asset-history > .asset-card").first();
  const emptyWidth = (await card.boundingBox())!.width;
  const name = "W".repeat(100);
  const backup = syntheticBackup();
  backup.accounts[0].name = name;
  backup.accountBalanceSnapshots.forEach((b) => {
    b.balance = Number.MAX_SAFE_INTEGER;
  });
  backup.accounts.push(
    { ...backup.accounts[0], id: "zero", name: "ゼロ", sortOrder: 1 },
    { ...backup.accounts[0], id: "missing", name: "未記録", sortOrder: 2 },
  );
  backup.accountBalanceSnapshots.push({
    ...backup.accountBalanceSnapshots[1],
    id: "zero-b",
    accountId: "zero",
    balance: 0,
  });
  await page.evaluate(async (data) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    await new IndexedDbPortfolioRepository().importBackup(data);
  }, backup);
  await page.reload();
  await expect(card.locator(".asset-value")).toContainText("9,007,199,254,740,991");
  expect(Math.abs((await card.boundingBox())!.width - emptyWidth)).toBeLessThan(1);
  await card.getByRole("button", { name: `${name}を更新`, exact: true }).click();
  await expect(page.getByLabel(`${name}の残高`, { exact: true })).toHaveValue(
    String(Number.MAX_SAFE_INTEGER),
  );
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    const actions = await card.locator(".freshness-list button").evaluateAll((elements) =>
      elements.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, width: r.width };
      }),
    );
    expect(new Set(actions.map((a) => Math.round(a.width))).size).toBe(1);
    expect(new Set(actions.map((a) => Math.round(a.x))).size).toBe(1);
    const overflowing = await page
      .locator("#monthly input, #monthly button, #accounts input, #accounts select")
      .evaluateAll((elements) =>
        elements
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const panel = el.closest(".account-panel")!.getBoundingClientRect();
            return r.left < panel.left - 1 || r.right > panel.right + 1;
          })
          .map((el) => el.tagName),
      );
    expect(overflowing).toEqual([]);
    await expect(card.locator(".asset-value strong")).toHaveJSProperty(
      "scrollWidth",
      await card.locator(".asset-value strong").evaluate((el) => el.clientWidth),
    );
    const crowded = await page
      .locator(".history-table td")
      .evaluateAll(
        (elements) => elements.filter((el) => el.scrollWidth > el.clientWidth + 1).length,
      );
    expect(crowded).toBe(0);
    if (width === 1440 || width === 390) {
      await card.screenshot({ path: `test-results/card-${width}.png` });
      await page
        .locator("#monthly .monthly-balances")
        .screenshot({ path: `test-results/fields-${width}.png` });
    }
  }
});
