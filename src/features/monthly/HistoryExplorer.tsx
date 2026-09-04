import { useState } from "react";
import { InteractiveLineChart, type ChartSeries } from "../charts/InteractiveLineChart";
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
    [view, setView] = useState("assets"),
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
  const investmentSources = rows.map(({ source }) => {
    const ids = new Set(
      source.accounts
        .filter((a) => ["nisa_tsumitate", "nisa_growth", "taxable"].includes(a.category))
        .map((a) => a.id),
    );
    return {
      ...source,
      records: {
        ...source.records,
        balances: source.records.balances.filter((b) => ids.has(b.accountId)),
      },
    };
  });
  const investmentValues = investmentSources.map((source) => monthlyMetrics(source).assets);
  const hasInvestments = data.current.accounts.some((a) =>
    ["nisa_tsumitate", "nisa_growth", "taxable"].includes(a.category),
  );
  const assetSeries: ChartSeries[] = [
    {
      id: account || "total",
      label: chosen?.name ?? "記録した資産合計",
      values,
      kind: "area",
      connect: rows.map((r, i) =>
        account ? true : monthChange(months[i - 1], r.source).delta !== null,
      ),
      hollow: rows.map((r) => !account && r.metrics.recordedAccounts !== r.metrics.totalAccounts),
      missing: rows.map((r) => (r.metrics.assets === "overflow" ? "計算範囲超過" : "残高未記録")),
    },
  ];
  if (!account && hasInvestments)
    assetSeries.push({
      id: "investments",
      label: "うちNISA・課税投資",
      kind: "bar",
      connect: investmentSources.map(
        (source, i) => monthChange(investmentSources[i - 1], source).delta !== null,
      ),
      values: investmentValues.map((n) => (typeof n === "number" ? n : null)),
      missing: investmentValues.map((n) =>
        n === "overflow" ? "計算範囲超過" : "投資口座の残高未記録",
      ),
    });
  const cashSeries: ChartSeries[] = [
    { id: "income", label: "収入", values: rows.map((r) => r.metrics.income), kind: "bar" },
    {
      id: "expenses",
      label: "消費支出",
      values: rows.map((r) => r.metrics.expenses),
      kind: "bar",
      color: "#ff94b5",
    },
    {
      id: "contribution",
      label: "投資への拠出",
      values: rows.map((r) => r.metrics.investmentContribution),
      kind: "line",
      color: "#ffc779",
    },
  ];
  const balances = row.source.records.balances.filter((b) => !account || b.accountId === account);
  return (
    <div className="history-explorer">
      <div className="analysis-heading">
        <div>
          <span className="analysis-eyebrow">HISTORY & CASH FLOW</span>
          <h3>資産の動きを、ひとつの画面で。</h3>
          <p>残高の推移と毎月の収支を切り替え、気になる月を詳しく確認。</p>
        </div>
      </div>
      <div className="analysis-tabs" role="group" aria-label="分析の表示">
        <button type="button" aria-pressed={view === "assets"} onClick={() => setView("assets")}>
          資産推移
        </button>
        <button
          type="button"
          aria-pressed={view === "cash"}
          onClick={() => {
            setView("cash");
            setAccount("");
          }}
        >
          収支・投資比較
        </button>
      </div>
      <div className="chart-controls">
        <label>
          表示する口座
          <select
            disabled={view === "cash"}
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
      <div className="analysis-summary">
        <div>
          <span>{row.source.month} · 記録した資産合計</span>
          <strong>{yen(row.metrics.assets)}</strong>
        </div>
        <div>
          <span>同じ口座の前月差</span>
          <strong>{yen(change.delta)}</strong>
          <small>
            {change.percent === null
              ? "比較可能な連続月が必要です"
              : `${change.percent > 0 ? "+" : ""}${change.percent.toLocaleString("ja-JP")}%`}
          </small>
        </div>
        <div>
          <span>この月の記録状況</span>
          <strong>
            {row.metrics.recordedAccounts} / {row.metrics.totalAccounts}
            <small>口座</small>
          </strong>
          <small>月中の確認額を含みます</small>
        </div>
      </div>
      <InteractiveLineChart
        key={`${period}-${view}-${account}`}
        title={view === "assets" ? "月別資産チャート" : "月別収支チャート"}
        labels={rows.map((r) => r.source.month)}
        selected={index}
        onSelect={setSelected}
        series={view === "assets" ? assetSeries : cashSeries}
      />
      <p className="field-hint">
        {view === "assets"
          ? "線は記録した残高の推移、面は合計、棒はそのうちNISA・課税投資の残高です。破線は未記録の月や口座構成の変更をまたぐ参考線です。中間の金額は未確定です。"
          : "収支は月全体の金額です。棒と線で金額と推移を比較できます。破線の中間は未記録です。投資への拠出は消費支出に含まず、資産の増減は運用損益ではありません。"}
      </p>
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
