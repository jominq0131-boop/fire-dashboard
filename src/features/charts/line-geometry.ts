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
