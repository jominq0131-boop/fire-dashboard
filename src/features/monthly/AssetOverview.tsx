import { currentTotal, localDate, observationStatus } from "../../domain/observations";
import { useEffect, useState } from "react";
import { HistoryExplorer } from "./HistoryExplorer";
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
  onRecordToday,
  onForecast,
}: {
  repository: PortfolioRepository;
  revision: number;
  onSelectMonth: (month: string) => void;
  onRecordToday: (accountId?: string) => void;
  onForecast: (value: number, source: string) => void;
}) {
  const [data, setData] = useState<PortfolioOverview | null>(null);
  const [end, setEnd] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let cancelled = false;
    repository
      .readOverview(localMonth(), end, localDate())
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
  const current = data?.current;
  const total = current ? currentTotal(current) : null;
  const rows =
    data?.months.map((source, index) => ({
      source,
      metrics: monthlyMetrics(source),
      change: monthChange(data.months[index - 1], source),
    })) ?? [];
  return (
    <section className="asset-history" aria-label="資産の全体像" aria-busy={busy}>
      <article className="asset-card">
        <div className="section-heading">
          <h2>総金融資産</h2>
          <button type="button" onClick={() => onRecordToday()}>
            今日の残高を記録
          </button>
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
            <p>各口座の最後に確認した残高 · {localDate()} 時点の記録</p>
            <div className="asset-value">
              <strong aria-label={!current?.balances.length ? "総金融資産: データなし" : undefined}>
                {current?.balances.length ? yen(total) : "—"}
              </strong>
            </div>
            {current && (
              <p>
                残高入力 {current.balances.length} / {current.accounts.length} 口座（休止中を含む）
              </p>
            )}
            <p className="field-hint">
              口座ごとに最後の記録を合計しています。確認日は口座によって異なり、現在の評価額を保証するものではありません。未記録の口座は合計に含めません。
            </p>
            {current && (
              <details className="freshness-list" open>
                <summary>口座ごとの確認状況</summary>
                {current.accounts.length === 0 ? (
                  <p>口座を登録すると、今日の残高から記録できます。</p>
                ) : (
                  current.accounts.map((a) => {
                    const b = current.balances.find((b) => b.accountId === a.id);
                    return (
                      <div key={a.id}>
                        <strong>
                          {a.name}
                          {!a.isActive ? "（休止中）" : ""}
                        </strong>
                        <span>{yen(b?.balance ?? null)}</span>
                        <small>{observationStatus(b, localDate())}</small>
                        <button
                          type="button"
                          aria-label={`${a.name}を更新`}
                          onClick={() => onRecordToday(a.id)}
                        >
                          更新
                        </button>
                      </div>
                    );
                  })
                )}
              </details>
            )}
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
          上の合計は口座別の最終確認残高、グラフは各月に記録した金額です。最大12か月。記録した点を線で結び、未記録や口座構成の変更をまたぐ区間は破線で表示します。一部口座のみの月は白抜きです。月中確認は月末評価ではありません。同じ口座の連続月だけ記録額の差を表示し、運用益とは区別します。
        </p>
        {!error && !busy && (
          <>
            {data && (
              <HistoryExplorer data={data} onSelectMonth={onSelectMonth} onForecast={onForecast} />
            )}
            <div
              className="history-table"
              role="region"
              aria-label="月別記録表・横にスクロールできます"
              tabIndex={0}
            >
              <table>
                <caption>月別の記録額と比較</caption>
                <thead>
                  <tr>
                    <th>月</th>
                    <th>残高合計</th>
                    <th>口座数</th>
                    <th>記録額の差</th>
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
                      <td>
                        {yen(r.metrics.assets)}
                        <small className="record-basis">
                          {r.source.records.balances.some((b) => b.asOfDate)
                            ? "確認日付きの記録"
                            : "月末入力・確認日未記録"}
                        </small>
                      </td>
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
