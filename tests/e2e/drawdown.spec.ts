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
  await goal.getByRole("button", { name: "목표 달성 계산" }).click();
  const drawdown = goal.getByRole("region", {
    name: "목표 달성 후에도 생활비를 충당할 수 있을까요?",
  });
  for (const [label, value] of [
    ["목표 달성 후 월 생활비(세후·엔)", "100"],
    ["인출 기간(년)", "2"],
    ["목표 달성 후 주식 연 수익률(%)", "0"],
    ["목표 달성 후 생활비 상승률(연율·%)", "0"],
  ])
    await drawdown.getByLabel(label, { exact: true }).fill(value);
  await drawdown.getByRole("button", { name: "목표 달성 후 생활비 계산" }).click();
  await expect(drawdown.getByRole("status")).toContainText("13개월째");
  await expect(drawdown).toContainText("생활비가 부족한 달의 미충당 금액은  100 엔");
  await expect(drawdown.locator(".recharts-line-curve").first()).toBeVisible();
  await drawdown.getByRole("slider").focus();
  await drawdown.getByRole("slider").press("End");
  await expect(drawdown.locator(".chart-inspector")).toContainText("0 엔");
  await drawdown.getByLabel("월 연금·추가 소득(세후·엔)").fill("100");
  await drawdown.getByLabel("소득 지급 시작(목표 달성 후 개월째)").fill("13");
  await expect(drawdown.locator(".drawdown-result")).toHaveCount(0);
  await drawdown.getByRole("button", { name: "목표 달성 후 생활비 계산" }).click();
  await expect(drawdown.getByRole("status")).toContainText("2년간 생활비 충당");
  await expect(drawdown.getByRole("status")).toContainText("받은 연금·추가 소득 1,200 엔");
  await page.setViewportSize({ width: 390, height: 900 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await expect(goal).toContainText("목표 계획을 이 기기에 저장했습니다");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 백업 저장" }).click();
  const download = await downloading;
  const buffer = await readFile((await download.path())!);
  const backup = JSON.parse(buffer.toString());
  expect(backup.schemaVersion).toBe(7);
  expect(backup.goalPlan.draft.drawdownMonthly).toBe("100");
  expect(backup.goalPlan.draft.drawdownIncome).toBe("100");
  expect(backup.goalPlan.draft.drawdownIncomeStart).toBe("13");
  const isolated = await browser.newContext();
  try {
    const restored = await isolated.newPage();
    await restored.goto("/");
    await restored
      .getByLabel("복원할 JSON 파일")
      .setInputFiles({ name: "synthetic-drawdown.json", mimeType: "application/json", buffer });
    await restored.getByRole("button", { name: "확인한 기록 가져오기" }).click();
    await expect(restored.locator(".goal-planner")).toContainText(
      "목표 계획이 이 기기에 저장되어 있습니다",
    );
    await restored.reload();
    await expect(restored.locator(".drawdown-result")).toHaveCount(0);
    await restored.getByRole("button", { name: "목표 달성 계산" }).click();
    await expect(
      restored.getByLabel("목표 달성 후 월 생활비(세후·엔)", { exact: true }),
    ).toHaveValue("100");
    await expect(restored.getByLabel("월 연금·추가 소득(세후·엔)")).toHaveValue("100");
    await expect(restored.getByLabel("소득 지급 시작(목표 달성 후 개월째)")).toHaveValue("13");
    await restored.getByRole("button", { name: "목표 달성 후 생활비 계산" }).click();
    await expect(restored.locator(".drawdown-result")).toContainText("2년간 생활비 충당");
    await restored.getByLabel("인출 기간(년)", { exact: true }).fill("1");
    await restored.getByRole("button", { name: "목표 달성 후 생활비 계산" }).click();
    await expect(restored.locator(".drawdown-result")).toContainText("1년간 생활비 충당");
    await restored.getByLabel("인출 기간(년)", { exact: true }).fill("101");
    await expect(restored.locator(".drawdown-result")).toHaveCount(0);
    await restored.getByRole("button", { name: "목표 달성 후 생활비 계산" }).click();
    await expect(restored.locator(".drawdown-planner").getByRole("alert")).toContainText("1~100년");
  } finally {
    await isolated.close();
  }
  expect(errors).toEqual([]);
});
