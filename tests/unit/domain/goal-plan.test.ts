import { expect, it } from "vitest";
import { initialGoalValues, normalizeGoalPlan } from "../../../src/domain/goal-plan";
import { normalizeBackup, mergeBackup } from "../../../src/domain/backup";
import { storageMigrationPlan } from "../../../src/domain/storage-migrations";
import { syntheticBackup } from "../../fixtures/portfolio";

const plan = () => ({
  id: "primary" as const,
  draft: initialGoalValues(),
  referenceMonth: "2026-09",
  updatedAt: "2026-09-13T00:00:00.000Z",
});
it("migrates v6 income defaults without changing original text, timestamps or draft bytes", () => {
  const current = plan();
  const draft = Object.fromEntries(
    Object.entries(current.draft).filter(
      ([key]) => key !== "drawdownIncome" && key !== "drawdownIncomeStart",
    ),
  );
  const previous = { ...current, draft };
  const old = { ...syntheticBackup(), schemaVersion: 6, firePlan: null, goalPlan: previous };
  old.accounts[0].name = "日本の口座・한글";
  old.monthlyCashFlows[0].note = "以前のメモ・예전 메모";
  const bytes = JSON.stringify(old);
  const next = normalizeBackup(old);
  expect(next.schemaVersion).toBe(7);
  expect(next.goalPlan).toEqual(current);
  expect(next.accounts).toEqual(old.accounts);
  expect(next.monthlyCashFlows).toEqual(old.monthlyCashFlows);
  expect(JSON.stringify(old)).toBe(bytes);
  expect(normalizeGoalPlan(previous)).toEqual(current);
  expect(() => normalizeBackup({ ...old, schemaVersion: 7 })).toThrow();
  expect(() => normalizeBackup({ ...old, goalPlan: current })).toThrow();
  const edited = {
    ...next,
    goalPlan: {
      ...current,
      draft: { ...current.draft, drawdownIncome: "100000", drawdownIncomeStart: "121" },
    },
  };
  expect(normalizeBackup(JSON.parse(JSON.stringify(edited)))).toEqual(edited);
  expect(() => mergeBackup(edited, next)).toThrow("목표 계획과 충돌");
});
it("preserves v5 tax settings and adds only empty retirement spending and example assumptions", () => {
  const current = plan();
  const draft = Object.fromEntries(
    Object.entries(current.draft).filter(([key]) => !key.startsWith("drawdown")),
  );
  draft.taxableCost = "123456";
  draft.taxRate = "15";
  const taxPlan = { ...current, draft };
  const before = structuredClone(taxPlan);
  const input = { ...syntheticBackup(), schemaVersion: 5, firePlan: null, goalPlan: taxPlan };
  const migrated = normalizeBackup(input);
  expect(migrated.schemaVersion).toBe(7);
  expect(migrated.goalPlan).toEqual({
    ...current,
    draft: { ...current.draft, taxableCost: "123456", taxRate: "15" },
  });
  expect(taxPlan).toEqual(before);
  expect(() => normalizeBackup({ ...input, schemaVersion: 7 })).toThrow();
  expect(() => normalizeBackup({ ...input, goalPlan: current })).toThrow();
  const edited = {
    ...migrated,
    goalPlan: {
      ...migrated.goalPlan!,
      draft: { ...migrated.goalPlan!.draft, drawdownMonthly: "100000" },
    },
  };
  expect(normalizeBackup(JSON.parse(JSON.stringify(edited)))).toEqual(edited);
  expect(() => mergeBackup(edited, migrated)).toThrow("목표 계획과 충돌");
});
it("migrates exactly the legacy draft without mutation and rejects mixed version fields", () => {
  const current = plan();
  const draft = Object.fromEntries(
    Object.entries(current.draft).filter(
      ([key]) => key !== "taxableCost" && key !== "taxRate" && !key.startsWith("drawdown"),
    ),
  );
  const legacy = { ...current, draft };
  const before = structuredClone(legacy);
  const migrated = normalizeGoalPlan(legacy);
  expect(migrated).toEqual(current);
  expect(legacy).toEqual(before);
  const oldBackup = { ...syntheticBackup(), schemaVersion: 4, firePlan: null, goalPlan: legacy };
  expect(normalizeBackup(oldBackup).goalPlan).toEqual(current);
  expect(() => normalizeBackup({ ...oldBackup, schemaVersion: 5 })).toThrow();
  expect(() => normalizeBackup({ ...oldBackup, goalPlan: current })).toThrow();
  expect(() => normalizeGoalPlan({ ...legacy, draft: { ...draft, taxRate: "20" } })).toThrow();
  const configured = {
    ...current,
    draft: { ...current.draft, taxableCost: "123", taxRate: "20.315" },
  };
  const newer = { ...normalizeBackup(oldBackup), goalPlan: configured };
  expect(normalizeBackup(JSON.parse(JSON.stringify(newer)))).toEqual(newer);
  expect(() => mergeBackup(newer, normalizeBackup(oldBackup))).toThrow("목표 계획과 충돌");
  expect(newer.goalPlan).toEqual(configured);
});
it("preserves bounded incomplete drafts without interpreting them as valid calculations", () => {
  const input = plan();
  input.draft.monthlyCash = "-";
  input.draft.returnBps = "invalid";
  const result = normalizeGoalPlan(input);
  expect(result).toEqual(input);
  result.draft.target = "1";
  expect(input.draft.target).toBe("50000000");
  expect(
    normalizeGoalPlan({ ...input, draft: { ...input.draft, cash: "1".repeat(16) } }).draft.cash,
  ).toHaveLength(16);
  expect(() =>
    normalizeGoalPlan({ ...input, draft: { ...input.draft, cash: "1".repeat(17) } }),
  ).toThrow();
});
it.each([
  { ...plan(), extra: true },
  { ...plan(), id: "other" },
  { ...plan(), referenceMonth: "2026-13" },
  { ...plan(), updatedAt: "invalid" },
  { ...plan(), draft: { ...initialGoalValues(), extra: "" } },
  { ...plan(), draft: { ...initialGoalValues(), cash: 0 } },
])("rejects malformed plans without repair", (value) => {
  const before = structuredClone(value);
  expect(() => normalizeGoalPlan(value)).toThrow();
  expect(value).toEqual(before);
});
it("adds only an empty store deterministically", () => {
  expect(storageMigrationPlan(4)).toEqual([{ version: 5, store: "goalPlans", keyPath: "id" }]);
  expect(storageMigrationPlan(5)).toEqual([]);
});
it("migrates v1-v3 without losing records or the legacy plan", () => {
  const old = syntheticBackup();
  for (const version of [1, 2, 3]) {
    const input = { ...old, schemaVersion: version, ...(version === 3 ? { firePlan: null } : {}) };
    expect(normalizeBackup(input)).toEqual({
      ...old,
      schemaVersion: 7,
      firePlan: null,
      goalPlan: null,
    });
  }
});
it("round trips and merges goals idempotently while preserving them on old imports", () => {
  const empty = normalizeBackup(syntheticBackup());
  const incoming = { ...empty, goalPlan: normalizeGoalPlan(plan()) };
  expect(normalizeBackup(JSON.parse(JSON.stringify(incoming)))).toEqual(incoming);
  expect(mergeBackup(empty, incoming).added).toBe(1);
  expect(mergeBackup(incoming, incoming).added).toBe(0);
  expect(mergeBackup(incoming, syntheticBackup()).backup.goalPlan).toEqual(incoming.goalPlan);
  const conflict = structuredClone(incoming);
  conflict.goalPlan.draft.cash = "999";
  expect(() => mergeBackup(incoming, conflict)).toThrow("목표 계획과 충돌");
  expect(incoming.goalPlan.draft.cash).toBe("");
  expect(() => normalizeBackup({ ...incoming, schemaVersion: 3 })).toThrow();
});
