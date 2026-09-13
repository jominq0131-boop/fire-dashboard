import { expect, it } from "vitest";
import { initialGoalValues, normalizeGoalPlan } from "../../../src/domain/goal-plan";
import { normalizeBackup, mergeBackup } from "../../../src/domain/backup";
import { storageMigrationPlan } from "../../../src/domain/storage-migrations";
import { syntheticBackup } from "../../fixtures/portfolio";

const plan = () => ({
  id: "primary",
  draft: initialGoalValues(),
  referenceMonth: "2026-09",
  updatedAt: "2026-09-13T00:00:00.000Z",
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
      schemaVersion: 4,
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
  expect(() => mergeBackup(incoming, conflict)).toThrow("目標計画と競合");
  expect(incoming.goalPlan.draft.cash).toBe("");
  expect(() => normalizeBackup({ ...incoming, schemaVersion: 3 })).toThrow();
});
