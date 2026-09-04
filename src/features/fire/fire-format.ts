import type { FireProjection } from "../../domain/fire";
export function arrivalText(result: FireProjection): string {
  if (result.reachedMonth === 0) return "開始時点で目標に到達";
  if (result.reachedMonth !== null)
    return `最初の目標到達：${Math.floor(result.reachedMonth / 12)}年${result.reachedMonth % 12}か月後`;
  return result.overflowMonth !== null
    ? "計算上限のため到達時期を判定できません"
    : "この仮定では100年以内に目標に届きません";
}
