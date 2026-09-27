import { monthlyMetrics, type MetricAmount, type MetricsSource } from "../../domain/metrics";

const format = (value: MetricAmount) =>
  value === null
    ? "미입력"
    : value === "overflow"
      ? "계산 범위 초과"
      : `${value.toLocaleString("ko-KR")} 엔`;
export function MonthlyOverview({ source }: { source: MetricsSource | null }) {
  if (!source)
    return (
      <article className="asset-card">
        <h2>이달에 기록한 자산</h2>
        <p>월별 기록에서 대상 월을 불러오면 저장된 금액을 집계합니다.</p>
        <strong aria-label="금융자산: 데이터 없음">—</strong>
      </article>
    );
  let metrics;
  try {
    metrics = monthlyMetrics(source);
  } catch {
    return (
      <article className="asset-card">
        <h2>금융자산</h2>
        <p role="alert">집계할 수 없습니다. 월별 기록을 다시 불러와 주세요.</p>
      </article>
    );
  }
  return (
    <article className="asset-card" aria-label="월별 요약">
      <h2>금융자산</h2>
      <p>{source.month} · 저장된 기록</p>
      <div className="asset-value">
        <strong>{format(metrics.assets)}</strong>
      </div>
      <p>
        잔액 입력 {metrics.recordedAccounts} / {metrics.totalAccounts}개 계좌(사용 중지 포함)
      </p>
      <p className="field-hint">
        입력한 계좌의 합계입니다. 미입력을 0엔으로 취급하지 않습니다. 부채를 뺀 순자산이 아닙니다.
      </p>
      <dl className="metrics-list">
        {(
          [
            ["수입", metrics.income],
            ["소비 지출", metrics.expenses],
            ["투자 납입", metrics.investmentContribution],
            ["소비 후 잉여", metrics.surplus],
            ["투자 후 현금 잉여", metrics.remainingCash],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{format(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="field-hint">
        소비 후 잉여 = 수입 − 소비 지출. 투자 후 현금 잉여는 여기서 투자 납입을 뺀 값입니다. 월말
        잔액 증감이나 운용수익이 아닙니다.
      </p>
      <p className="field-hint">
        저장하지 않은 입력은 반영하지 않습니다. 다른 탭이나 계좌의 변경은 ‘기록 불러오기’로 갱신해
        주세요. 계산 범위를 초과해도 원본 기록은 보존됩니다.
      </p>
    </article>
  );
}
