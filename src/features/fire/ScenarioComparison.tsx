import type { FireProjection } from "../../domain/fire";
import { projectFireValues, type SavedFireScenario } from "../../domain/fire-plan";
import { arrivalText } from "./fire-format";
import { ProjectionChart } from "./ProjectionChart";

const yen = (value: string | number) => `${Number(value).toLocaleString("ja-JP")} 円`;
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
        <h3 id="comparison-heading">仮定を並べて比較</h3>
        <span>{items.length} / 3 件</span>
      </div>
      <p className="field-hint">
        計算した仮定を最大3件まで追加できます。入力を変えて再計算しても、追加済みの比較は変わらず、この端末とJSONバックアップに保存されます。
      </p>
      <button type="button" disabled={!result || items.length >= 3} onClick={onAdd}>
        この結果を比較に追加
      </button>
      {!result && <p className="field-hint">追加するには、入力した仮定で計算してください。</p>}
      {items.length === 3 && (
        <p className="field-hint">3件を比較中です。新しく追加するには1件外してください。</p>
      )}
      {items.length > 0 && (
        <ProjectionChart
          title="シナリオ比較チャート"
          items={scenarios.map((item) => ({
            id: String(item.id),
            label: `シナリオ${item.id}`,
            result: item.result,
          }))}
        />
      )}
      {items.length > 0 && (
        <div
          className="history-table comparison-table"
          role="region"
          aria-label="シナリオ比較表・横にスクロールできます"
          tabIndex={0}
        >
          <table>
            <caption>仮定と結果の比較（将来の成果を保証するものではありません）</caption>
            <thead>
              <tr>
                <th scope="col">比較項目</th>
                {scenarios.map((item) => (
                  <th scope="col" key={item.id}>
                    シナリオ{item.id}
                    <br />
                    <button
                      type="button"
                      aria-label={`シナリオ${item.id}を比較から外す`}
                      onClick={() => onRemove(item.id)}
                    >
                      比較から外す
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["startingAssets", "開始資産"],
                  ["target", "目標・今日の価値"],
                  ["monthlyContribution", "月の積立額"],
                  ["returnBps", "想定年利"],
                  ["inflationBps", "インフレ率"],
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
                <th scope="row">最初の到達</th>
                {scenarios.map((item) => (
                  <td className="comparison-outcome" key={item.id}>
                    {arrivalText(item.result)}
                    {item.result.overflowMonth !== null && (
                      <small>{item.result.overflowMonth}か月目以降は計算範囲外</small>
                    )}
                  </td>
                ))}
              </tr>
              {[10, 20, 30].map((year) => (
                <tr key={year}>
                  <th scope="row">{year}年後の資産</th>
                  {scenarios.map((item) => {
                    const point = item.result.points.find((p) => p.month === year * 12);
                    return <td key={item.id}>{point ? yen(point.assets) : "計算範囲外"}</td>;
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
