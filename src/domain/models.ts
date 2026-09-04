/** Integer Japanese yen. Values may be signed when representing a calculated delta. */
export type Yen = number;

/** Integer Japanese yen that cannot be negative. */
export type NonNegativeYen = Yen;

/** A calendar month in the canonical YYYY-MM representation. */
export type MonthKey = string;

export const accountCategories = [
  "cash",
  "nisa_tsumitate",
  "nisa_growth",
  "taxable",
  "other",
] as const;

export type AccountCategory = (typeof accountCategories)[number];

export interface AssetAccount {
  id: string;
  name: string;
  category: AccountCategory;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Cash-flow information for one calendar month.
 *
 * Investment contribution is intentionally separate from expenses. It is an
 * allocation of money, not a consumption expense.
 */
export interface MonthlyCashFlowRecord {
  id: string;
  month: MonthKey;
  income: NonNegativeYen;
  expenses: NonNegativeYen;
  investmentContribution: NonNegativeYen;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/** A month-end balance for one account; it is not a cash-flow transaction. */
export interface AccountBalanceSnapshot {
  id: string;
  month: MonthKey;
  accountId: string;
  balance: NonNegativeYen;
  createdAt: string;
  updatedAt: string;
}

/** Assumptions are explicit so that no universal FIRE rule is hard-coded. */
export interface FireSettings {
  targetAmount: NonNegativeYen;
  annualReturnRate: number;
  annualInflationRate: number;
  monthlyContributionAssumption: NonNegativeYen;
  withdrawalRate?: number;
}

