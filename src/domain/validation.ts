import {
  accountCategories,
  type AccountCategory,
  type MonthKey,
  type NonNegativeYen,
  type Yen,
} from "./models";

export function isYen(value: unknown): value is Yen {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function isNonNegativeYen(value: unknown): value is NonNegativeYen {
  return isYen(value) && value >= 0;
}

export function isMonthKey(value: unknown): value is MonthKey {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4,})-(0[1-9]|1[0-2])$/.exec(value);
  return match !== null && Number(match[1]) > 0;
}

export function isAccountCategory(value: unknown): value is AccountCategory {
  return typeof value === "string" && accountCategories.some((category) => category === value);
}

export function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

