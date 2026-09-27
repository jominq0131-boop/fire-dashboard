import type { AccountCategory, AssetAccount } from "./models";
import { isAccountCategory } from "./validation";

/** Includes inactive accounts; this is an application guard, not a browser quota. */
export const MAX_ACCOUNTS = 100;
export const MAX_ACCOUNT_NAME_LENGTH = 100;
export const MAX_ACCOUNT_ID_LENGTH = 100;

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
  if (
    typeof value.name !== "string" ||
    value.name.length > MAX_ACCOUNT_NAME_LENGTH ||
    !value.name.trim()
  ) {
    throw new AccountError("계좌명은 공백을 제외한 1~100자로 입력해 주세요.");
  }
  if (!isAccountCategory(value.category) || typeof value.isActive !== "boolean") {
    throw new AccountError("계좌 종류와 사용 상태를 확인해 주세요.");
  }
  return { name: value.name.trim(), category: value.category, isActive: value.isActive };
}

export function assertAccountCapacity(count: number, adding = false): void {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new AccountError("계좌 수를 확인할 수 없습니다.");
  if (count > MAX_ACCOUNTS || (adding && count === MAX_ACCOUNTS)) {
    throw new AccountError(
      `안전하게 처리할 수 있는 계좌는 중지한 계좌를 포함해 최대 ${MAX_ACCOUNTS}개입니다. 저장된 데이터는 삭제하지 않았습니다. 추가하지 말고 지원을 요청해 주세요.`,
    );
  }
}

export function isAssetAccount(value: unknown): value is AssetAccount {
  if (typeof value !== "object" || value === null) return false;
  const account = value as Partial<AssetAccount>;
  return (
    Object.keys(account).length === 5 &&
    typeof account.id === "string" &&
    account.id.length <= MAX_ACCOUNT_ID_LENGTH &&
    account.id.trim().length > 0 &&
    typeof account.name === "string" &&
    account.name.length > 0 &&
    account.name.length <= MAX_ACCOUNT_NAME_LENGTH &&
    account.name === account.name.trim() &&
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
