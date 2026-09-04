import { expect, it } from "vitest";
import {
  linePaths,
  observationBridges,
  seriesSegments,
} from "../../../src/features/charts/line-geometry";
it("connects adjacent observations and preserves missing gaps", () => {
  expect(linePaths([10, 20, null, 30], 30)).toHaveLength(2);
  expect(linePaths([10, 20], 20)[0]).toContain(" L");
  expect(linePaths([null, null], 0)).toEqual([]);
});
it("links successive real observations over gaps and coverage changes without fabricating amounts", () => {
  const values = [null, 0, null, 30, 20, null, Number.MAX_SAFE_INTEGER];
  const original = [...values];
  expect(observationBridges(values, [false, false, false, false, false])).toEqual([
    [1, 3],
    [3, 4],
    [4, 6],
  ]);
  expect(values).toEqual(original);
  expect(observationBridges([0, 10, 5])).toEqual([]);
  expect(observationBridges([null, 0, null])).toEqual([]);
  expect(observationBridges([null, null])).toEqual([]);
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
it("retains both edge observations while separating noncomparable coverage", () => {
  expect(
    seriesSegments([0, 20, 30, null, Number.MAX_SAFE_INTEGER], [false, true, false, false, false]),
  ).toEqual([
    [0, 1],
    [2, 2],
    [4, 4],
  ]);
  expect(seriesSegments([null, null])).toEqual([]);
  expect(seriesSegments([0])).toEqual([[0, 0]]);
  expect(seriesSegments([10, null, 20, 30])).toEqual([
    [0, 0],
    [2, 3],
  ]);
});
