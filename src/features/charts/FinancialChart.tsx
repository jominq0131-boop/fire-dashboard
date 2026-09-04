import { Fragment, useId, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartColors, seriesSegments } from "./line-geometry";

export interface ChartSeries {
  id: string;
  label: string;
  values: (number | null)[];
  connect?: boolean[];
  hollow?: boolean[];
  dashed?: boolean;
  kind?: "area" | "bar" | "line";
  color?: string;
  missing?: string[];
}
const compact = (n: number) =>
  Intl.NumberFormat("ja-JP", { notation: "compact", maximumFractionDigits: 1 }).format(n);
export default function FinancialChart({
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
  const uid = useId().replace(/:/g, "");
  const [hidden, setHidden] = useState<string[]>([]);
  const [window, setWindow] = useState<[number, number]>([0, labels.length - 1]);
  const start = Math.min(window[0], labels.length - 1),
    end = Math.min(window[1], labels.length - 1);
  const index = Math.max(start, Math.min(selected, end));
  const enabled = series.filter((s) => !hidden.includes(s.id));
  const visible = enabled.length ? enabled : series.slice(0, 1);
  const color = (s: ChartSeries) => s.color ?? chartColors[series.indexOf(s) % chartColors.length];
  const data = labels.slice(start, end + 1).map((label, i) => ({ label, index: start + i }));
  const hasValues = visible.some((s) => s.values.slice(start, end + 1).some((n) => n !== null));
  const amount = (s: ChartSeries, i: number) =>
    s.values[i] == null
      ? (s.missing?.[i] ?? "記録なし・計算範囲外")
      : `${s.values[i]!.toLocaleString("ja-JP")} 円`;
  function inspect(i: number, tooltip = false) {
    return (
      <div className={tooltip ? "financial-tooltip" : "chart-inspector"}>
        <strong>{labels[i]}</strong>
        <dl>
          {visible.map((s) => (
            <div key={s.id}>
              <dt>
                <span className="series-swatch" style={{ background: color(s) }} />
                {s.label}
              </dt>
              <dd>{amount(s, i)}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }
  function choose(state: { activeTooltipIndex?: string | number | null }) {
    const local = Number(state.activeTooltipIndex);
    if (state.activeTooltipIndex != null && Number.isInteger(local) && data[local])
      onSelect(data[local].index);
  }
  return (
    <div className="interactive-chart" aria-label={title}>
      <div className="chart-heading">
        <div>
          <span className="chart-eyebrow">ASSET INTELLIGENCE</span>
          <h4>{title}</h4>
        </div>
        <span className="chart-unit">JPY · 円</span>
      </div>
      <div className="chart-legend" aria-label={`${title}の表示項目`}>
        {series.map((s) => (
          <button
            type="button"
            key={s.id}
            aria-pressed={visible.includes(s)}
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
            <span aria-hidden="true" style={{ background: color(s) }} />
            {s.label}
            {s.dashed ? "（破線）" : ""}
          </button>
        ))}
      </div>
      <p className="chart-help">ポインターで確認 · タップで選択 · 下のスライダーでキーボード操作</p>
      <div className="financial-plot" role="img" aria-label={title}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={data}
            barGap={2}
            barCategoryGap="15%"
            margin={{ top: 24, right: 16, bottom: 12, left: 0 }}
            onMouseMove={choose}
            onClick={choose}
            accessibilityLayer
          >
            <defs>
              {series.map((s, i) => (
                <linearGradient id={`${uid}-fill-${i}`} key={s.id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color(s)} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color(s)} stopOpacity={0.015} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="#2a3b4c" strokeDasharray="3 5" />
            <XAxis
              dataKey="index"
              tickFormatter={(i) => labels[i]}
              tick={{ fill: "#aebfd0", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              padding={{ left: 12, right: 12 }}
            />
            <YAxis
              width={62}
              domain={[0, "auto"]}
              tickFormatter={compact}
              tick={{ fill: "#aebfd0", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ stroke: "#c4d0e2", strokeDasharray: "4 4" }}
              isAnimationActive={false}
              wrapperStyle={{ outline: "none", zIndex: 4, maxWidth: "min(290px, 85%)" }}
              content={({ active, label }) =>
                active && typeof label === "number" ? inspect(label, true) : null
              }
            />
            {visible.map((s) =>
              s.kind === "bar" ? (
                <Bar
                  key={s.id}
                  dataKey={(d: { index: number }) => s.values[d.index]}
                  name={s.label}
                  fill={color(s)}
                  fillOpacity={0.7}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={38}
                  isAnimationActive={false}
                />
              ) : (
                seriesSegments(s.values, s.connect).map(([from, to], segment) => {
                  const key = (d: { index: number }) =>
                    d.index >= from && d.index <= to ? s.values[d.index] : null;
                  return (
                    <Fragment key={`${s.id}-${segment}`}>
                      {s.kind === "area" && (
                        <Area
                          dataKey={key}
                          baseValue={0}
                          type="linear"
                          stroke="none"
                          fill={`url(#${uid}-fill-${series.indexOf(s)})`}
                          connectNulls={false}
                          isAnimationActive={false}
                          tooltipType="none"
                        />
                      )}
                      <Line
                        dataKey={key}
                        name={s.label}
                        type="linear"
                        connectNulls={false}
                        stroke={color(s)}
                        strokeWidth={s.dashed ? 1.8 : 2.6}
                        strokeDasharray={s.dashed ? "6 5" : undefined}
                        isAnimationActive={false}
                        activeDot={false}
                        dot={(props) => {
                          const { cx, cy, payload, value } = props;
                          if (value == null || cx == null || cy == null)
                            return <g key={payload.index} />;
                          const k = payload.index;
                          return (
                            <circle
                              key={k}
                              cx={cx}
                              cy={cy}
                              r={k === index ? 5 : labels.length > 15 && from !== to ? 0 : 3}
                              fill={s.hollow?.[k] ? "#101c2b" : color(s)}
                              stroke={color(s)}
                              strokeWidth={2}
                            />
                          );
                        }}
                      />
                    </Fragment>
                  );
                })
              ),
            )}
            <ReferenceLine x={index} stroke="#aebfd0" strokeDasharray="3 5" />
          </ComposedChart>
        </ResponsiveContainer>
        {!hasValues && (
          <div className="chart-empty">
            表示できる記録はありません。<small>記録した月から推移を確認できます。</small>
          </div>
        )}
      </div>
      <div className="chart-range" aria-label={`${title}の拡大範囲`}>
        <label>
          開始
          <select
            aria-label={`${title}の拡大開始`}
            value={start}
            onChange={(e) => {
              const n = Number(e.target.value);
              setWindow([n, end]);
              onSelect(Math.max(n, index));
            }}
          >
            {labels.map(
              (l, i) =>
                i <= end && (
                  <option key={l} value={i}>
                    {l}
                  </option>
                ),
            )}
          </select>
        </label>
        <label>
          終了
          <select
            aria-label={`${title}の拡大終了`}
            value={end}
            onChange={(e) => {
              const n = Number(e.target.value);
              setWindow([start, n]);
              onSelect(Math.min(n, index));
            }}
          >
            {labels.map(
              (l, i) =>
                i >= start && (
                  <option key={l} value={i}>
                    {l}
                  </option>
                ),
            )}
          </select>
        </label>
        <button
          type="button"
          disabled={start === 0 && end === labels.length - 1}
          onClick={() => setWindow([0, labels.length - 1])}
        >
          全期間に戻す
        </button>
      </div>
      <label className="chart-slider">
        {title}の選択位置
        <input
          type="range"
          min={start}
          max={end}
          value={index}
          aria-valuetext={labels[index]}
          onChange={(e) => onSelect(Number(e.target.value))}
        />
      </label>
      {inspect(index)}
    </div>
  );
}
