import { monthlyMetrics, type MetricAmount, type MetricsSource } from "../../domain/metrics";

const format = (value: MetricAmount) =>
  value === null
    ? "未入力"
    : value === "overflow"
      ? "計算範囲超過"
      : `${value.toLocaleString("ja-JP")} 円`;
export function MonthlyOverview({ source }: { source: MetricsSource | null }) {
  if (!source)
    return (
      <article className="asset-card">
        <h2>この月に記録した資産</h2>
        <p>月別記録で対象月を読み込むと、保存済みの金額を集計します。</p>
        <strong aria-label="金融資産: データなし">—</strong>
      </article>
    );
  let metrics;
  try {
    metrics = monthlyMetrics(source);
  } catch {
    return (
      <article className="asset-card">
        <h2>金融資産</h2>
        <p role="alert">集計できません。月別記録を再読み込みしてください。</p>
      </article>
    );
  }
  return (
    <article className="asset-card" aria-label="月別サマリー">
      <h2>金融資産</h2>
      <p>{source.month} · 保存済みの記録</p>
      <div className="asset-value">
        <strong>{format(metrics.assets)}</strong>
      </div>
      <p>
        残高入力 {metrics.recordedAccounts} / {metrics.totalAccounts} 口座（休止中を含む）
      </p>
      <p className="field-hint">
        入力済み口座の合計です。未入力は0円とみなしません。負債を差し引いた純資産ではありません。
      </p>
      <dl className="metrics-list">
        {(
          [
            ["収入", metrics.income],
            ["消費支出", metrics.expenses],
            ["投資への拠出", metrics.investmentContribution],
            ["消費後の余剰", metrics.surplus],
            ["投資後の現金余剰", metrics.remainingCash],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{format(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="field-hint">
        消費後の余剰 = 収入 −
        消費支出。投資後の現金余剰は、さらに投資への拠出を引いた値です。月末残高の増減や運用益ではありません。
      </p>
      <p className="field-hint">
        未保存の入力は反映しません。他のタブや口座の変更は「記録を読み込む」で更新してください。計算範囲超過の場合も元の記録は保持されます。
      </p>
    </article>
  );
}
