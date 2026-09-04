import { describe, expect, it } from "vitest";
import { isAssetAccount, sameAccount, validateAccountDetails } from "../../../src/domain/accounts";
import type { AccountDetails } from "../../../src/domain/accounts";
import { storageMigrationPlan } from "../../../src/domain/storage-migrations";

const details: AccountDetails = { name: "テスト口座", category: "cash", isActive: true };
const account = { ...details, id: "synthetic-account", sortOrder: 0 };

describe("account validation", () => {
  it("trims names without changing the input", () => {
    const input = { ...details, name: "  テスト口座　" };
    expect(validateAccountDetails(input)).toEqual(details);
    expect(input.name).toBe("  テスト口座　");
  });
  it.each(["", " \t\n　", "a".repeat(101)])("rejects invalid name %j", (name) => {
    expect(() => validateAccountDetails({ ...details, name })).toThrow();
  });
  it("accepts boundary-length names and inactive accounts", () => {
    expect(
      validateAccountDetails({ ...details, name: "a".repeat(100), isActive: false }).isActive,
    ).toBe(false);
  });
  it("rejects unsupported categories and nonboolean status", () => {
    expect(() =>
      validateAccountDetails({ ...details, category: "unknown" } as unknown as AccountDetails),
    ).toThrow();
    expect(() =>
      validateAccountDetails({ ...details, isActive: "true" } as unknown as AccountDetails),
    ).toThrow();
  });
  it("validates all persisted fields", () => {
    expect(isAssetAccount(account)).toBe(true);
    for (const invalid of [
      null,
      {},
      { ...account, id: " " },
      { ...account, name: " a" },
      { ...account, category: "unknown" },
      { ...account, isActive: 1 },
      ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map((sortOrder) => ({
        ...account,
        sortOrder,
      })),
    ]) {
      expect(isAssetAccount(invalid)).toBe(false);
    }
  });
  it("detects changes to every persisted field for optimistic concurrency", () => {
    expect(sameAccount(account, { ...account })).toBe(true);
    for (const changed of [
      { ...account, name: "別名" },
      { ...account, id: "other" },
      { ...account, category: "other" as const },
      { ...account, isActive: false },
      { ...account, sortOrder: 1 },
    ]) {
      expect(sameAccount(account, changed)).toBe(false);
    }
  });
});

describe("deterministic initial database migration", () => {
  it("creates only an empty accounts store with a stable primary key", () => {
    expect(storageMigrationPlan(0)).toEqual([{ version: 1, store: "accounts", keyPath: "id" }]);
    expect(storageMigrationPlan(0)).toEqual(storageMigrationPlan(0));
  });
  it("does nothing when reopening version 1", () => {
    expect(storageMigrationPlan(1)).toEqual([]);
  });
  it.each([-1, 0.5, 2, NaN])("rejects unsupported source version %s", (version) => {
    expect(() => storageMigrationPlan(version)).toThrow();
  });
  it("rejects unknown target versions", () => {
    expect(() => storageMigrationPlan(1, 2)).toThrow();
  });
});
