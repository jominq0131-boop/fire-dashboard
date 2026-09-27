import type { FireProjection } from "../../domain/fire";
import { projectFireValues, type SavedFireScenario } from "../../domain/fire-plan";
import { arrivalText } from "./fire-format";
import { ProjectionChart } from "./ProjectionChart";

const yen = (value: string | number) => `${Number(value).toLocaleString("ko-KR")} 엔`;
export function ScenarioComparison({
  result,
  items,
  onAdd,
  onRemove,
}: {
  result: FireProjection | null;
  items: SavedFireScenario[];
  onAdd: () => void;
  onRemove: (id: number) => void;
}) {
  const scenarios = items.map((item) => ({ ...item, result: projectFireValues(item.values) }));
  return (
    <section className="scenario-comparison" aria-labelledby="comparison-heading">
      <div className="section-heading">
        <h3 id="comparison-heading">가정 나란히 비교</h3>
        <span>{items.length} / 3개</span>
      </div>
      <p className="field-hint">
        계산한 가정을 최대 3개까지 추가할 수 있습니다. 입력을 바꿔 다시 계산해도 추가한 비교는
        그대로이며 이 기기와 JSON 백업에 저장됩니다.
      </p>
      <button type="button" disabled={!result || items.length >= 3} onClick={onAdd}>
        이 결과를 비교에 추가
      </button>
      {!result && <p className="field-hint">추가하려면 입력한 가정으로 계산해 주세요.</p>}
      {items.length === 3 && (
        <p className="field-hint">3개를 비교 중입니다. 새로 추가하려면 1개를 제외해 주세요.</p>
      )}
      {items.length > 0 && (
        <ProjectionChart
          title="시나리오 비교 차트"
          items={scenarios.map((item) => ({
            id: String(item.id),
            label: `시나리오${item.id}`,
            result: item.result,
          }))}
        />
      )}
      {items.length > 0 && (
        <div
          className="history-table comparison-table"
          role="region"
          aria-label="시나리오 비교표·가로로 스크롤할 수 있습니다"
          tabIndex={0}
        >
          <table>
            <caption>가정과 결과 비교(미래 성과를 보장하지 않습니다)</caption>
            <thead>
              <tr>
                <th scope="col">비교 항목</th>
                {scenarios.map((item) => (
                  <th scope="col" key={item.id}>
                    시나리오{item.id}
                    <br />
                    <button
                      type="button"
                      aria-label={`시나리오${item.id} 비교에서 제외`}
                      onClick={() => onRemove(item.id)}
                    >
                      비교에서 제외
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["startingAssets", "시작 자산"],
                  ["target", "목표·현재 가치"],
                  ["monthlyContribution", "월 적립액"],
                  ["returnBps", "가정 연 수익률"],
                  ["inflationBps", "물가상승률"],
                ] as const
              ).map(([key, label]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  {scenarios.map((item) => (
                    <td key={item.id}>
                      {key.endsWith("Bps") ? `${item.values[key]} %` : yen(item.values[key])}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">최초 달성</th>
                {scenarios.map((item) => (
                  <td className="comparison-outcome" key={item.id}>
                    {arrivalText(item.result)}
                    {item.result.overflowMonth !== null && (
                      <small>{item.result.overflowMonth}개월째부터 계산 범위 초과</small>
                    )}
                  </td>
                ))}
              </tr>
              {[10, 20, 30].map((year) => (
                <tr key={year}>
                  <th scope="row">{year}년 후 자산</th>
                  {scenarios.map((item) => {
                    const point = item.result.points.find((p) => p.month === year * 12);
                    return <td key={item.id}>{point ? yen(point.assets) : "계산 범위 초과"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
