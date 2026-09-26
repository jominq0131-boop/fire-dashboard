import { useState } from "react";
import { projectDrawdown, type DrawdownResult, type DrawdownStart } from "../../domain/drawdown";
import type { DrawdownValues } from "../../domain/goal-plan";
import { parseYen } from "../../domain/monthly";
import { parseRate } from "../../domain/fire";
import { InteractiveLineChart } from "../charts/InteractiveLineChart";
import { chartColors } from "../charts/line-geometry";

const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;
const fields = [
  ["drawdownMonthly", "到達後の毎月の生活費（手取り・円）"],
  ["drawdownYears", "取り崩し期間（年）"],
  ["drawdownReturnBps", "到達後の株式年利（%）"],
  ["drawdownInflationBps", "到達後の生活費上昇率（年率・%）"],
] as const;
export function DrawdownPlanner({
  start,
  taxRate,
  values,
  onChange,
  dateAt,
}: {
  start: DrawdownStart;
  taxRate: number;
  values: DrawdownValues;
  onChange: (key: keyof DrawdownValues, value: string) => void;
  dateAt: (month: number) => string;
}) {
  const [result, setResult] = useState<DrawdownResult | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);
  const last = result?.points.at(-1);
  return (
    <section className="drawdown-planner" aria-labelledby="drawdown-heading">
      <p className="section-kicker">AFTER THE GOAL</p>
      <h4 id="drawdown-heading">目標のあと、生活費をまかなえる？</h4>
      <p>
        {dateAt(0)}
        の到達資産から、翌月末に生活費を引き出します。到達後の給与・積立は0円、現金の利息は0%です。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setResult(null);
          try {
            const next = projectDrawdown(start, {
              monthlySpending: parseYen(values.drawdownMonthly),
              years: parseYen(values.drawdownYears),
              returnBps: parseRate(values.drawdownReturnBps),
              inflationBps: parseRate(values.drawdownInflationBps),
              taxRate,
            });
            setResult(next);
            setSelected(0);
          } catch (e) {
            setError(e instanceof Error ? e.message : "入力を確認してください。");
          }
        }}
      >
        <div className="fire-fields">
          {fields.map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                required
                maxLength={16}
                inputMode={key.endsWith("Bps") ? "decimal" : "numeric"}
                value={values[key]}
                onChange={(e) => {
                  setResult(null);
                  setError("");
                  onChange(key, e.target.value);
                }}
              />
            </label>
          ))}
        </div>
        <p className="field-hint">
          生活費は到達時点の月額を入力。期間は1〜100年、率は年率−99〜100%です。入力は目標計画と一緒に自動保存します。
        </p>
        <button type="submit">到達後の生活費を試算する</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && last && (
        <div className="drawdown-result">
          <div className="forecast-outcomes" role="status">
            <div>
              <span>設定した仮定での結果</span>
              <strong>
                {result.status === "funded"
                  ? `${values.drawdownYears}年間の生活費を充当`
                  : result.status === "shortfall"
                    ? `${dateAt(result.stoppedMonth!)}に生活費が不足`
                    : result.status === "unknown-cost"
                      ? "取得額が不明のため計算を停止"
                      : "計算範囲を超えたため停止"}
              </strong>
              <small>
                {result.status === "funded"
                  ? "将来の資産維持を保証するものではありません"
                  : `到達から${result.stoppedMonth}か月目`}
              </small>
            </div>
            <div>
              <span>{dateAt(last.month)}の残高</span>
              <strong>{yen(last.total)}</strong>
              <small>
                支払済み生活費 {yen(last.spendingPaid)} / 推定税額 {yen(last.taxPaid)}
              </small>
            </div>
          </div>
          {result.status === "shortfall" && (
            <p>
              不足月の未充当額は {yen(result.shortfall)}
              です。その月に利用できる現金と株式の税引後売却額をすべて使った時点で停止しました。
            </p>
          )}
          {result.status === "unknown-cost" && (
            <p>
              現金では足りず課税株式を売る必要があります。上の課税口座取得額を確認し、目標到達から再計算してください。停止前に支払いを完了した月まで表示します。
            </p>
          )}
          {result.status === "overflow" && (
            <p>
              残高・生活費・累計が安全な整数範囲を超えます。停止前に支払いを完了した月まで表示します。
            </p>
          )}
          <InteractiveLineChart
            title="到達後の資産残高"
            labels={result.points.map((p) => dateAt(p.month))}
            selected={selected}
            onSelect={setSelected}
            series={(
              [
                ["cash", "現金"],
                ["nisa", "NISA"],
                ["taxable", "課税株式"],
                ["total", "総資産"],
              ] as const
            ).map(([key, label], i) => ({
              id: key,
              label,
              color: chartColors[i],
              values: result.points.map((p) => p[key]),
            }))}
          />
          <p className="field-hint">
            毎月計算し、年ごとと停止時点の残高を表示します。生活費不足と資産の目標額割れは別の状態です。
          </p>
        </div>
      )}
      <details>
        <summary>取り崩しの順序と仮定</summary>
        <p>
          月初残高に株式年利÷12を適用し1円に丸め、その月末の生活費を現金から優先して支払います。不足分はNISA・課税株式を評価額比で売り、税引後で必要額を得る売却額を求めます。課税取得額は売却割合で減らします。生活費は2か月目から年率÷12で変化し1円に丸めます。
        </p>
        <p>
          税率は上の設定を固定使用します。NISAの再投資・枠復活、収益率の変動、個別銘柄、手数料や損益通算は含みません。一定の仮定による試算であり、成功確率や退職可否の判定ではありません。目標入力を変更した場合は、目標到達から再計算してください。
        </p>
      </details>
    </section>
  );
}
