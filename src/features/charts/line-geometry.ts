export const chartColors = ["#67dfbe", "#b59aff", "#73cfff", "#ffc779", "#ff94b5", "#c4d0e2"];
/** Visual guides between real observations; never create values for the intervening dates. */
export function observationBridges(values: (number | null)[], connect?: boolean[]) {
  const bridges: [number, number][] = [];
  let previous: number | null = null;
  values.forEach((value, i) => {
    if (value === null) return;
    if (previous !== null && (i > previous + 1 || connect?.[i] === false))
      bridges.push([previous, i]);
    previous = i;
  });
  return bridges;
}
/** Inclusive segments: keep observations on both sides of an incomparable edge. */
export function seriesSegments(values: (number | null)[], connect?: boolean[]) {
  const segments: [number, number][] = [];
  let start: number | null = null;
  values.forEach((value, i) => {
    if (value === null || connect?.[i] === false) {
      if (start !== null) segments.push([start, i - 1]);
      start = null;
    }
    if (value !== null && start === null) start = i;
  });
  if (start !== null) segments.push([start, values.length - 1]);
  return segments;
}
/** Plotting only: never round or change the underlying financial values. */
export function linePaths(values: (number | null)[], max: number, connect?: boolean[]) {
  const paths: string[] = [];
  let path = "";
  values.forEach((value, i) => {
    if (value === null) {
      if (path) paths.push(path);
      path = "";
      return;
    }
    if (connect?.[i] === false && path) {
      paths.push(path);
      path = "";
    }
    const x = 64 + (i * 640) / Math.max(1, values.length - 1);
    const y = 220 - (value / (max || 1)) * 180;
    path += `${path ? " L" : "M"}${x},${y}`;
  });
  if (path) paths.push(path);
  return paths;
}
