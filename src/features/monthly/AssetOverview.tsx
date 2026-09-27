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
    ? "미입력"
    : value === "overflow"
      ? "계산 범위 초과"
      : `${value.toLocaleString("ko-KR")} 엔`;
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
          setError(e instanceof Error ? e.message : "자산을 불러올 수 없습니다.");
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
    <section className="asset-history" aria-label="전체 자산 현황" aria-busy={busy}>
      <article className="asset-card">
        <div className="section-heading">
          <h2>총 금융자산</h2>
          <button type="button" onClick={() => onRecordToday()}>
            오늘 잔액 기록
          </button>
          <button
            type="button"
            onClick={() => {
              setBusy(true);
              setRefresh((n) => n + 1);
            }}
          >
            자산 다시 불러오기
          </button>
        </div>
        {error ? (
          <p className="error-message">{error}</p>
        ) : busy ? (
          <p>자산을 불러오는 중…</p>
        ) : (
          <>
            <p>계좌별 마지막 확인 잔액 · {localDate()} 기준 기록</p>
            <div className="asset-value">
              <strong
                aria-label={!current?.balances.length ? "총 금융자산: 데이터 없음" : undefined}
              >
                {current?.balances.length ? yen(total) : "—"}
              </strong>
            </div>
            {current && (
              <p>
                잔액 입력 {current.balances.length} / {current.accounts.length}개 계좌(사용 중지
                포함)
              </p>
            )}
            <p className="field-hint">
              계좌별 마지막 기록을 합산합니다. 확인일은 계좌마다 다르며 현재 평가액을 보장하지
              않습니다. 미기록 계좌는 합계에서 제외합니다.
            </p>
            {current && (
              <details className="freshness-list" open>
                <summary>계좌별 확인 상태</summary>
                {current.accounts.length === 0 ? (
                  <p>계좌를 등록하면 오늘 잔액부터 기록할 수 있습니다.</p>
                ) : (
                  current.accounts.map((a) => {
                    const b = current.balances.find((b) => b.accountId === a.id);
                    return (
                      <div key={a.id}>
                        <strong>
                          {a.name}
                          {!a.isActive ? "(사용 중지)" : ""}
                        </strong>
                        <span>{yen(b?.balance ?? null)}</span>
                        <small>{observationStatus(b, localDate())}</small>
                        <button
                          type="button"
                          aria-label={`${a.name} 갱신`}
                          onClick={() => onRecordToday(a.id)}
                        >
                          갱신
                        </button>
                      </div>
                    );
                  })
                )}
              </details>
            )}
            {latest && (
              <button type="button" onClick={() => onSelectMonth(latest.month)}>
                이달 상세 보기
              </button>
            )}
          </>
        )}
      </article>
      <article className="asset-card trend-card">
        <div className="section-heading">
          <h2>자산 변화</h2>
          <label>
            그래프 종료 월
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
          위 합계는 계좌별 마지막 확인 잔액이며 그래프는 각 월에 기록한 금액입니다. 최대 12개월을
          표시합니다. 기록한 점을 선으로 연결하고, 미기록 월이나 계좌 구성 변경을 가로지르는 구간은
          파선으로 표시합니다. 일부 계좌만 기록한 월은 빈 원입니다. 월중 확인액은 월말 평가액이
          아닙니다. 같은 계좌의 연속 월에만 기록액 차이를 표시하며 운용수익과 구별합니다.
        </p>
        {!error && !busy && (
          <>
            {data && (
              <HistoryExplorer data={data} onSelectMonth={onSelectMonth} onForecast={onForecast} />
            )}
            <div
              className="history-table"
              role="region"
              aria-label="월별 기록표·가로로 스크롤할 수 있습니다"
              tabIndex={0}
            >
              <table>
                <caption>월별 기록액과 비교</caption>
                <thead>
                  <tr>
                    <th>월</th>
                    <th>잔액 합계</th>
                    <th>계좌 수</th>
                    <th>기록액 차이</th>
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
                            ? "확인일이 있는 기록"
                            : "월말 입력·확인일 미기록"}
                        </small>
                      </td>
                      <td>
                        {r.metrics.recordedAccounts}/{r.metrics.totalAccounts}
                      </td>
                      <td>
                        {r.change.delta === null
                          ? "비교 불가"
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
