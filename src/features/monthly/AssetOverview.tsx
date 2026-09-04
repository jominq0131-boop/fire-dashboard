import { useEffect, useState } from "react";
import { monthlyMetrics, type MetricAmount } from "../../domain/metrics";
import {
  localMonth,
  monthChange,
  type PortfolioOverview,
  type PortfolioRepository,
} from "../../domain/portfolio";

const yen = (value: MetricAmount) =>
  value === null
    ? "未入力"
    : value === "overflow"
      ? "計算範囲超過"
      : `${value.toLocaleString("ja-JP")} 円`;
export function AssetOverview({
  repository,
  revision,
  onSelectMonth,
}: {
  repository: PortfolioRepository;
  revision: number;
  onSelectMonth: (month: string) => void;
}) {
  const [data, setData] = useState<PortfolioOverview | null>(null);
  const [end, setEnd] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let cancelled = false;
    repository
      .readOverview(localMonth(), end)
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setError("");
          setBusy(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : "資産を読み込めません。");
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [repository, revision, end, refresh]);
  const latest = data?.latest;
  const latestMetrics = latest ? monthlyMetrics(latest) : null;
  const rows =
    data?.months.map((source, index) => ({
      source,
      metrics: monthlyMetrics(source),
      change: monthChange(data.months[index - 1], source),
    })) ?? [];
  const max = Math.max(
    0,
    ...rows.map((r) => (typeof r.metrics.assets === "number" ? r.metrics.assets : 0)),
  );
  const point = (i: number, value: number) => ({
    x: 48 + (i * 640) / Math.max(1, rows.length - 1),
    y: 190 - (value / (max || 1)) * 150,
  });
  return (
    <section className="asset-history" aria-label="資産の全体像" aria-busy={busy}>
      <article className="asset-card">
        <div className="section-heading">
          <h2>総金融資産</h2>
          <button
            type="button"
            onClick={() => {
              setBusy(true);
              setRefresh((n) => n + 1);
            }}
          >
            資産を再読み込み
          </button>
        </div>
        {error ? (
          <p className="error-message">{error}</p>
        ) : busy ? (
          <p>資産を読み込んでいます…</p>
        ) : (
          <>
            <p>{latest ? `${latest.month} 月末 · 最新の記録` : "今月以前の残高はまだありません"}</p>
            <div className="asset-value">
              <strong aria-label={!latest ? "総金融資産: データなし" : undefined}>
                {latestMetrics ? yen(latestMetrics.assets) : "—"}
              </strong>
            </div>
            {latestMetrics && (
              <p>
                残高入力 {latestMetrics.recordedAccounts} / {latestMetrics.totalAccounts}{" "}
                口座（休止中を含む）
              </p>
            )}
            <p className="field-hint">
              最新の記録月の残高を合計しています。実時間の残高ではありません。未入力の口座や過去の残高は補完せず、未来の月は除きます。負債を引いた純資産ではありません。
            </p>
            {latest && (
              <button type="button" onClick={() => onSelectMonth(latest.month)}>
                この月の詳細を見る
              </button>
            )}
          </>
        )}
      </article>
      <article className="asset-card trend-card">
        <div className="section-heading">
          <h2>資産の推移</h2>
          <label>
            グラフの終了月
            <input
              type="month"
              min="1900-01"
              max="2199-12"
              value={end ?? data?.months.at(-1)?.month ?? localMonth()}
              onChange={(e) => {
                if (e.target.value) {
                  setBusy(true);
                  setEnd(e.target.value);
                }
              }}
            />
          </label>
        </div>
        <p className="field-hint">
          最大12か月。記録なしは空白、口座の一部のみの月は白抜きです。同じ口座が記録された連続月だけ増減を表示します。増減は運用益とは限りません。
        </p>
        {!error && !busy && (
          <>
            <svg
              viewBox="0 0 736 230"
              role="img"
              aria-label="月末金融資産の推移。正確な金額と増減は下の表に表示しています。"
            >
              <line x1="48" y1="190" x2="688" y2="190" stroke="#a2a9b3" />
              <text x="48" y="24" fontSize="12">
                {rows.some((r) => typeof r.metrics.assets === "number")
                  ? `最大 ${max.toLocaleString("ja-JP")} 円`
                  : "残高の記録はありません"}
              </text>
              {rows.map((r, i) => {
                if (typeof r.metrics.assets !== "number") return null;
                const p = point(i, r.metrics.assets),
                  previous = rows[i - 1];
                const before =
                  previous && typeof previous.metrics.assets === "number"
                    ? point(i - 1, previous.metrics.assets)
                    : null;
                return (
                  <g key={r.source.month}>
                    {before && r.change.delta !== null && (
                      <line
                        x1={before.x}
                        y1={before.y}
                        x2={p.x}
                        y2={p.y}
                        stroke="#2474ef"
                        strokeWidth="2"
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="5"
                      stroke="#2474ef"
                      strokeWidth="2"
                      fill={
                        r.metrics.recordedAccounts === r.metrics.totalAccounts ? "#2474ef" : "white"
                      }
                    >
                      <title>
                        {r.source.month}: {yen(r.metrics.assets)}
                      </title>
                    </circle>
                  </g>
                );
              })}
              <text x="48" y="216" fontSize="12">
                {rows[0]?.source.month}
              </text>
              <text x="688" y="216" textAnchor="end" fontSize="12">
                {rows.at(-1)?.source.month}
              </text>
            </svg>
            <div className="history-table">
              <table>
                <caption>月別の資産と前月比</caption>
                <thead>
                  <tr>
                    <th>月</th>
                    <th>残高合計</th>
                    <th>口座数</th>
                    <th>前月比</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.source.month}>
                      <td>
                        <button type="button" onClick={() => onSelectMonth(r.source.month)}>
                          {r.source.month}
                        </button>
                      </td>
                      <td>{yen(r.metrics.assets)}</td>
                      <td>
                        {r.metrics.recordedAccounts}/{r.metrics.totalAccounts}
                      </td>
                      <td>
                        {r.change.delta === null
                          ? "比較不可"
                          : `${yen(r.change.delta)}${r.change.percent === null ? "" : ` (${r.change.percent}%)`}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </article>
    </section>
  );
}
