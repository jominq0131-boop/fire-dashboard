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
    .getByLabel("과세 계좌 보유 취득원가(모르면 빈칸)(엔)", { exact: true })
    .fill("5000000");
  await goal.getByLabel("매도차익 가정 세율(%)", { exact: true }).fill("20.315");
  await goal.getByLabel("현금·예금(엔)", { exact: true }).fill("123456");
  await goal.getByLabel("월 현금 저축(음수 가능)(엔)", { exact: true }).fill("-");
  await expect(goal).toContainText("목표 계획을 이 기기에 저장했습니다");
  await page.reload();
  await expect(goal.getByLabel("현금·예금(엔)", { exact: true })).toHaveValue("123456");
  await expect(goal.getByLabel("월 현금 저축(음수 가능)(엔)", { exact: true })).toHaveValue("-");
  await expect(goal.locator(".goal-result")).toHaveCount(0);
  const other = await context.newPage();
  await other.goto("/");
  await expect(
    other.locator(".goal-planner").getByLabel("현금·예금(엔)", { exact: true }),
  ).toHaveValue("123456");
  await goal.getByLabel("현금·예금(엔)", { exact: true }).fill("654321");
  await expect(goal).toContainText("목표 계획을 이 기기에 저장했습니다");
  await other.locator(".goal-planner").getByLabel("현금·예금(엔)", { exact: true }).fill("999");
  await expect(other.locator(".goal-planner").getByRole("alert")).toContainText("다른 탭");
  await expect(
    other.locator(".goal-planner").getByLabel("현금·예금(엔)", { exact: true }),
  ).toHaveValue("999");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 백업 저장" }).click();
  const file = await download;
  const buffer = await readFile((await file.path())!);
  const data = JSON.parse(buffer.toString());
  expect(data.schemaVersion).toBe(7);
  expect(data.goalPlan.draft.cash).toBe("654321");
  expect(data.goalPlan.draft.taxableCost).toBe("5000000");
  expect(data.goalPlan.draft.taxRate).toBe("20.315");
  const isolated = await browser.newContext();
  try {
    const restored = await isolated.newPage();
    await restored.goto("/");
    await restored
      .getByLabel("복원할 JSON 파일")
      .setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer });
    await expect(restored.locator(".backup-preview")).toContainText("목표 계획 1개");
    await restored.getByRole("button", { name: "확인한 기록 가져오기" }).click();
    await expect(
      restored.locator(".goal-planner").getByLabel("현금·예금(엔)", { exact: true }),
    ).toHaveValue("654321");
    await restored.reload();
    await expect(
      restored.getByLabel("과세 계좌 보유 취득원가(모르면 빈칸)(엔)", { exact: true }),
    ).toHaveValue("5000000");
    await expect(restored.getByLabel("매도차익 가정 세율(%)", { exact: true })).toHaveValue(
      "20.315",
    );
    await expect(
      restored.locator(".goal-planner").getByLabel("월 현금 저축(음수 가능)(엔)", { exact: true }),
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
  await goal.getByLabel("올해 적립투자 한도·매수액(엔)", { exact: true }).fill("1200000");
  await expect(goal).toContainText("목표 계획을 이 기기에 저장했습니다");
  await page.clock.setFixedTime(new Date("2027-01-10T03:00:00Z"));
  await page.reload();
  await expect(goal).toContainText("입력 확인 월:  2026-12");
  await expect(goal.getByRole("alert")).toContainText("해가 바뀌었다면");
  await goal.getByLabel("현금·예금(엔)", { exact: true }).fill("0");
  await expect(goal).toContainText("목표 계획을 이 기기에 저장했습니다");
  await page.reload();
  await expect(goal).toContainText("입력 확인 월:  2026-12");
});
