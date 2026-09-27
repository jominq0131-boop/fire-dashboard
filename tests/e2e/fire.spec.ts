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
  const fire = page.getByRole("region", { name: "FIRE 시뮬레이션" });
  await fire.getByRole("button", { name: "기록한 총자산 사용" }).click();
  await expect(fire.getByLabel("시작 자산(엔)", { exact: true })).toHaveValue("120");
  await expect(fire).toContainText("1/1개 계좌의 마지막 기록");
  await fire.getByLabel("시작 자산(엔)", { exact: true }).fill("999");
  await fire.getByRole("button", { name: "기록한 총자산 사용" }).click();
  await expect(fire.getByLabel("시작 자산(엔)", { exact: true })).toHaveValue("120");
});
test("explicit scenario, invalidation, reset and persistent draft", async ({ page }) => {
  // Run the whole mobile flow at its final size; resizing mid-scroll races smooth scrolling.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const fire = page.getByRole("region", { name: "FIRE 시뮬레이션" });
  await fire.getByRole("button", { name: "기록한 총자산 사용" }).click();
  await expect(fire.getByRole("alert")).toContainText("사용할 수 있는 잔액이 없습니다");
  for (const [label, value] of [
    ["시작 자산(엔)", "0"],
    ["목표 자산·현재 가치(엔)", "1200"],
    ["월 적립액(엔)", "100"],
    ["가정 연 수익률(%)", "0"],
    ["가정 물가상승률(%)", "0"],
  ])
    await fire.getByLabel(label, { exact: true }).fill(value);
  await fire.getByRole("button", { name: "시뮬레이션 실행" }).click();
  await expect(fire.getByRole("status")).toContainText("1년0개월 후");
  await fire.getByLabel("월 적립액(엔)", { exact: true }).fill("0");
  await expect(fire.getByRole("status")).toHaveCount(0);
  await fire.getByRole("button", { name: "시뮬레이션 실행" }).click();
  await expect(fire.getByRole("status")).toContainText("100년 이내에 목표에 도달하지 않습니다");
  await fire.getByLabel("가정 연 수익률(%)", { exact: true }).fill("100.01");
  await fire.getByRole("button", { name: "시뮬레이션 실행" }).click();
  await expect(fire.getByRole("alert")).toBeVisible();
  await expect(fire.getByRole("status")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await fire.getByRole("button", { name: "가정 초기화" }).click();
  await expect(fire.getByLabel("시작 자산(엔)", { exact: true })).toHaveValue("");
  await fire.getByLabel("시작 자산(엔)", { exact: true }).fill("123");
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
  await expect(fire.getByLabel("시작 자산(엔)", { exact: true })).toHaveValue("123");
  await fire.getByRole("button", { name: "가정 초기화" }).click();
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
  const fire = page.getByRole("region", { name: "FIRE 시뮬레이션" });
  for (const [label, value] of [
    ["시작 자산(엔)", "1000"],
    ["목표 자산·현재 가치(엔)", "2200"],
    ["월 적립액(엔)", "100"],
    ["가정 연 수익률(%)", "0"],
    ["가정 물가상승률(%)", "0"],
  ])
    await fire.getByLabel(label, { exact: true }).fill(value);
  await fire.getByRole("button", { name: "시뮬레이션 실행" }).click();
  await fire.getByRole("button", { name: "이 결과를 비교에 추가" }).click();
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

  const backup = page.getByRole("region", { name: "백업과 복원" });
  const download = page.waitForEvent("download");
  await backup.getByRole("button", { name: "JSON 백업 저장" }).click();
  const path = await (await download).path();
  expect(path).not.toBeNull();
  const exported = JSON.parse(await readFile(path!, "utf8"));
  expect(exported.schemaVersion).toBe(7);
  expect(exported.firePlan.comparisons).toHaveLength(1);
  expect(JSON.stringify(exported.firePlan)).not.toContain("points");

  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(page.url());
  const otherBackup = other.getByRole("region", { name: "백업과 복원" });
  await otherBackup.getByLabel("복원할 JSON 파일").setInputFiles(path!);
  await expect(otherBackup).toContainText("FIRE 계획 1개");
  await otherBackup.getByRole("button", { name: "확인한 기록 가져오기" }).click();
  await expect(otherBackup.getByRole("status")).toContainText("1개를 추가");
  const restoredFire = other.getByRole("region", { name: "FIRE 시뮬레이션" });
  await expect(restoredFire.getByLabel("목표 자산·현재 가치(엔)", { exact: true })).toHaveValue(
    "2200",
  );
  await expect(restoredFire.getByRole("button", { name: /비교에서 제외/ })).toHaveCount(1);
  await context.close();

  await fire.getByLabel("목표 자산·현재 가치(엔)", { exact: true }).fill("2400");
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
  await backup.getByLabel("복원할 JSON 파일").setInputFiles(path!);
  await backup.getByRole("button", { name: "확인한 기록 가져오기" }).click();
  await expect(backup.getByRole("alert")).toContainText("FIRE 계획과 충돌");
  await expect(fire.getByLabel("목표 자산·현재 가치(엔)", { exact: true })).toHaveValue("2400");
});
