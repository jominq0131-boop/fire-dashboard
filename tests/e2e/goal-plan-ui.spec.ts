import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("goal drafts survive reload, empty-browser restore and stale-tab conflicts", async ({
  page,
  context,
  browser,
}) => {
  await page.goto("/");
  const goal = page.locator(".goal-planner");
  await goal
    .getByLabel("課税口座の保有取得額（不明なら空欄）（円）", { exact: true })
    .fill("5000000");
  await goal.getByLabel("売却益の想定税率（%）", { exact: true }).fill("20.315");
  await goal.getByLabel("現金・預金（円）", { exact: true }).fill("123456");
  await goal.getByLabel("毎月の現金貯蓄（マイナス可）（円）", { exact: true }).fill("-");
  await expect(goal).toContainText("目標計画をこの端末に保存しました");
  await page.reload();
  await expect(goal.getByLabel("現金・預金（円）", { exact: true })).toHaveValue("123456");
  await expect(goal.getByLabel("毎月の現金貯蓄（マイナス可）（円）", { exact: true })).toHaveValue(
    "-",
  );
  await expect(goal.locator(".goal-result")).toHaveCount(0);
  const other = await context.newPage();
  await other.goto("/");
  await expect(
    other.locator(".goal-planner").getByLabel("現金・預金（円）", { exact: true }),
  ).toHaveValue("123456");
  await goal.getByLabel("現金・預金（円）", { exact: true }).fill("654321");
  await expect(goal).toContainText("目標計画をこの端末に保存しました");
  await other.locator(".goal-planner").getByLabel("現金・預金（円）", { exact: true }).fill("999");
  await expect(other.locator(".goal-planner").getByRole("alert")).toContainText("別のタブ");
  await expect(
    other.locator(".goal-planner").getByLabel("現金・預金（円）", { exact: true }),
  ).toHaveValue("999");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONバックアップを保存" }).click();
  const file = await download;
  const buffer = await readFile((await file.path())!);
  const data = JSON.parse(buffer.toString());
  expect(data.schemaVersion).toBe(5);
  expect(data.goalPlan.draft.cash).toBe("654321");
  expect(data.goalPlan.draft.taxableCost).toBe("5000000");
  expect(data.goalPlan.draft.taxRate).toBe("20.315");
  const isolated = await browser.newContext();
  try {
    const restored = await isolated.newPage();
    await restored.goto("/");
    await restored
      .getByLabel("復元するJSONファイル")
      .setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer });
    await expect(restored.locator(".backup-preview")).toContainText("目標計画 1 件");
    await restored.getByRole("button", { name: "確認した記録を取り込む" }).click();
    await expect(
      restored.locator(".goal-planner").getByLabel("現金・預金（円）", { exact: true }),
    ).toHaveValue("654321");
    await restored.reload();
    await expect(
      restored.getByLabel("課税口座の保有取得額（不明なら空欄）（円）", { exact: true }),
    ).toHaveValue("5000000");
    await expect(restored.getByLabel("売却益の想定税率（%）", { exact: true })).toHaveValue(
      "20.315",
    );
    await expect(
      restored
        .locator(".goal-planner")
        .getByLabel("毎月の現金貯蓄（マイナス可）（円）", { exact: true }),
    ).toHaveValue("-");
  } finally {
    await isolated.close();
  }
});

test("old reference month remains visible after draft edits across a year boundary", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-12-10T03:00:00Z"));
  await page.goto("/");
  const goal = page.locator(".goal-planner");
  await goal.getByLabel("今年のつみたて枠・買付済額（円）", { exact: true }).fill("1200000");
  await expect(goal).toContainText("目標計画をこの端末に保存しました");
  await page.clock.setFixedTime(new Date("2027-01-10T03:00:00Z"));
  await page.reload();
  await expect(goal).toContainText("入力の確認月: 2026-12");
  await expect(goal.getByRole("alert")).toContainText("年が変わった場合");
  await goal.getByLabel("現金・預金（円）", { exact: true }).fill("0");
  await expect(goal).toContainText("目標計画をこの端末に保存しました");
  await page.reload();
  await expect(goal).toContainText("入力の確認月: 2026-12");
});
