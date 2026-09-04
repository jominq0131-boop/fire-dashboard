import { expect, it } from "vitest";
import { linePaths } from "../../../src/features/charts/line-geometry";
it("connects adjacent observations and preserves missing gaps", () => {
  expect(linePaths([10, 20, null, 30], 30)).toHaveLength(2);
  expect(linePaths([10, 20], 20)[0]).toContain(" L");
  expect(linePaths([null, null], 0)).toEqual([]);
});
it("breaks lines when aggregate account coverage changes", () => {
  const segments = linePaths([10, 20, 30], 30, [false, true, false]);
  expect(segments).toHaveLength(2);
  expect(segments[0]).toContain(" L");
  expect(segments[1]).not.toContain(" L");
});
it("plots zero, single points and maximum yen without non-finite coordinates", () => {
  expect(linePaths([0], 0)).toEqual(["M64,220"]);
  expect(linePaths([Number.MAX_SAFE_INTEGER], Number.MAX_SAFE_INTEGER)).toEqual(["M64,40"]);
});
