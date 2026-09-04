import { useState } from "react";
import { parseRate, projectFire, type FireProjection } from "../../domain/fire";
import { parseYen } from "../../domain/monthly";
import { currentTotal, localDate } from "../../domain/observations";
import type { PortfolioRepository } from "../../domain/portfolio";

const empty = {
  startingAssets: "",
  target: "",
  monthlyContribution: "",
  returnBps: "",
  inflationBps: "",
};
const fields = [
  ["startingAssets", "開始資産（円）"],
  ["target", "目標資産・今日の価値（円）"],
  ["monthlyContribution", "毎月の積立額（円）"],
  ["returnBps", "想定年利（%）"],
  ["inflationBps", "想定インフレ率（%）"],
] as const;
const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;
export function FirePlanner({ repository }: { repository: PortfolioRepository }) {
  const [values, setValues] = useState(empty);
  const [result, setResult] = useState<FireProjection | null>(null);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  async function loadRecorded() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const today = localDate();
      const { current } = await repository.readOverview(today.slice(0, 7), undefined, today);
      const total = currentTotal(current);
      if (typeof total !== "number")
        throw new Error("利用できる残高がありません。開始資産を入力してください。");
      setValues((v) => ({ ...v, startingAssets: String(total) }));
      setSource(
        `${today} 読込：${current.balances.length}/${current.accounts.length}口座の最後の記録。確認日が異なる・古い・未記録の口座を概要で確認し、必要に応じて金額を修正してください。`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "読込に失敗しました。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="fire" className="asset-card fire-planner" aria-labelledby="fire-heading">
      <h2 id="fire-heading">FIREシミュレーション</h2>
      <p>目標まで、あとどのくらい？ ご自身の仮定で計算できます。</p>
      <p className="field-hint">
        仮定はこの画面だけで使用します。再読み込みで消え、バックアップには含まれません。記録済みの残高は変更しません。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setResult(null);
          try {
            setResult(
              projectFire({
                startingAssets: parseYen(values.startingAssets),
                target: parseYen(values.target),
                monthlyContribution: parseYen(values.monthlyContribution),
                returnBps: parseRate(values.returnBps),
                inflationBps: parseRate(values.inflationBps),
              }),
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : "入力を確認してください。");
          }
        }}
      >
        <fieldset disabled={busy}>
          <legend>計算の前提</legend>
          <button type="button" onClick={() => void loadRecorded()}>
            記録した総資産を使う
          </button>
          {source && <p className="field-hint">{source}</p>}
          <div className="fire-fields">
            {fields.map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  required
                  inputMode={key.endsWith("Bps") ? "decimal" : "numeric"}
                  maxLength={16}
                  value={values[key]}
                  onChange={(e) => {
                    setValues({ ...values, [key]: e.target.value });
                    setResult(null);
                    setError("");
                    if (key === "startingAssets") setSource("");
                  }}
                />
              </label>
            ))}
          </div>
          <button type="submit">シミュレーションする</button>
          <button
            type="button"
            onClick={() => {
              setValues(empty);
              setResult(null);
              setSource("");
              setError("");
            }}
          >
            仮定をクリア
          </button>
        </fieldset>
      </form>
      {busy && <p role="status">記録を読み込んでいます…</p>}
      {error && <p role="alert">{error}</p>}
      {result && (
        <div role="status">
          <h3>
            {result.reachedMonth === 0
              ? "開始時点で目標に到達"
              : result.reachedMonth !== null
                ? `最初の目標到達：${Math.floor(result.reachedMonth / 12)}年${result.reachedMonth % 12}か月後`
                : result.overflowMonth !== null
                  ? "計算上限のため到達時期を判定できません"
                  : "この仮定では100年以内に目標に届きません"}
          </h3>
          <p>
            開始資産 {yen(result.points[0].assets)} ／ 目標 {yen(result.points[0].target)}
          </p>
          {result.overflowMonth !== null && (
            <p>
              {result.overflowMonth}か月目で安全な整数の計算範囲を超えたため、以降は表示しません。
            </p>
          )}
          <details>
            <summary>年ごとの資産と目標を見る</summary>
            <div className="history-table">
              <table>
                <caption>積立期間の試算（将来の額面）</caption>
                <thead>
                  <tr>
                    <th>経過年</th>
                    <th>資産</th>
                    <th>物価調整後の目標</th>
                  </tr>
                </thead>
                <tbody>
                  {result.points.map((p) => (
                    <tr key={p.month}>
                      <td>{p.month / 12}</td>
                      <td>{yen(p.assets)}</td>
                      <td>{yen(p.target)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
      <details>
        <summary>計算方法と結果の読み方</summary>
        <p>
          年率は名目年率です。年率÷12で毎月複利計算し、月末に一定額を積み立てます。目標も同じ方法でインフレ率に合わせて変化します。各月の資産・目標は1円単位で四捨五入します。年率は実効年率とは異なります。
        </p>
        <p>
          最大100年、最初の到達を表示します。到達後も維持できることを意味しません。税金・手数料・負債・取り崩し・相場の変動は計算しません。入力する年利は必要に応じて費用を考慮してください。これは一定の仮定の試算であり、将来の成果や退職可能性を保証しません。
        </p>
      </details>
    </section>
  );
}
