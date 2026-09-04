import { useState } from "react";
import { InteractiveLineChart } from "../charts/InteractiveLineChart";
import { monthlyMetrics, type MetricAmount } from "../../domain/metrics";
import { monthChange, type PortfolioOverview } from "../../domain/portfolio";
import { observationStatus, localDate } from "../../domain/observations";
const yen = (n: MetricAmount) =>
  typeof n === "number"
    ? `${n.toLocaleString("ja-JP")} 円`
    : n === "overflow"
      ? "計算範囲超過"
      : "未入力";
export function HistoryExplorer({
  data,
  onSelectMonth,
  onForecast,
}: {
  data: PortfolioOverview;
  onSelectMonth: (month: string) => void;
  onForecast: (value: number, source: string) => void;
}) {
  const [account, setAccount] = useState(""),
    [period, setPeriod] = useState(12),
    [selected, setSelected] = useState(11);
  const months = data.months.slice(-period);
  const rows = months.map((source) => ({ source, metrics: monthlyMetrics(source) }));
  const index = Math.min(selected, rows.length - 1),
    row = rows[index];
  const chosen = data.current.accounts.find((a) => a.id === account);
  const values = rows.map((r) => {
    const n = account
      ? r.source.records.balances.find((b) => b.accountId === account)?.balance
      : r.metrics.assets;
    return typeof n === "number" ? n : null;
  });
  const change = monthChange(months[index - 1], row.source);
  const balances = row.source.records.balances.filter((b) => !account || b.accountId === account);
  return (
    <div className="history-explorer">
      <div className="chart-controls">
        <label>
          表示する口座
          <select
            aria-label="表示する口座"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">すべての口座</option>
            {data.current.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          表示期間
          <select
            aria-label="表示期間"
            value={period}
            onChange={(e) => {
              setPeriod(Number(e.target.value));
              setSelected(Number(e.target.value) - 1);
            }}
          >
            <option value="6">6か月</option>
            <option value="12">12か月</option>
          </select>
        </label>
      </div>
      <InteractiveLineChart
        title="月別資産チャート"
        labels={rows.map((r) => r.source.month)}
        selected={index}
        onSelect={setSelected}
        series={[
          {
            id: account || "total",
            label: chosen?.name ?? "記録した資産合計",
            values,
            connect: rows.map((r, i) =>
              account ? true : monthChange(months[i - 1], r.source).delta !== null,
            ),
            hollow: rows.map(
              (r) => !account && r.metrics.recordedAccounts !== r.metrics.totalAccounts,
            ),
          },
        ]}
      />
      <section className="month-inspector" aria-label="選択月の詳細">
        <h3>{row.source.month} の記録を確認</h3>
        <p>
          {account ? "選択口座の確認残高" : "記録した資産合計"}：
          {yen(account ? values[index] : row.metrics.assets)}
        </p>
        <p className="field-hint">
          入力 {row.metrics.recordedAccounts}/{row.metrics.totalAccounts}
          口座。月中確認を含む記録額です。未記録の口座は含めません。
        </p>
        <p>
          {account ? "全口座合計の前月差" : "前月の記録との差"}：{yen(change.delta)}
          {change.delta === null ? "（同じ口座の連続月が必要です）" : ""}
        </p>
        <dl className="metrics-list">
          <div>
            <dt>月全体の収入</dt>
            <dd>{yen(row.metrics.income)}</dd>
          </div>
          <div>
            <dt>月全体の消費支出</dt>
            <dd>{yen(row.metrics.expenses)}</dd>
          </div>
          <div>
            <dt>月全体の投資への拠出</dt>
            <dd>{yen(row.metrics.investmentContribution)}</dd>
          </div>
        </dl>
        <details>
          <summary>この月の口座別内訳（{balances.length}件）</summary>
          <ul className="chart-breakdown">
            {balances.map((b) => (
              <li key={b.id}>
                <strong>{row.source.accounts.find((a) => a.id === b.accountId)?.name}</strong>
                <span>{yen(b.balance)}</span>
                <small>{observationStatus(b, localDate())}</small>
              </li>
            ))}
          </ul>
          {!balances.length && <p>この月の残高は未記録です。</p>}
        </details>
        <div className="chart-controls">
          <button type="button" onClick={() => onSelectMonth(row.source.month)}>
            選択月の入力・編集へ
          </button>
          <button
            type="button"
            disabled={values[index] === null}
            onClick={() => {
              const value = values[index];
              if (value !== null)
                onForecast(
                  value,
                  `${row.source.month} · ${chosen?.name ?? "記録した資産合計"}（${row.metrics.recordedAccounts}/${row.metrics.totalAccounts}口座、現在の評価額ではありません）`,
                );
            }}
          >
            この記録額からFIREを試算
          </button>
        </div>
      </section>
    </div>
  );
}
