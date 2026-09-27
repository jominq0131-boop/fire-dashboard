import { useState } from "react";
import { InteractiveLineChart, type ChartSeries } from "../charts/InteractiveLineChart";
import { monthlyMetrics, type MetricAmount } from "../../domain/metrics";
import { monthChange, type PortfolioOverview } from "../../domain/portfolio";
import { observationStatus, localDate } from "../../domain/observations";
const yen = (n: MetricAmount) =>
  typeof n === "number"
    ? `${n.toLocaleString("ko-KR")} 엔`
    : n === "overflow"
      ? "계산 범위 초과"
      : "미입력";
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
      label: chosen?.name ?? "기록한 자산 합계",
      values,
      kind: "area",
      connect: rows.map((r, i) =>
        account ? true : monthChange(months[i - 1], r.source).delta !== null,
      ),
      hollow: rows.map((r) => !account && r.metrics.recordedAccounts !== r.metrics.totalAccounts),
      missing: rows.map((r) =>
        r.metrics.assets === "overflow" ? "계산 범위 초과" : "잔액 미기록",
      ),
    },
  ];
  if (!account && hasInvestments)
    assetSeries.push({
      id: "investments",
      label: "그중 NISA·과세 투자",
      kind: "bar",
      connect: investmentSources.map(
        (source, i) => monthChange(investmentSources[i - 1], source).delta !== null,
      ),
      values: investmentValues.map((n) => (typeof n === "number" ? n : null)),
      missing: investmentValues.map((n) =>
        n === "overflow" ? "계산 범위 초과" : "투자 계좌 잔액 미기록",
      ),
    });
  const cashSeries: ChartSeries[] = [
    { id: "income", label: "수입", values: rows.map((r) => r.metrics.income), kind: "bar" },
    {
      id: "expenses",
      label: "소비 지출",
      values: rows.map((r) => r.metrics.expenses),
      kind: "bar",
      color: "#ff94b5",
    },
    {
      id: "contribution",
      label: "투자 납입",
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
          <span className="analysis-eyebrow">자산 기록과 현금흐름</span>
          <h3>자산의 흐름을 한 화면에서.</h3>
          <p>잔액 변화와 월별 수입·지출을 전환하며 관심 있는 월을 자세히 확인하세요.</p>
        </div>
      </div>
      <div className="analysis-tabs" role="group" aria-label="분석 보기">
        <button type="button" aria-pressed={view === "assets"} onClick={() => setView("assets")}>
          자산 변화
        </button>
        <button
          type="button"
          aria-pressed={view === "cash"}
          onClick={() => {
            setView("cash");
            setAccount("");
          }}
        >
          수입·지출·투자 비교
        </button>
      </div>
      <div className="chart-controls">
        <label>
          표시할 계좌
          <select
            disabled={view === "cash"}
            aria-label="표시할 계좌"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">모든 계좌</option>
            {data.current.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          표시 기간
          <select
            aria-label="표시 기간"
            value={period}
            onChange={(e) => {
              setPeriod(Number(e.target.value));
              setSelected(Number(e.target.value) - 1);
            }}
          >
            <option value="6">6개월</option>
            <option value="12">12개월</option>
          </select>
        </label>
      </div>
      <div className="analysis-summary">
        <div>
          <span>{row.source.month} · 기록한 자산 합계</span>
          <strong>{yen(row.metrics.assets)}</strong>
        </div>
        <div>
          <span>같은 계좌의 전월 차이</span>
          <strong>{yen(change.delta)}</strong>
          <small>
            {change.percent === null
              ? "비교 가능한 연속 월이 필요합니다"
              : `${change.percent > 0 ? "+" : ""}${change.percent.toLocaleString("ko-KR")}%`}
          </small>
        </div>
        <div>
          <span>이달 기록 상태</span>
          <strong>
            {row.metrics.recordedAccounts} / {row.metrics.totalAccounts}
            <small>계좌</small>
          </strong>
          <small>월중 확인액 포함</small>
        </div>
      </div>
      <InteractiveLineChart
        key={`${period}-${view}-${account}`}
        title={view === "assets" ? "월별 자산 차트" : "월별 수입·지출 차트"}
        labels={rows.map((r) => r.source.month)}
        selected={index}
        onSelect={setSelected}
        series={view === "assets" ? assetSeries : cashSeries}
      />
      <p className="field-hint">
        {view === "assets"
          ? "선은 기록한 잔액 변화, 면은 합계, 막대는 그중 NISA·과세 투자 잔액입니다. 파선은 미기록 월이나 계좌 구성 변경을 가로지르는 참고선입니다. 중간 금액은 확정되지 않았습니다."
          : "수입·지출은 월 전체 금액입니다. 막대와 선으로 금액과 변화를 비교할 수 있습니다. 파선의 중간은 미기록 상태입니다. 투자 납입은 소비 지출에 포함하지 않으며 자산 증감은 운용손익이 아닙니다."}
      </p>
      <section className="month-inspector" aria-label="선택 월 상세">
        <h3>{row.source.month} 기록 확인</h3>
        <p>
          {account ? "선택 계좌의 확인 잔액" : "기록한 자산 합계"}：
          {yen(account ? values[index] : row.metrics.assets)}
        </p>
        <p className="field-hint">
          입력 {row.metrics.recordedAccounts}/{row.metrics.totalAccounts}개 계좌. 월중 확인을 포함한
          기록액이며 미기록 계좌는 제외합니다.
        </p>
        <p>
          {account ? "전체 계좌 합계의 전월 차이" : "전월 기록과의 차이"}：{yen(change.delta)}
          {change.delta === null ? "(같은 계좌의 연속 월이 필요합니다)" : ""}
        </p>
        <dl className="metrics-list">
          <div>
            <dt>월 전체 수입</dt>
            <dd>{yen(row.metrics.income)}</dd>
          </div>
          <div>
            <dt>월 전체 소비 지출</dt>
            <dd>{yen(row.metrics.expenses)}</dd>
          </div>
          <div>
            <dt>월 전체 투자 납입</dt>
            <dd>{yen(row.metrics.investmentContribution)}</dd>
          </div>
        </dl>
        <details>
          <summary>이달 계좌별 내역({balances.length}개)</summary>
          <ul className="chart-breakdown">
            {balances.map((b) => (
              <li key={b.id}>
                <strong>{row.source.accounts.find((a) => a.id === b.accountId)?.name}</strong>
                <span>{yen(b.balance)}</span>
                <small>{observationStatus(b, localDate())}</small>
              </li>
            ))}
          </ul>
          {!balances.length && <p>이달 잔액은 기록하지 않았습니다.</p>}
        </details>
        <div className="chart-controls">
          <button type="button" onClick={() => onSelectMonth(row.source.month)}>
            선택 월 입력·편집으로
          </button>
          <button
            type="button"
            disabled={values[index] === null}
            onClick={() => {
              const value = values[index];
              if (value !== null)
                onForecast(
                  value,
                  `${row.source.month} · ${chosen?.name ?? "기록한 자산 합계"}（${row.metrics.recordedAccounts}/${row.metrics.totalAccounts}개 계좌, 현재 평가액이 아닙니다)`,
                );
            }}
          >
            이 기록액으로 FIRE 계산
          </button>
        </div>
      </section>
    </div>
  );
}
