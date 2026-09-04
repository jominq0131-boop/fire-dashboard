import { describe, expect, it } from "vitest";
import {
  isAccountCategory,
  isIsoDateTime,
  isMonthKey,
  isNonNegativeYen,
  isYen,
} from "../../../src/domain/validation";

describe("yen validation", () => {
  it("accepts safe integer yen, including calculated negative deltas", () => {
    expect(isYen(0)).toBe(true);
    expect(isYen(123_456)).toBe(true);
    expect(isYen(-5_000)).toBe(true);
  });

  it("rejects fractional and unsafe amounts", () => {
    expect(isYen(100.5)).toBe(false);
    expect(isYen(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isYen("100")).toBe(false);
  });

  it("requires recorded balances and contributions to be non-negative", () => {
    expect(isNonNegativeYen(0)).toBe(true);
    expect(isNonNegativeYen(1)).toBe(true);
    expect(isNonNegativeYen(-1)).toBe(false);
  });
});

describe("month key validation", () => {
  it("accepts a canonical calendar month", () => {
    expect(isMonthKey("2026-09")).toBe(true);
  });

  it("rejects non-canonical or impossible months", () => {
    expect(isMonthKey("2026-9")).toBe(false);
    expect(isMonthKey("2026-00")).toBe(false);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("0000-01")).toBe(false);
  });
});

describe("other domain primitives", () => {
  it("supports only the initial extensible account categories", () => {
    expect(isAccountCategory("cash")).toBe(true);
    expect(isAccountCategory("nisa_tsumitate")).toBe(true);
    expect(isAccountCategory("nisa_growth")).toBe(true);
    expect(isAccountCategory("taxable")).toBe(true);
    expect(isAccountCategory("other")).toBe(true);
    expect(isAccountCategory("brokerage")).toBe(false);
  });

  it("accepts valid ISO-compatible timestamps", () => {
    expect(isIsoDateTime("2026-09-04T00:00:00.000Z")).toBe(true);
    expect(isIsoDateTime("not-a-date")).toBe(false);
  });
});

