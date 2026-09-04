import { useState } from "react";
import { linePaths } from "./line-geometry";
export interface ChartSeries {
  id: string;
  label: string;
  values: (number | null)[];
  connect?: boolean[];
  hollow?: boolean[];
  dashed?: boolean;
}
const colors = ["#2168ce", "#9556b8", "#15816b", "#b77518", "#b74c65", "#566679"];
export function InteractiveLineChart({
  title,
  labels,
  series,
  selected,
  onSelect,
}: {
  title: string;
  labels: string[];
  series: ChartSeries[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  const enabled = series.filter((s) => !hidden.includes(s.id));
  const visible = enabled.length ? enabled : series.slice(0, 1);
  const isHidden = (id: string) => !visible.some((s) => s.id === id);
  const max = Math.max(
    0,
    ...visible.flatMap((s) => s.values.filter((n): n is number => n !== null)),
  );
  const index = Math.max(0, Math.min(selected, labels.length - 1));
  const x = (i: number) => 64 + (i * 640) / Math.max(1, labels.length - 1);
  const y = (value: number) => 220 - (value / (max || 1)) * 180;
  return (
    <div className="interactive-chart" aria-label={title}>
      <div className="chart-legend" aria-label={`${title}の表示項目`}>
        {series.map((s, i) => (
          <button
            type="button"
            key={s.id}
            aria-pressed={!isHidden(s.id)}
            onClick={() =>
              setHidden((previous) =>
                previous.includes(s.id)
                  ? previous.filter((id) => id !== s.id)
                  : visible.length > 1
                    ? [...previous, s.id]
                    : previous,
              )
            }
          >
            <span aria-hidden="true" style={{ background: colors[i % colors.length] }} />
            {s.label}
            {s.dashed ? "（破線）" : ""}
          </button>
        ))}
      </div>
      <p className="field-hint">
        グラフに触れると値を表示します。下のスライダーは矢印キーでも選択できます。
      </p>
      <svg
        viewBox="0 0 736 270"
        role="img"
        aria-label={title}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") {
            const r = e.currentTarget.getBoundingClientRect();
            onSelect(
              Math.max(
                0,
                Math.min(
                  labels.length - 1,
                  Math.round(
                    ((((e.clientX - r.left) / r.width) * 736 - 64) / 640) * (labels.length - 1),
                  ),
                ),
              ),
            );
          }
        }}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onSelect(
            Math.max(
              0,
              Math.min(
                labels.length - 1,
                Math.round(
                  ((((e.clientX - r.left) / r.width) * 736 - 64) / 640) * (labels.length - 1),
                ),
              ),
            ),
          );
        }}
      >
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line x1="64" x2="704" y1={y(max * ratio)} y2={y(max * ratio)} stroke="#dfe5ed" />
            <text x="60" y={y(max * ratio) - 7} textAnchor="end" fontSize="12">
              {Intl.NumberFormat("ja-JP", { notation: "compact", maximumFractionDigits: 1 }).format(
                max * ratio,
              )}
            </text>
          </g>
        ))}
        {!visible.some((s) => s.values.some((n) => n !== null)) && (
          <text x="384" y="130" textAnchor="middle" fontSize="14">
            残高の記録はありません
          </text>
        )}
        <text x="64" y="20" fontSize="12">
          円
        </text>
        {series.map((s, i) =>
          isHidden(s.id) ? null : (
            <g key={s.id} data-series={s.id}>
              {linePaths(s.values, max, s.connect).map((d, k) => (
                <path
                  key={k}
                  d={d}
                  fill="none"
                  stroke={colors[i % colors.length]}
                  strokeWidth="3"
                  strokeDasharray={s.dashed ? "7 5" : undefined}
                />
              ))}
              {s.values.map((value, k) =>
                value === null ? null : (
                  <circle
                    key={k}
                    cx={x(k)}
                    cy={y(value)}
                    r={k === index ? 6 : 3.5}
                    stroke={colors[i % colors.length]}
                    strokeWidth="2"
                    fill={s.hollow?.[k] ? "white" : colors[i % colors.length]}
                  >
                    <title>
                      {labels[k]} · {s.label}: {value.toLocaleString("ja-JP")} 円
                    </title>
                  </circle>
                ),
              )}
            </g>
          ),
        )}
        <line x1={x(index)} x2={x(index)} y1="32" y2="220" stroke="#707d8f" strokeDasharray="4 4" />
        <text x="64" y="252" fontSize="12">
          {labels[0]}
        </text>
        <text x="704" y="252" textAnchor="end" fontSize="12">
          {labels.at(-1)}
        </text>
      </svg>
      {!visible.some((s) => s.values.some((n) => n !== null)) && (
        <p>表示できる記録はありません。</p>
      )}
      <label className="chart-slider">
        {title}の選択位置
        <input
          type="range"
          min="0"
          max={Math.max(0, labels.length - 1)}
          value={index}
          aria-valuetext={labels[index]}
          onChange={(e) => onSelect(Number(e.target.value))}
        />
      </label>
      <div className="chart-inspector" aria-live="polite">
        <strong>{labels[index]}</strong>
        <dl>
          {visible.map((s) => (
            <div key={s.id}>
              <dt>{s.label}</dt>
              <dd>
                {s.values[index] === null || s.values[index] === undefined
                  ? "記録なし・計算範囲外"
                  : `${s.values[index]!.toLocaleString("ja-JP")} 円`}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
