import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("post-goal spending distinguishes depletion from a funded horizon and persists through backup", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(async () => {
    const { initialGoalValues } = await import(
      new URL("src/domain/goal-plan.ts", location.href).href
    );
    const { IndexedDbGoalPlanRepository } = await import(
      new URL("src/infrastructure/indexeddb-goal-plan.ts", location.href).href
    );
    await new IndexedDbGoalPlanRepository().save(
      {
        id: "primary",
        draft: {
          ...initialGoalValues(),
          cash: "1200",
          tsumitate: "0",
          growth: "0",
          taxable: "0",
          monthlyCash: "0",
          monthlyInvestment: "0",
          target: "1200",
          returnBps: "0",
          usedTotal: "0",
          usedGrowth: "0",
          usedYearTsumitate: "0",
          usedYearGrowth: "0",
        },
        referenceMonth: "2026-09",
        updatedAt: "2026-09-26T00:00:00.000Z",
      },
      null,
    );
  });
  await page.reload();
  const goal = page.locator(".goal-planner");
  await goal.getByRole("button", { name: "目標到達を計算する" }).click();
  const drawdown = goal.getByRole("region", { name: "目標のあと、生活費をまかなえる？" });
  for (const [label, value] of [
    ["到達後の毎月の生活費（手取り・円）", "100"],
    ["取り崩し期間（年）", "2"],
    ["到達後の株式年利（%）", "0"],
    ["到達後の生活費上昇率（年率・%）", "0"],
  ])
    await drawdown.getByLabel(label, { exact: true }).fill(value);
  await drawdown.getByRole("button", { name: "到達後の生活費を試算する" }).click();
  await expect(drawdown.getByRole("status")).toContainText("13か月目");
  await expect(drawdown).toContainText("不足月の未充当額は 100 円");
  await expect(drawdown.locator(".recharts-line-curve").first()).toBeVisible();
  await drawdown.getByRole("slider").focus();
  await drawdown.getByRole("slider").press("End");
  await expect(drawdown.locator(".chart-inspector")).toContainText("0 円");
  await page.setViewportSize({ width: 390, height: 900 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await expect(goal).toContainText("目標計画をこの端末に保存しました");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONバックアップを保存" }).click();
  const download = await downloading;
  const buffer = await readFile((await download.path())!);
  const backup = JSON.parse(buffer.toString());
  expect(backup.schemaVersion).toBe(6);
  expect(backup.goalPlan.draft.drawdownMonthly).toBe("100");
  const isolated = await browser.newContext();
  try {
    const restored = await isolated.newPage();
    await restored.goto("/");
    await restored
      .getByLabel("復元するJSONファイル")
      .setInputFiles({ name: "synthetic-drawdown.json", mimeType: "application/json", buffer });
    await restored.getByRole("button", { name: "確認した記録を取り込む" }).click();
    await expect(restored.locator(".goal-planner")).toContainText(
      "目標計画をこの端末に保存済みです",
    );
    await restored.reload();
    await expect(restored.locator(".drawdown-result")).toHaveCount(0);
    await restored.getByRole("button", { name: "目標到達を計算する" }).click();
    await expect(
      restored.getByLabel("到達後の毎月の生活費（手取り・円）", { exact: true }),
    ).toHaveValue("100");
    await restored.getByLabel("取り崩し期間（年）", { exact: true }).fill("1");
    await restored.getByRole("button", { name: "到達後の生活費を試算する" }).click();
    await expect(restored.locator(".drawdown-result")).toContainText("1年間の生活費を充当");
    await restored.getByLabel("取り崩し期間（年）", { exact: true }).fill("101");
    await expect(restored.locator(".drawdown-result")).toHaveCount(0);
    await restored.getByRole("button", { name: "到達後の生活費を試算する" }).click();
    await expect(restored.locator(".drawdown-planner").getByRole("alert")).toContainText(
      "1〜100年",
    );
  } finally {
    await isolated.close();
  }
  expect(errors).toEqual([]);
});
