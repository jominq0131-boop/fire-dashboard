import type { MonthlyCashFlowRecord, AccountBalanceSnapshot } from "./models";
import { isMonthKey, isIsoDateTime, isNonNegativeYen } from "./validation";
export const MAX_MONTHS = 3600;
export const MAX_BALANCES = 360000;
export class MonthlyError extends Error {}
export function assertMonth(month: unknown): asserts month is string {
  if (!isMonthKey(month) || month < "1900-01" || month > "2199-12")
    throw new MonthlyError("対象月は1900-01〜2199-12で入力してください。");
}
export function parseYen(input: string): number {
  if (!/^[0-9]{1,16}$/.test(input) || !isNonNegativeYen(Number(input)))
    throw new MonthlyError(
      "金額は0以上の安全な整数の円で入力してください。空欄・小数・指数表記は使えません。",
    );
  return Number(input);
}
export function assertCapacity(count: number, limit: number, adding = false) {
  if (!Number.isSafeInteger(count) || count < 0 || count > limit || (adding && count === limit))
    throw new MonthlyError(
      "記録数が安全に処理できる上限を超えています。データは削除していません。",
    );
}
export type CashDetails = Pick<
  MonthlyCashFlowRecord,
  "income" | "expenses" | "investmentContribution" | "note"
>;
export function validateCash(value: CashDetails): CashDetails {
  if (
    ![value.income, value.expenses, value.investmentContribution].every(isNonNegativeYen) ||
    (value.note !== undefined && (typeof value.note !== "string" || value.note.length > 1000))
  )
    throw new MonthlyError("金額とメモ（1000文字以内）を確認してください。");
  return {
    income: value.income,
    expenses: value.expenses,
    investmentContribution: value.investmentContribution,
    ...(value.note === undefined ? {} : { note: value.note }),
  };
}
export function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 100;
}
export function isMonthlyRecord(
  value: unknown,
  cash: boolean,
): value is MonthlyCashFlowRecord | AccountBalanceSnapshot {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  const keys = cash
    ? [
        "id",
        "month",
        "income",
        "expenses",
        "investmentContribution",
        "note",
        "createdAt",
        "updatedAt",
      ]
    : ["id", "month", "accountId", "balance", "createdAt", "updatedAt"];
  if (
    !Object.keys(r).every((k) => keys.includes(k)) ||
    !validId(r.id) ||
    !isIsoDateTime(r.createdAt) ||
    !isIsoDateTime(r.updatedAt) ||
    r.updatedAt < r.createdAt
  )
    return false;
  try {
    assertMonth(r.month);
    if (cash) validateCash(r as unknown as CashDetails);
    else if (!validId(r.accountId) || !isNonNegativeYen(r.balance)) return false;
    return true;
  } catch {
    return false;
  }
}
export function sameRecord(a: object, b: object): boolean {
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every((k) => left[k] === right[k])
  );
}
export interface MonthRecords {
  cash: MonthlyCashFlowRecord | null;
  balances: AccountBalanceSnapshot[];
}
export interface MonthlyRepository {
  readMonth(month: string): Promise<MonthRecords>;
  saveCash(
    month: string,
    details: CashDetails,
    expected: MonthlyCashFlowRecord | null,
  ): Promise<MonthlyCashFlowRecord>;
  saveBalance(
    month: string,
    accountId: string,
    balance: number,
    expected: AccountBalanceSnapshot | null,
  ): Promise<AccountBalanceSnapshot>;
}
