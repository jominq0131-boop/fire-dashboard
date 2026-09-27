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
  const labels = Array.from({ length: years + 1 }, (_, i) => `${i}년 후`);
  return (
    <section className="projection-chart" aria-label={title}>
      <h3>{title}</h3>
      <p className="field-hint">
        같은 색은 같은 시나리오입니다. 자산과 목표의 차이를 비교하고 관심 있는 기간을 확대할 수
        있습니다.
      </p>
      <div className="forecast-outcomes">
        {items.map((item, i) => (
          <div key={item.id} style={{ borderTopColor: chartColors[i] }}>
            <span>{item.label}</span>
            <strong>{arrivalText(item.result)}</strong>
            <small>일정한 가정에 따른 최초 달성</small>
          </div>
        ))}
      </div>
      <label>
        예측 그래프 기간
        <select
          aria-label="예측 그래프 기간"
          value={years}
          onChange={(e) => {
            setYears(Number(e.target.value));
            setSelected(0);
          }}
        >
          <option value="10">10년</option>
          <option value="30">30년</option>
          <option value="100">100년</option>
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
            label: item.label + " 자산",
            color: chartColors[i],
            kind: "area",
            values: labels.map(
              (_, i) => item.result.points.find((p) => p.month === i * 12)?.assets ?? null,
            ),
          },
          {
            id: item.id + "-target",
            label: item.label + " 목표",
            dashed: true,
            color: chartColors[i],
            values: labels.map(
              (_, i) => item.result.points.find((p) => p.month === i * 12)?.target ?? null,
            ),
          },
        ])}
      />
      <p className="field-hint">
        실선은 예측 자산, 파선은 물가를 반영한 목표입니다. 가정마다 시작 자산과 목표가 다를 수
        있습니다. 계산 범위를 벗어나면 선을 연장하지 않습니다.
      </p>
    </section>
  );
}
