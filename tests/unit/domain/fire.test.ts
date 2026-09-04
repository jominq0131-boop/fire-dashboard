import { describe, expect, it } from "vitest";
import { parseRate, projectFire, type FireScenario } from "../../../src/domain/fire";
const base: FireScenario = {
  startingAssets: 0,
  target: 1200,
  monthlyContribution: 100,
  returnBps: 0,
  inflationBps: 0,
};
describe("explicit FIRE scenarios", () => {
  it("finds the exact month with zero return and end-month contributions", () => {
    const r = projectFire(base);
    expect(r.reachedMonth).toBe(12);
    expect(r.points[1]).toEqual({ month: 12, assets: 1200, target: 1200 });
    expect(r.points).toHaveLength(101);
  });
  it("distinguishes already reached, unreachable, and horizon boundary", () => {
    expect(projectFire({ ...base, startingAssets: 1200 }).reachedMonth).toBe(0);
    expect(projectFire({ ...base, monthlyContribution: 0 }).reachedMonth).toBeNull();
    expect(projectFire({ ...base, target: 120000 }).reachedMonth).toBe(1200);
    expect(projectFire({ ...base, target: 120001 }).reachedMonth).toBeNull();
  });
  it("compounds monthly with half-up yen rounding, before contribution", () => {
    const r = projectFire({
      ...base,
      startingAssets: 100,
      target: 102,
      monthlyContribution: 1,
      returnBps: 600,
    });
    expect(r.reachedMonth).toBe(1); // 100 * 1.005 => 101, then +1
    expect(
      projectFire({ ...base, startingAssets: 100, monthlyContribution: 0, returnBps: -600 })
        .points[1].assets,
    ).toBe(100);
  });
  it("inflates the target and retains first crossing even if later lost", () => {
    expect(projectFire({ ...base, inflationBps: 1200 }).reachedMonth).toBeGreaterThan(12);
    const r = projectFire({
      ...base,
      startingAssets: 1200,
      monthlyContribution: 0,
      returnBps: -1200,
    });
    expect(r.reachedMonth).toBe(0);
    expect(r.points[1].assets).toBeLessThan(1200);
  });
  it("stops without returning unsafe amounts", () => {
    const r = projectFire({ ...base, startingAssets: Number.MAX_SAFE_INTEGER, returnBps: 10000 });
    expect(r.overflowMonth).toBe(1);
    expect(r.points).toHaveLength(1);
    expect(
      projectFire({ ...base, target: Number.MAX_SAFE_INTEGER, inflationBps: 10000 }).overflowMonth,
    ).toBe(1);
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid yen %s",
    (value) => {
      expect(() => projectFire({ ...base, startingAssets: value })).toThrow();
    },
  );
  it("requires a positive target and bounded integer basis points", () => {
    expect(() => projectFire({ ...base, target: 0 })).toThrow();
    for (const returnBps of [-10000, 10001, 0.5, NaN])
      expect(() => projectFire({ ...base, returnBps })).toThrow();
  });
  it("parses explicit percentages without exponent, whitespace or defaults", () => {
    expect(parseRate("3.25")).toBe(325);
    expect(parseRate("-99")).toBe(-9900);
    expect(parseRate("100")).toBe(10000);
    for (const s of ["", " 4", "4%", "1e2", "3.251", "-99.01", "100.01"])
      expect(() => parseRate(s)).toThrow();
  });
});
