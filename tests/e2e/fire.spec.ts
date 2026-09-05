import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { syntheticBackup } from "../fixtures/portfolio";
test("loads recorded assets explicitly without writing records", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-04T03:00:00Z"));
  await page.goto("/");
  await page.evaluate(async (backup) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    await new IndexedDbPortfolioRepository().importBackup(backup);
  }, syntheticBackup());
  const fire = page.getByRole("region", { name: "FIREシミュレーション" });
  await fire.getByRole("button", { name: "記録した総資産を使う" }).click();
  await expect(fire.getByLabel("開始資産（円）", { exact: true })).toHaveValue("120");
  await expect(fire).toContainText("1/1口座の最後の記録");
  await fire.getByLabel("開始資産（円）", { exact: true }).fill("999");
  await fire.getByRole("button", { name: "記録した総資産を使う" }).click();
  await expect(fire.getByLabel("開始資産（円）", { exact: true })).toHaveValue("120");
});
test("explicit scenario, invalidation, reset and persistent draft", async ({ page }) => {
  await page.goto("/");
  const fire = page.getByRole("region", { name: "FIREシミュレーション" });
  await fire.getByRole("button", { name: "記録した総資産を使う" }).click();
  await expect(fire.getByRole("alert")).toContainText("利用できる残高がありません");
  for (const [label, value] of [
    ["開始資産（円）", "0"],
    ["目標資産・今日の価値（円）", "1200"],
    ["毎月の積立額（円）", "100"],
    ["想定年利（%）", "0"],
    ["想定インフレ率（%）", "0"],
  ])
    await fire.getByLabel(label, { exact: true }).fill(value);
  await fire.getByRole("button", { name: "シミュレーションする" }).click();
  await expect(fire.getByRole("status")).toContainText("1年0か月後");
  await fire.getByLabel("毎月の積立額（円）", { exact: true }).fill("0");
  await expect(fire.getByRole("status")).toHaveCount(0);
  await fire.getByRole("button", { name: "シミュレーションする" }).click();
  await expect(fire.getByRole("status")).toContainText("100年以内に目標に届きません");
  await fire.getByLabel("想定年利（%）", { exact: true }).fill("100.01");
  await fire.getByRole("button", { name: "シミュレーションする" }).click();
  await expect(fire.getByRole("alert")).toBeVisible();
  await expect(fire.getByRole("status")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await fire.getByRole("button", { name: "仮定をクリア" }).click();
  await expect(fire.getByLabel("開始資産（円）", { exact: true })).toHaveValue("");
  await fire.getByLabel("開始資産（円）", { exact: true }).fill("123");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { IndexedDbFirePlanRepository } = await import(
          new URL("src/infrastructure/indexeddb-fire-plan.ts", location.href).href
        );
        return (await new IndexedDbFirePlanRepository().load())?.draft.startingAssets;
      }),
    )
    .toBe("123");
  await page.reload();
  await expect(fire.getByLabel("開始資産（円）", { exact: true })).toHaveValue("123");
  await fire.getByRole("button", { name: "仮定をクリア" }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { IndexedDbFirePlanRepository } = await import(
          new URL("src/infrastructure/indexeddb-fire-plan.ts", location.href).href
        );
        return (await new IndexedDbFirePlanRepository().load())?.draft.startingAssets;
      }),
    )
    .toBe("");
});

test("saved FIRE plan and comparisons travel in backup without stored projections", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const fire = page.getByRole("region", { name: "FIREシミュレーション" });
  for (const [label, value] of [
    ["開始資産（円）", "1000"],
    ["目標資産・今日の価値（円）", "2200"],
    ["毎月の積立額（円）", "100"],
    ["想定年利（%）", "0"],
    ["想定インフレ率（%）", "0"],
  ])
    await fire.getByLabel(label, { exact: true }).fill(value);
  await fire.getByRole("button", { name: "シミュレーションする" }).click();
  await fire.getByRole("button", { name: "この結果を比較に追加" }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { IndexedDbFirePlanRepository } = await import(
          new URL("src/infrastructure/indexeddb-fire-plan.ts", location.href).href
        );
        return (await new IndexedDbFirePlanRepository().load())?.comparisons.length;
      }),
    )
    .toBe(1);

  const backup = page.getByRole("region", { name: "バックアップと復元" });
  const download = page.waitForEvent("download");
  await backup.getByRole("button", { name: "JSONバックアップを保存" }).click();
  const path = await (await download).path();
  expect(path).not.toBeNull();
  const exported = JSON.parse(await readFile(path!, "utf8"));
  expect(exported.schemaVersion).toBe(3);
  expect(exported.firePlan.comparisons).toHaveLength(1);
  expect(JSON.stringify(exported.firePlan)).not.toContain("points");

  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(page.url());
  const otherBackup = other.getByRole("region", { name: "バックアップと復元" });
  await otherBackup.getByLabel("復元するJSONファイル").setInputFiles(path!);
  await expect(otherBackup).toContainText("FIRE計画 1 件");
  await otherBackup.getByRole("button", { name: "確認した記録を取り込む" }).click();
  await expect(otherBackup.getByRole("status")).toContainText("1 件を追加");
  const restoredFire = other.getByRole("region", { name: "FIREシミュレーション" });
  await expect(restoredFire.getByLabel("目標資産・今日の価値（円）", { exact: true })).toHaveValue(
    "2200",
  );
  await expect(restoredFire.getByRole("button", { name: /比較から外す/ })).toHaveCount(1);
  await context.close();

  await fire.getByLabel("目標資産・今日の価値（円）", { exact: true }).fill("2400");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { IndexedDbFirePlanRepository } = await import(
          new URL("src/infrastructure/indexeddb-fire-plan.ts", location.href).href
        );
        return (await new IndexedDbFirePlanRepository().load())?.draft.target;
      }),
    )
    .toBe("2400");
  await backup.getByLabel("復元するJSONファイル").setInputFiles(path!);
  await backup.getByRole("button", { name: "確認した記録を取り込む" }).click();
  await expect(backup.getByRole("alert")).toContainText("FIRE計画と競合");
  await expect(fire.getByLabel("目標資産・今日の価値（円）", { exact: true })).toHaveValue("2400");
});
