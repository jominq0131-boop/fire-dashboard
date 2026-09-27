import { expect, test, type Page } from "@playwright/test";
import { syntheticBackup } from "../fixtures/portfolio";

async function fillGoal(page: Page, overrides: Record<string, string> = {}) {
  const goal = page.getByRole("region", { name: "지금 속도라면 언제 목표에 도달할까요?" });
  const values = {
    "현금·예금(엔)": "10000000",
    "NISA·적립(엔)": "0",
    "NISA·성장(엔)": "0",
    "특정·일반 계좌 주식(엔)": "39000000",
    "월 현금 저축(음수 가능)(엔)": "100000",
    "월 주식·펀드 적립(엔)": "100000",
    "목표 금액(명목)(엔)": "50000000",
    "주식 가정 연 수익률(%)": "0",
    "목표 달성 시 연 인출률(%)": "3",
    "신 NISA 보유 취득원가·합계(엔)": "0",
    "그중 성장투자 한도의 보유 취득원가(엔)": "0",
    "올해 적립투자 한도·매수액(엔)": "0",
    "올해 성장투자 한도·매수액(엔)": "0",
    ...overrides,
  };
  for (const [label, value] of Object.entries(values))
    await goal.getByLabel(label, { exact: true }).fill(value);
  await goal.getByRole("button", { name: "목표 달성 계산" }).click();
  return goal;
}

test("net withdrawal shows profit tax, unknown basis and responsive persisted assumptions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const goal = await fillGoal(page, {
    "현금·예금(엔)": "0",
    "특정·일반 계좌 주식(엔)": "10000000",
    "목표 금액(명목)(엔)": "1",
    "과세 계좌 보유 취득원가(모르면 빈칸)(엔)": "5000000",
  });
  const estimate = goal.getByRole("region", { name: "세후 인출액 추정" });
  await expect(estimate).toContainText("269,527 엔");
  await expect(estimate).toContainText("30,473 엔");
  await expect(estimate).toContainText("22,461 엔");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await estimate.screenshot({ path: `test-results/net-withdrawal-${width}.png` });
  }
  await goal.getByLabel("과세 계좌 보유 취득원가(모르면 빈칸)(엔)", { exact: true }).fill("");
  await expect(estimate).toHaveCount(0);
  await goal.getByRole("button", { name: "목표 달성 계산" }).click();
  await expect(estimate).toContainText("취득원가를 알 수 없어");
  await expect(goal.getByRole("status")).toContainText("연간 300,000 엔");
  await goal.getByLabel("매도차익 가정 세율(%)", { exact: true }).fill("100.001");
  await goal.getByRole("button", { name: "목표 달성 계산" }).click();
  await expect(goal.getByRole("alert")).toContainText("0~100%");
  expect(errors).toEqual([]);
});

test("exact goal arrival, composition, self-withdrawals and mobile chart", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date("2026-09-05T03:00:00Z"));
  await page.goto("/");
  const goal = await fillGoal(page);
  await expect(goal.getByRole("status")).toContainText("2027년2월 에 달성");
  await expect(goal.getByRole("status")).toContainText("월 98,750 엔");
  await expect(goal.getByRole("status")).toContainText("연간 1,185,000 엔");
  await expect(goal.getByRole("region", { name: "목표 달성 시 자산 구성" })).toContainText(
    "10,500,000 엔",
  );
  await expect(
    goal.getByRole("region", { name: "목표 달성 시 자산 구성" }).locator(".goal-breakdown"),
  ).toContainText("21.0%");
  await expect(goal.locator(".recharts-line-curve").first()).toBeVisible();
  const slider = goal.getByRole("slider");
  await slider.focus();
  await slider.press("End");
  await expect(goal.locator(".chart-inspector")).toContainText("50,000,000 엔");
  for (const width of [390, 320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await goal.locator(".goal-result").screenshot({ path: "test-results/goal-fire-mobile.png" });
  await goal.getByLabel("목표 금액(명목)(엔)", { exact: true }).fill("60000000");
  await expect(goal.locator(".goal-result")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("bounded record seed uses completed-month cash savings without doubling investment", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-05T03:00:00Z"));
  await page.goto("/");
  const backup = syntheticBackup();
  backup.monthlyCashFlows.push({
    ...backup.monthlyCashFlows[0],
    id: "synthetic-old",
    month: "2026-08",
    income: 1000,
    expenses: 200,
    investmentContribution: 300,
  });
  await page.evaluate(async (data) => {
    const { IndexedDbPortfolioRepository } = await import(
      new URL("src/infrastructure/indexeddb-portfolio.ts", location.href).href
    );
    await new IndexedDbPortfolioRepository().importBackup(data);
  }, backup);
  const goal = page.getByRole("region", { name: "지금 속도라면 언제 목표에 도달할까요?" });
  await goal.getByRole("button", { name: "현재 자산·저축 속도 불러오기" }).click();
  await expect(goal.getByLabel("현금·예금(엔)", { exact: true })).toHaveValue("120");
  await expect(goal.getByLabel("월 현금 저축(음수 가능)(엔)", { exact: true })).toHaveValue("500");
  await expect(goal.getByLabel("월 주식·펀드 적립(엔)", { exact: true })).toHaveValue("300");
  await expect(goal).toContainText("2026-08 의 1개 평균");
  await expect(goal.getByLabel("신 NISA 보유 취득원가·합계(엔)", { exact: true })).toHaveValue("");
});

test("nonarrival, shortfall, invalid limits and initial arrival are explicit", async ({ page }) => {
  await page.goto("/");
  let goal = await fillGoal(page, {
    "월 현금 저축(음수 가능)(엔)": "0",
    "월 주식·펀드 적립(엔)": "0",
  });
  await expect(goal.getByRole("status")).toContainText("100년 이내 미달성");
  goal = await fillGoal(page, { "월 현금 저축(음수 가능)(엔)": "-10000001" });
  await expect(goal.getByRole("alert")).toContainText("현금이 부족");
  goal = await fillGoal(page, { "신 NISA 보유 취득원가·합계(엔)": "18000001" });
  await expect(goal.getByRole("alert")).toContainText("제도상 한도");
  goal = await fillGoal(page, { "목표 금액(명목)(엔)": "1" });
  await expect(goal.getByRole("status")).toContainText("이미 목표 달성");
});
