import { describe, expect, it } from "vitest";
import {
  emptyFireScenario,
  FIRE_PLAN_ID,
  isFireScenarioValues,
  normalizeFirePlan,
  projectFireValues,
  sameFirePlan,
  sameFirePlanContent,
  type FirePlan,
  type FireScenarioValues,
} from "../../../src/domain/fire-plan";
import { mergeBackup, normalizeBackup } from "../../../src/domain/backup";
import { syntheticBackup } from "../../fixtures/portfolio";

const values: FireScenarioValues = {
  startingAssets: "1000",
  target: "2200",
  monthlyContribution: "100",
  returnBps: "0",
  inflationBps: "0",
};
const plan = (): FirePlan => ({
  id: FIRE_PLAN_ID,
  draft: { ...values },
  current: { ...values },
  comparisons: [{ id: 2, values: { ...values, target: "3000" } }],
  updatedAt: "2026-09-05T00:00:00.000Z",
});

describe("persistent FIRE plan", () => {
  it("keeps incomplete drafts but requires complete current and comparison scenarios", () => {
    expect(isFireScenarioValues(emptyFireScenario())).toBe(true);
    expect(isFireScenarioValues(emptyFireScenario(), true)).toBe(false);
    expect(isFireScenarioValues(values, true)).toBe(true);
    expect(projectFireValues(values).reachedMonth).toBe(12);
    expect(isFireScenarioValues({ ...values, target: "0" }, true)).toBe(false);
    expect(isFireScenarioValues({ ...values, returnBps: "1e2" })).toBe(false);
    expect(isFireScenarioValues({ ...values, startingAssets: "1".repeat(17) })).toBe(false);
  });

  it("normalizes a detached, sorted plan and compares content separately from timestamps", () => {
    const input = plan();
    input.comparisons = [
      { id: 3, values: { ...values, target: "4000" } },
      { id: 1, values: { ...values, target: "2500" } },
    ];
    const before = structuredClone(input);
    const normalized = normalizeFirePlan(input);
    expect(normalized.comparisons.map((item) => item.id)).toEqual([1, 3]);
    expect(input).toEqual(before);
    expect(sameFirePlan(normalized, structuredClone(normalized))).toBe(true);
    expect(
      sameFirePlanContent(normalized, {
        id: normalized.id,
        draft: normalized.draft,
        current: normalized.current,
        comparisons: normalized.comparisons,
      }),
    ).toBe(true);
    expect(sameFirePlan(normalized, { ...normalized, updatedAt: "2026-09-05T00:00:01.000Z" })).toBe(
      false,
    );
  });

  it.each([
    { ...plan(), id: "other" },
    { ...plan(), updatedAt: "2026-09-05" },
    { ...plan(), unexpected: true },
    { ...plan(), current: emptyFireScenario() },
    {
      ...plan(),
      comparisons: [
        { id: 1, values },
        { id: 1, values },
      ],
    },
    {
      ...plan(),
      comparisons: Array.from({ length: 4 }, (_, index) => ({ id: index + 1, values })),
    },
  ])("rejects malformed stored plans without repairing them", (input) => {
    const before = structuredClone(input);
    expect(() => normalizeFirePlan(input)).toThrow();
    expect(input).toEqual(before);
  });

  it("upgrades old backups to v3 and round-trips the plan", () => {
    const old = syntheticBackup();
    expect(normalizeBackup(old).firePlan).toBeNull();
    const current = normalizeBackup({
      ...old,
      schemaVersion: 3,
      firePlan: plan(),
    });
    expect(current.schemaVersion).toBe(3);
    expect(current.firePlan).toEqual(plan());
    expect(normalizeBackup(structuredClone(current))).toEqual(current);
  });

  it("adds a missing plan idempotently and rejects a conflicting plan atomically", () => {
    const current = normalizeBackup(syntheticBackup());
    const incoming = normalizeBackup({
      ...syntheticBackup(),
      schemaVersion: 3,
      firePlan: plan(),
    });
    const merged = mergeBackup(current, incoming);
    expect(merged.added).toBe(1);
    expect(merged.backup.firePlan).toEqual(plan());
    expect(mergeBackup(merged.backup, incoming).added).toBe(0);
    const conflict = structuredClone(incoming);
    conflict.firePlan!.draft.target = "9999";
    expect(() => mergeBackup(merged.backup, conflict)).toThrow("FIRE計画と競合");
    expect(current.firePlan).toBeNull();
  });
});
