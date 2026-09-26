import type { GoalAssumptions } from "./goal-fire";
import { assertMonth } from "./monthly";
import { DEFAULT_TAX_RATE } from "./withdrawal";

export const initialDrawdownValues = () => ({
  drawdownMonthly: "",
  drawdownYears: "30",
  drawdownReturnBps: "3",
  drawdownInflationBps: "2",
});
export type DrawdownValues = ReturnType<typeof initialDrawdownValues>;
export type GoalValues = Record<Exclude<keyof GoalAssumptions, "startMonth">, string> &
  DrawdownValues;
export const initialGoalValues = (): GoalValues => ({
  cash: "",
  tsumitate: "",
  growth: "",
  taxable: "",
  monthlyCash: "",
  monthlyInvestment: "",
  target: "50000000",
  returnBps: "3",
  withdrawalBps: "3",
  usedTotal: "",
  usedGrowth: "",
  usedYearTsumitate: "",
  usedYearGrowth: "",
  taxableCost: "",
  taxRate: DEFAULT_TAX_RATE,
  ...initialDrawdownValues(),
});
export interface GoalPlan {
  id: "primary";
  draft: GoalValues;
  referenceMonth: string;
  updatedAt: string;
}
export interface GoalPlanRepository {
  load(): Promise<GoalPlan | null>;
  save(next: GoalPlan, previous: GoalPlan | null): Promise<GoalPlan>;
}
export function normalizeGoalPlan(
  value: unknown,
  format: "stored" | "legacy" | "tax" | "current" = "stored",
): GoalPlan {
  const invalid = () =>
    new Error("保存済みの目標計画を検証できません。元のデータは変更していません。");
  if (!value || typeof value !== "object") throw invalid();
  const plan = value as Record<string, unknown>;
  if (
    Object.keys(plan).length !== 4 ||
    plan.id !== "primary" ||
    !plan.draft ||
    typeof plan.draft !== "object" ||
    typeof plan.referenceMonth !== "string" ||
    typeof plan.updatedAt !== "string" ||
    plan.updatedAt.length !== 24 ||
    Number.isNaN(Date.parse(plan.updatedAt)) ||
    new Date(plan.updatedAt).toISOString() !== plan.updatedAt
  )
    throw invalid();
  assertMonth(plan.referenceMonth);
  const draft = plan.draft as Record<string, unknown>;
  const keys = Object.keys(initialGoalValues());
  const taxKeys = keys.filter((key) => !key.startsWith("drawdown"));
  const legacyKeys = taxKeys.filter((key) => key !== "taxableCost" && key !== "taxRate");
  const count = Object.keys(draft).length;
  const detected =
    count === legacyKeys.length ? "legacy" : count === taxKeys.length ? "tax" : "current";
  const expected = detected === "legacy" ? legacyKeys : detected === "tax" ? taxKeys : keys;
  if (
    (format !== "stored" && format !== detected) ||
    Object.keys(draft).length !== expected.length ||
    !expected.every(
      (key) =>
        Object.hasOwn(draft, key) && typeof draft[key] === "string" && draft[key].length <= 16,
    )
  )
    throw invalid();
  // Drafts may be incomplete or invalid; calculation validates them separately.
  return {
    id: "primary",
    draft: {
      ...initialGoalValues(),
      ...Object.fromEntries(expected.map((key) => [key, draft[key]])),
    } as GoalValues,
    referenceMonth: plan.referenceMonth,
    updatedAt: plan.updatedAt,
  };
}
export const sameGoalPlan = (a: GoalPlan | null, b: GoalPlan | null) =>
  JSON.stringify(a) === JSON.stringify(b);
