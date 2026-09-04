export interface FireScenario {
  startingAssets: number;
  target: number;
  monthlyContribution: number;
  returnBps: number;
  inflationBps: number;
}
export interface FirePoint {
  month: number;
  assets: number;
  target: number;
}
export interface FireProjection {
  reachedMonth: number | null;
  overflowMonth: number | null;
  points: FirePoint[];
}
export function parseRate(value: string): number {
  if (!/^-?\d{1,3}(\.\d{1,2})?$/.test(value))
    throw new Error("率は-99〜100%の小数2桁以内で入力してください。");
  const bps = Math.round(Number(value) * 100);
  if (bps < -9900 || bps > 10000) throw new Error("率は-99〜100%で入力してください。");
  return bps;
}
// Annual nominal rates / 12. Positive balances rounded to nearest yen, ties up.
function grow(value: bigint, bps: number) {
  return (value * BigInt(120000 + bps) + 60000n) / 120000n;
}
export function projectFire(s: FireScenario): FireProjection {
  if (
    ![s.startingAssets, s.target, s.monthlyContribution].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    s.target === 0 ||
    ![s.returnBps, s.inflationBps].every((n) => Number.isInteger(n) && n >= -9900 && n <= 10000)
  )
    throw new Error("金額・目標・率を確認してください。目標は1円以上です。");
  let assets = BigInt(s.startingAssets),
    target = BigInt(s.target);
  const result: FireProjection = {
    reachedMonth: assets >= target ? 0 : null,
    overflowMonth: null,
    points: [{ month: 0, assets: s.startingAssets, target: s.target }],
  };
  for (let month = 1; month <= 1200; month++) {
    assets = grow(assets, s.returnBps) + BigInt(s.monthlyContribution);
    target = grow(target, s.inflationBps);
    if (assets > BigInt(Number.MAX_SAFE_INTEGER) || target > BigInt(Number.MAX_SAFE_INTEGER)) {
      result.overflowMonth = month;
      return result;
    }
    if (result.reachedMonth === null && assets >= target) result.reachedMonth = month;
    if (month % 12 === 0)
      result.points.push({ month, assets: Number(assets), target: Number(target) });
  }
  return result;
}
