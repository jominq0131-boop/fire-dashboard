import { useState } from "react";
import type { FireProjection } from "../../domain/fire";
import { InteractiveLineChart } from "../charts/InteractiveLineChart";
import { chartColors } from "../charts/line-geometry";
import { arrivalText } from "./fire-format";
export function ProjectionChart({
  items,
  title,
}: {
  items: { id: string; label: string; result: FireProjection }[];
  title: string;
}) {
  const [years, setYears] = useState(30),
    [selected, setSelected] = useState(0);
  const labels = Array.from({ length: years + 1 }, (_, i) => `${i}年後`);
  return (
    <section className="projection-chart" aria-label={title}>
      <h3>{title}</h3>
      <p className="field-hint">
        同じ色がひとつのシナリオです。資産と目標の距離を比較し、気になる期間を拡大できます。
      </p>
      <div className="forecast-outcomes">
        {items.map((item, i) => (
          <div key={item.id} style={{ borderTopColor: chartColors[i] }}>
            <span>{item.label}</span>
            <strong>{arrivalText(item.result)}</strong>
            <small>一定の仮定による最初の到達</small>
          </div>
        ))}
      </div>
      <label>
        予測グラフの期間
        <select
          aria-label="予測グラフの期間"
          value={years}
          onChange={(e) => {
            setYears(Number(e.target.value));
            setSelected(0);
          }}
        >
          <option value="10">10年</option>
          <option value="30">30年</option>
          <option value="100">100年</option>
        </select>
      </label>
      <InteractiveLineChart
        key={years}
        title={title}
        labels={labels}
        selected={selected}
        onSelect={setSelected}
        series={items.flatMap((item, i) => [
          {
            id: item.id + "-assets",
            label: item.label + " 資産",
            color: chartColors[i],
            kind: "area",
            values: labels.map(
              (_, i) => item.result.points.find((p) => p.month === i * 12)?.assets ?? null,
            ),
          },
          {
            id: item.id + "-target",
            label: item.label + " 目標",
            dashed: true,
            color: chartColors[i],
            values: labels.map(
              (_, i) => item.result.points.find((p) => p.month === i * 12)?.target ?? null,
            ),
          },
        ])}
      />
      <p className="field-hint">
        実線は予測資産、破線は物価調整した目標です。仮定ごとに開始資産や目標が異なる場合があります。計算範囲外は線を延長しません。
      </p>
    </section>
  );
}
