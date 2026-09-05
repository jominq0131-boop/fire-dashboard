import { parseRate, projectFire, type FireProjection } from "./fire";
import { parseYen } from "./monthly";

export const FIRE_PLAN_ID = "primary";
export const MAX_FIRE_COMPARISONS = 3;
export const MAX_FIRE_INPUT_LENGTH = 16;

export interface FireScenarioValues {
  startingAssets: string;
  target: string;
  monthlyContribution: string;
  returnBps: string;
  inflationBps: string;
}

export interface SavedFireScenario {
  id: number;
  values: FireScenarioValues;
}

export interface FirePlan {
  id: typeof FIRE_PLAN_ID;
  draft: FireScenarioValues;
  current: FireScenarioValues | null;
  comparisons: SavedFireScenario[];
  updatedAt: string;
}

export interface FirePlanRepository {
  load(): Promise<FirePlan | null>;
  save(next: FirePlan, previous: FirePlan | null): Promise<FirePlan>;
}

export const emptyFireScenario = (): FireScenarioValues => ({
  startingAssets: "",
  target: "",
  monthlyContribution: "",
  returnBps: "",
  inflationBps: "",
});

const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

const isDraftMoney = (value: unknown) =>
  typeof value === "string" &&
  value.length <= MAX_FIRE_INPUT_LENGTH &&
  (value === "" || /^\d+$/.test(value));

const isDraftRate = (value: unknown) =>
  typeof value === "string" &&
  value.length <= MAX_FIRE_INPUT_LENGTH &&
  (value === "" || /^-?\d{0,3}(?:\.\d{0,2})?$/.test(value));

export function isFireScenarioValues(
  value: unknown,
  complete = false,
): value is FireScenarioValues {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  if (
    !exactKeys(input, [
      "startingAssets",
      "target",
      "monthlyContribution",
      "returnBps",
      "inflationBps",
    ]) ||
    !isDraftMoney(input.startingAssets) ||
    !isDraftMoney(input.target) ||
    !isDraftMoney(input.monthlyContribution) ||
    !isDraftRate(input.returnBps) ||
    !isDraftRate(input.inflationBps)
  )
    return false;
  if (!complete) return true;
  const values = input as unknown as FireScenarioValues;
  try {
    projectFire({
      startingAssets: parseYen(values.startingAssets),
      target: parseYen(values.target),
      monthlyContribution: parseYen(values.monthlyContribution),
      returnBps: parseRate(values.returnBps),
      inflationBps: parseRate(values.inflationBps),
    });
    return true;
  } catch {
    return false;
  }
}

export function projectFireValues(values: FireScenarioValues): FireProjection {
  return projectFire({
    startingAssets: parseYen(values.startingAssets),
    target: parseYen(values.target),
    monthlyContribution: parseYen(values.monthlyContribution),
    returnBps: parseRate(values.returnBps),
    inflationBps: parseRate(values.inflationBps),
  });
}

const validIsoTime = (value: unknown) =>
  typeof value === "string" &&
  value.length <= 30 &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;

const copyValues = (values: FireScenarioValues): FireScenarioValues => ({ ...values });

export function normalizeFirePlan(value: unknown): FirePlan {
  if (!value || typeof value !== "object")
    throw new Error("保存済みのFIRE計画を検証できません。元のデータは変更していません。");
  const plan = value as Record<string, unknown>;
  if (
    !exactKeys(plan, ["id", "draft", "current", "comparisons", "updatedAt"]) ||
    plan.id !== FIRE_PLAN_ID ||
    !isFireScenarioValues(plan.draft) ||
    (plan.current !== null && !isFireScenarioValues(plan.current, true)) ||
    !Array.isArray(plan.comparisons) ||
    plan.comparisons.length > MAX_FIRE_COMPARISONS ||
    !validIsoTime(plan.updatedAt)
  )
    throw new Error("保存済みのFIRE計画を検証できません。元のデータは変更していません。");
  const comparisons = plan.comparisons as unknown[];
  const normalized = comparisons.map((item) => {
    if (!item || typeof item !== "object")
      throw new Error("保存済みのFIRE計画を検証できません。元のデータは変更していません。");
    const record = item as Record<string, unknown>;
    if (
      !exactKeys(record, ["id", "values"]) ||
      !Number.isSafeInteger(record.id) ||
      Number(record.id) < 1 ||
      !isFireScenarioValues(record.values, true)
    )
      throw new Error("保存済みのFIRE計画を検証できません。元のデータは変更していません。");
    return { id: Number(record.id), values: copyValues(record.values) };
  });
  if (new Set(normalized.map((item) => item.id)).size !== normalized.length)
    throw new Error("保存済みのFIRE計画を検証できません。元のデータは変更していません。");
  return {
    id: FIRE_PLAN_ID,
    draft: copyValues(plan.draft),
    current: plan.current === null ? null : copyValues(plan.current),
    comparisons: normalized.sort((a, b) => a.id - b.id),
    updatedAt: String(plan.updatedAt),
  };
}

export function sameFirePlan(left: FirePlan | null, right: FirePlan | null) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function sameFirePlanContent(plan: FirePlan | null, next: Omit<FirePlan, "updatedAt">) {
  if (!plan) return false;
  return (
    JSON.stringify({
      id: plan.id,
      draft: plan.draft,
      current: plan.current,
      comparisons: plan.comparisons,
    }) === JSON.stringify(next)
  );
}
