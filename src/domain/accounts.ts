import type { AccountCategory, AssetAccount } from "./models";
import { isAccountCategory } from "./validation";

export interface AccountDetails {
  name: string;
  category: AccountCategory;
  isActive: boolean;
}

export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountError";
  }
}

export function validateAccountDetails(value: AccountDetails): AccountDetails {
  if (typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > 100) {
    throw new AccountError("口座名は空白以外の1〜100文字で入力してください。");
  }
  if (!isAccountCategory(value.category) || typeof value.isActive !== "boolean") {
    throw new AccountError("口座の種類と利用状態を確認してください。");
  }
  return { name: value.name.trim(), category: value.category, isActive: value.isActive };
}

export function isAssetAccount(value: unknown): value is AssetAccount {
  if (typeof value !== "object" || value === null) return false;
  const account = value as Partial<AssetAccount>;
  return (
    typeof account.id === "string" &&
    account.id.trim().length > 0 &&
    typeof account.name === "string" &&
    account.name === account.name.trim() &&
    account.name.length > 0 &&
    account.name.length <= 100 &&
    isAccountCategory(account.category) &&
    typeof account.isActive === "boolean" &&
    typeof account.sortOrder === "number" &&
    Number.isSafeInteger(account.sortOrder) &&
    account.sortOrder >= 0
  );
}

export function sameAccount(left: AssetAccount, right: AssetAccount): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.category === right.category &&
    left.isActive === right.isActive &&
    left.sortOrder === right.sortOrder
  );
}

/** No deletion: inactive accounts remain available for future balance history. */
export interface AccountRepository {
  list(): Promise<AssetAccount[]>;
  create(details: AccountDetails): Promise<AssetAccount>;
  update(expected: AssetAccount, details: AccountDetails): Promise<AssetAccount>;
}
