import { describe, it, expect } from "vitest";
import {
  normalizeBackup,
  parseBackup,
  canonical,
  mergeBackup,
  MAX_BACKUP_BYTES,
} from "../../../src/domain/backup";
import { historyMonths, shiftMonth, monthChange } from "../../../src/domain/portfolio";
import type { MetricsSource } from "../../../src/domain/metrics";
import { syntheticBackup } from "../../fixtures/portfolio";

describe("versioned portable backup", () => {
  it("round trips every field including inactive, zero, note and timestamps deterministically", () => {
    const data = syntheticBackup();
    data.accounts[0].isActive = false;
    data.monthlyCashFlows[0].note = "合成メモ";
    data.accountBalanceSnapshots[0].balance = 0;
    const before = structuredClone(data);
    expect(parseBackup(canonical(data))).toEqual(normalizeBackup(data));
    const reversed = {
      ...data,
      accountBalanceSnapshots: [...data.accountBalanceSnapshots].reverse(),
    };
    expect(canonical(normalizeBackup(reversed))).toBe(canonical(normalizeBackup(data)));
    expect(data).toEqual(before);
  });
  it.each([0, 3, "1", null])("rejects unsupported version %s", (schemaVersion) =>
    expect(() => normalizeBackup({ ...syntheticBackup(), schemaVersion })).toThrow(),
  );
  it.each([
    "extra",
    "duplicate ID",
    "duplicate month",
    "duplicate balance",
    "missing reference",
    "bad date",
    "bad yen",
    "account cap",
  ])("rejects %s without mutating input", (kind) => {
    const data = syntheticBackup();
    if (kind === "extra") Object.assign(data, { secret: "synthetic" });
    if (kind === "duplicate ID") data.accounts.push({ ...data.accounts[0] });
    if (kind === "duplicate month")
      data.monthlyCashFlows.push({ ...data.monthlyCashFlows[0], id: "other" });
    if (kind === "duplicate balance")
      data.accountBalanceSnapshots.push({ ...data.accountBalanceSnapshots[0], id: "other" });
    if (kind === "missing reference") data.accounts = [];
    if (kind === "bad date") data.monthlyCashFlows[0].updatedAt = "2026-02-30T00:00:00.000Z";
    if (kind === "bad yen") data.accountBalanceSnapshots[0].balance = 0.1;
    if (kind === "account cap")
      data.accounts = Array.from({ length: 101 }, (_, i) => ({
        ...data.accounts[0],
        id: String(i),
      }));
    const before = structuredClone(data);
    expect(() => normalizeBackup(data)).toThrow();
    expect(data).toEqual(before);
  });
  it("rejects invalid JSON and oversized text before parsing", () => {
    expect(() => parseBackup("{")).toThrow();
    expect(() => parseBackup(" ".repeat(MAX_BACKUP_BYTES + 1))).toThrow("32 MiB");
    expect(() => parseBackup("あ".repeat(Math.floor(MAX_BACKUP_BYTES / 3) + 1))).toThrow("32 MiB");
  });
  it("is idempotent and adds missing data, but never overwrites conflicts", () => {
    const data = syntheticBackup();
    expect(mergeBackup(data, data).added).toBe(0);
    const empty = { ...data, accounts: [], monthlyCashFlows: [], accountBalanceSnapshots: [] };
    expect(mergeBackup(empty, data).added).toBe(4);
    const changed = structuredClone(data);
    changed.accountBalanceSnapshots[0].balance++;
    expect(() => mergeBackup(data, changed)).toThrow("競合");
    const collision = structuredClone(data);
    collision.monthlyCashFlows[0].id = "different-id";
    expect(() => mergeBackup(data, collision)).toThrow();
    expect(data.accountBalanceSnapshots[0].balance).toBe(100);
  });
});
describe("asset time series", () => {
  const sources = (): MetricsSource[] => {
    const b = syntheticBackup();
    return b.accountBalanceSnapshots.map((balance) => ({
      month: balance.month,
      accounts: b.accounts,
      records: { cash: null, balances: [balance] },
    }));
  };
  it("uses calendar keys across year boundaries and caps to twelve months", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2024-02", 1)).toBe("2024-03");
    expect(historyMonths("2026-09")).toHaveLength(12);
    expect(historyMonths("1900-02")).toEqual(["1900-01", "1900-02"]);
    expect(() => shiftMonth("2199-12", 1)).toThrow();
  });
  it("computes increases, decreases, zero base and exact rounding", () => {
    const [a, b] = sources();
    expect(monthChange(a, b)).toEqual({ delta: 20, percent: 20 });
    b.records.balances[0].balance = 80;
    expect(monthChange(a, b)).toEqual({ delta: -20, percent: -20 });
    a.records.balances[0].balance = 0;
    expect(monthChange(a, b)).toEqual({ delta: 80, percent: null });
    a.records.balances[0].balance = 3;
    b.records.balances[0].balance = 4;
    expect(monthChange(a, b).percent).toBe(33.3);
  });
  it("does not compare missing, different accounts, nonconsecutive or overflowing months", () => {
    const [a, b] = sources();
    expect(monthChange(undefined, b).delta).toBeNull();
    b.month = "2026-10";
    expect(monthChange(a, b).delta).toBeNull();
    b.month = "2026-09";
    a.records.balances = [];
    expect(monthChange(a, b).delta).toBeNull();
    const [c, d] = sources();
    d.accounts = [...d.accounts, { ...d.accounts[0], id: "other" }];
    d.records.balances[0].accountId = "other";
    expect(monthChange(c, d).delta).toBeNull();
    const [e, f] = sources();
    for (const source of [e, f]) {
      source.accounts = [...source.accounts, { ...source.accounts[0], id: "extra" }];
      source.records.balances[0].balance = Number.MAX_SAFE_INTEGER;
      source.records.balances.push({
        ...source.records.balances[0],
        id: "extra-balance",
        accountId: "extra",
        balance: 1,
      });
    }
    expect(monthChange(e, f).delta).toBeNull();
  });
});
