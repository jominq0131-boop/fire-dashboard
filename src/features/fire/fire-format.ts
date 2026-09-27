import type { FireProjection } from "../../domain/fire";
export function arrivalText(result: FireProjection): string {
  if (result.reachedMonth === 0) return "시작 시점에 목표 달성";
  if (result.reachedMonth !== null)
    return `최초 목표 달성: ${Math.floor(result.reachedMonth / 12)}년${result.reachedMonth % 12}개월 후`;
  return result.overflowMonth !== null
    ? "계산 한도로 인해 달성 시점을 판단할 수 없습니다"
    : "이 가정으로는 100년 이내에 목표에 도달하지 않습니다";
}
