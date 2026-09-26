import {
  initialGoalValues,
  type GoalValues as Values,
  type GoalPlan,
  type GoalPlanRepository,
} from "../../domain/goal-plan";
import { useEffect, useRef, useState } from "react";
import {
  goalSeed,
  projectGoal,
  type GoalAssumptions,
  type GoalResult,
} from "../../domain/goal-fire";
import { localDate } from "../../domain/observations";
import { parseYen } from "../../domain/monthly";
import { parseRate } from "../../domain/fire";
import { parseTaxRate } from "../../domain/withdrawal";
import type { PortfolioRepository } from "../../domain/portfolio";
import { InteractiveLineChart } from "../charts/InteractiveLineChart";
import { chartColors } from "../charts/line-geometry";
import { DrawdownPlanner } from "./DrawdownPlanner";

const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;
const assetFields = [
  ["cash", "現金・預金"],
  ["tsumitate", "NISA・つみたて"],
  ["growth", "NISA・成長"],
  ["taxable", "特定・一般口座の株式"],
] as const;
const fields = [
  ...assetFields,
  ["monthlyCash", "毎月の現金貯蓄（マイナス可）"],
  ["monthlyInvestment", "毎月の株式・投信積立"],
  ["target", "目標金額（額面）"],
  ["returnBps", "株式の想定年利（%）"],
  ["withdrawalBps", "到達時の年間取り崩し率（%）"],
] as const;
const nisaFields = [
  ["usedTotal", "新NISAの保有取得額・合計"],
  ["usedGrowth", "うち成長投資枠の保有取得額"],
  ["usedYearTsumitate", "今年のつみたて枠・買付済額"],
  ["usedYearGrowth", "今年の成長枠・買付済額"],
] as const;
function elapsed(month: number) {
  return `${Math.floor(month / 12)}年${month % 12}か月`;
}
function dateAt(start: string, months: number) {
  const index = Number(start.slice(0, 4)) * 12 + Number(start.slice(5)) - 1 + months;
  return `${Math.floor(index / 12)}年${(index % 12) + 1}月`;
}
export function GoalPlanner({
  repository,
  goalPlanRepository,
  revision = 0,
}: {
  repository: PortfolioRepository;
  goalPlanRepository: GoalPlanRepository;
  revision?: number;
}) {
  const [values, setValues] = useState(initialGoalValues);
  const [result, setResult] = useState<GoalResult | null>(null);
  const [calculated, setCalculated] = useState<GoalAssumptions | null>(null);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const [referenceMonth, setReferenceMonth] = useState(() => localDate().slice(0, 7));
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("目標計画を読み込んでいます…");
  const [saveError, setSaveError] = useState("");
  const baseline = useRef<GoalPlan | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const sequence = useRef(0);
  const changed = useRef(false);
  useEffect(() => {
    let cancelled = false;
    ++sequence.current;
    setReady(false);
    setSaveStatus("目標計画を読み込んでいます…");
    void queue.current
      .then(() => goalPlanRepository.load())
      .then((plan) => {
        if (cancelled) return;
        baseline.current = plan;
        changed.current = false;
        setValues(plan?.draft ?? initialGoalValues());
        setReferenceMonth(plan?.referenceMonth ?? localDate().slice(0, 7));
        setResult(null);
        setCalculated(null);
        setSource("");
        setError("");
        setSaveError("");
        setSaveStatus(plan ? "目標計画をこの端末に保存済みです" : "");
        setReady(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSaveStatus("");
        setSaveError(e instanceof Error ? e.message : "目標計画を読み込めません。");
      });
    return () => {
      cancelled = true;
    };
  }, [goalPlanRepository, revision]);
  useEffect(() => {
    if (!ready || !changed.current) return;
    const request = ++sequence.current;
    const draft = { ...values };
    setSaveStatus("目標計画を保存しています…");
    setSaveError("");
    queue.current = queue.current
      .then(async () => {
        if (request !== sequence.current) return;
        const saved = await goalPlanRepository.save(
          {
            id: "primary",
            draft,
            referenceMonth,
            updatedAt: new Date(
              Math.max(Date.now(), Date.parse(baseline.current?.updatedAt ?? "") || 0),
            ).toISOString(),
          },
          baseline.current,
        );
        baseline.current = saved;
        if (request === sequence.current) setSaveStatus("目標計画をこの端末に保存しました");
      })
      .catch((e: unknown) => {
        if (request !== sequence.current) return;
        setSaveStatus("");
        setSaveError(
          e instanceof Error ? e.message : "目標計画を保存できません。入力は残しています。",
        );
      });
  }, [values, referenceMonth, ready, goalPlanRepository]);
  async function load() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const today = localDate();
      const overview = await repository.readOverview(today.slice(0, 7), undefined, today);
      const seed = goalSeed(overview, today.slice(0, 7));
      changed.current = true;
      setValues((v) => ({
        ...v,
        cash: String(seed.cash),
        tsumitate: String(seed.tsumitate),
        growth: String(seed.growth),
        taxable: String(seed.taxable),
        taxableCost: "",
        monthlyCash: seed.monthlyCash === null ? "" : String(seed.monthlyCash),
        monthlyInvestment: seed.monthlyInvestment === null ? "" : String(seed.monthlyInvestment),
      }));
      setSource(
        `${today} 読込。残高は各口座の最後の記録で、確認日は異なる場合があります。未記録 ${seed.missing}口座。その他資産 ${yen(seed.other)} は分類できないため除外しています。必要なら現金・株式欄へ手動で振り分けてください。${seed.months.length ? `完了月 ${seed.months.join("・")} の${seed.months.length}件平均を使用（欠損月と今月は除外）。` : "完了月の収支がないため、毎月の貯蓄と積立を入力してください。"}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "記録を読み込めません。");
    } finally {
      setBusy(false);
    }
  }
  function input(key: keyof Values, label: string) {
    return (
      <label key={key}>
        {label}
        {!key.endsWith("Bps") && key !== "taxRate" && "（円）"}
        <input
          required={key !== "taxableCost"}
          maxLength={16}
          inputMode={
            key.endsWith("Bps") || key === "taxRate" || key === "monthlyCash"
              ? "decimal"
              : "numeric"
          }
          value={values[key]}
          onChange={(e) => {
            changed.current = true;
            setValues({ ...values, [key]: e.target.value });
            setResult(null);
            setError("");
          }}
        />
      </label>
    );
  }
  return (
    <section className="goal-planner" aria-labelledby="goal-heading">
      <p className="section-kicker">MY GOAL / NISA FIRST</p>
      <h3 id="goal-heading">今のペースで、目標に届くのはいつ？</h3>
      <p>現金と株式を分け、毎月の貯蓄から目標への道のりを描きます。</p>
      <p className="field-hint">
        入力はこの端末に自動保存し、JSONバックアップに含めます。復元後は入力を確認して再計算してください。計算結果は保存しません。保存完了の表示を確認してから再読み込み・バックアップしてください。
      </p>
      <p className="fire-save-state" aria-live="polite">
        {saveStatus}
      </p>
      {saveError && <p role="alert">{saveError}</p>}
      {ready && (
        <p className="field-hint">
          入力の確認月: {referenceMonth}。現在の残高とNISAの今年の買付額を確認してください。
        </p>
      )}
      {ready && referenceMonth !== localDate().slice(0, 7) && (
        <p role="alert">
          以前の月の入力です。年が変わった場合は今年のNISA買付額を確認・修正してください。
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setResult(null);
          setError("");
          try {
            const parsed = Object.fromEntries(
              Object.entries(values)
                .filter(([k]) => !k.startsWith("drawdown"))
                .map(([k, v]) => [
                  k,
                  k === "taxRate"
                    ? parseTaxRate(v)
                    : k === "taxableCost" && v === ""
                      ? null
                      : k.endsWith("Bps")
                        ? parseRate(v)
                        : k === "monthlyCash" && /^-\d+$/.test(v)
                          ? -parseYen(v.slice(1))
                          : parseYen(v),
                ]),
            );
            const s = { ...parsed, startMonth: localDate().slice(0, 7) } as GoalAssumptions;
            const next = projectGoal(s);
            changed.current = true;
            setReferenceMonth(s.startMonth);
            setCalculated(s);
            setResult(next);
            setSelected(0);
          } catch (e) {
            setError(e instanceof Error ? e.message : "入力を確認してください。");
          }
        }}
      >
        <fieldset disabled={busy || !ready}>
          <legend>1. 現在の資産と貯蓄ペース</legend>
          <button type="button" onClick={() => void load()}>
            現在の資産・貯蓄ペースを読み込む
          </button>
          {busy && <p role="status">記録を読み込んでいます…</p>}
          {source && <p className="field-hint">{source} 読み込んだ値は編集できます。</p>}
          <div className="fire-fields">{fields.map(([key, label]) => input(key, label))}</div>
          <p className="field-hint">
            現金貯蓄 = 収入 − 消費支出 −
            投資積立。二重計上せず現金と株式へ別々に加算します。現金の利息は0%、株式は上記の一定年利です。
          </p>
        </fieldset>
        <fieldset disabled={busy || !ready}>
          <legend>2. NISAの利用状況</legend>
          <p>
            評価額から利用枠は推定できません。証券会社の新NISA利用状況を確認し、未利用なら0を入力してください。
          </p>
          <div className="fire-fields">{nisaFields.map(([key, label]) => input(key, label))}</div>
          <p className="field-hint">
            両枠の対象商品を買う前提で、つみたて枠→成長枠→特定・一般口座の順に新規積立します。年間120万/240万円、保有取得額1800万円（成長枠1200万円）を上限に計算。年間枠は1月にリセットします。2023年以前の旧NISAは対象外です。
          </p>
        </fieldset>
        <fieldset disabled={busy || !ready}>
          <legend>3. 税引後の受取額を見積もる</legend>
          <p>
            特定・一般口座で現在保有する株式・投信の取得額を入力してください。評価額やNISAの利用額とは別の金額です。
          </p>
          <div className="fire-fields">
            {input("taxableCost", "課税口座の保有取得額（不明なら空欄）")}
            {input("taxRate", "売却益の想定税率（%）")}
          </div>
          <p className="field-hint">
            取得額が不明でも税引前の計算は使えます。記録の再読込時は取得額を空欄に戻すため再確認してください。含み損がある場合は取得額が評価額を超えても入力できます。
          </p>
          <p className="field-hint">
            20.315%は現在の制度を参考にした初期仮定です。到達年にかかわらず入力した税率を使い、将来の税制変更は自動反映しません。
          </p>
        </fieldset>
        <button disabled={busy || !ready} type="submit">
          目標到達を計算する
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && calculated && (
        <div className="goal-result">
          <div className="forecast-outcomes" role="status">
            <div>
              <span>目標 {yen(calculated.target)}</span>
              <strong>
                {result.reached
                  ? result.reached.month === 0
                    ? "すでに目標に到達"
                    : `${dateAt(calculated.startMonth, result.reached.month)} に到達`
                  : result.stopped
                    ? "計算を途中で停止"
                    : "100年以内には未到達"}
              </strong>
              <small>
                {result.reached
                  ? `今から ${elapsed(result.reached.month)}・最初の到達`
                  : "入力した貯蓄と年利での試算"}
              </small>
            </div>
            {result.reached && (
              <div>
                <span>株式の年{values.withdrawalBps}%を自分で取り崩すと</span>
                <strong>月 {yen(result.monthlyWithdrawal!)}</strong>
                <small>年間 {yen(result.annualWithdrawal!)}・税引前</small>
              </div>
            )}
          </div>
          {result.reached && result.annualNetWithdrawal && result.monthlyNetWithdrawal && (
            <section aria-label="税引後の取り崩し見積もり" className="withdrawal-estimate">
              <h4>取り崩しで受け取れる金額の目安</h4>
              <p>
                NISA・課税口座を評価額の割合で売却。現金は取り崩しません。想定税率 {values.taxRate}
                %。
              </p>
              {result.annualNetWithdrawal.net === null && (
                <p className="field-hint">
                  取得額が不明のため、税額・税引後の受取額は未計算です。上の取得額を入力して再計算してください。
                </p>
              )}
              <div className="goal-breakdown">
                {(
                  [
                    ["年額", result.annualNetWithdrawal],
                    ["月額相当", result.monthlyNetWithdrawal],
                  ] as const
                ).map(([label, value]) => {
                  return (
                    <div key={label}>
                      <h5>{label}</h5>
                      <dl>
                        {(
                          [
                            ["税引前の売却額", value.gross],
                            ["NISA売却分（非課税）", value.nisaSale],
                            ["課税口座の売却分", value.taxableSale],
                            ["うち課税対象の利益（推定）", value.taxableGain],
                            ["推定税額", value.tax],
                            ["税引後の受取額", value.net],
                          ] as const
                        ).map(([name, amount]) => (
                          <div key={name}>
                            <dt>{name}</dt>
                            <dd>{amount === null ? "未計算" : yen(amount)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  );
                })}
              </div>
              <p className="field-hint">
                月額は到達時の同じ資産から計算した年率÷12相当です。毎月の連続売却や到達後の資産維持を予測するものではありません。年額と月額は別々に1円単位で丸めます。
              </p>
            </section>
          )}
          {result.stopped && (
            <p role="alert">
              {result.stoppedMonth}か月目に
              {result.stopped === "cash-shortfall"
                ? "現金が不足するため停止しました。株式を自動売却して補填しません。"
                : "安全な整数範囲を超えたため停止しました。"}{" "}
              到達時の金額は表示できません。
            </p>
          )}
          {result.reached && (
            <section aria-label="目標到達時の資産構成">
              <h4>到達時の資産構成 · {yen(result.reached.total)}</h4>
              <div className="goal-allocation" aria-hidden="true">
                {assetFields.map(([key], i) => (
                  <span
                    key={key}
                    style={{
                      width: `${(result.reached![key] / result.reached!.total) * 100}%`,
                      background: chartColors[i],
                    }}
                  />
                ))}
              </div>
              <div className="goal-breakdown">
                {assetFields.map(([key, label], i) => (
                  <div key={key}>
                    <span>
                      <i style={{ background: chartColors[i] }} />
                      {label}
                    </span>
                    <strong>{yen(result.reached![key])}</strong>
                    <small>
                      {((result.reached![key] / result.reached!.total) * 100).toFixed(1)}%
                    </small>
                  </div>
                ))}
              </div>
            </section>
          )}
          <InteractiveLineChart
            title="目標までの資産推移"
            labels={result.points.map((p) => dateAt(calculated.startMonth, p.month))}
            selected={selected}
            onSelect={setSelected}
            series={[
              ...assetFields.map(([key, label], i) => ({
                id: key,
                label,
                color: chartColors[i],
                values: result.points.map((p) => p[key]),
              })),
              {
                id: "total",
                label: "総資産",
                color: chartColors[4],
                values: result.points.map((p) => p.total),
              },
              {
                id: "target",
                label: "目標",
                color: chartColors[5],
                dashed: true,
                values: result.points.map(() => calculated.target),
              },
            ]}
          />
          <p className="field-hint">
            グラフは年ごとと到達月の試算です。到達月まで毎月計算し、選択した時点の内訳を確認できます。
          </p>
          {ready && result.reached && (
            <DrawdownPlanner
              start={{
                cash: result.reached.cash,
                nisa: result.reached.tsumitate + result.reached.growth,
                taxable: result.reached.taxable,
                taxableCost: result.taxableCostAtGoal,
              }}
              taxRate={calculated.taxRate ?? 20315}
              values={values}
              onChange={(key, value) => {
                changed.current = true;
                setValues((v) => ({ ...v, [key]: value }));
              }}
              dateAt={(month) => dateAt(calculated.startMonth, result.reached!.month + month)}
            />
          )}
        </div>
      )}
      <details>
        <summary>前提と計算方法</summary>
        <p>
          今月を起点に翌月末から積立。既存の現金は株式へ移しません。毎月、株式を年利÷12で運用して1円に四捨五入し、その後積立を追加します。目標は固定の名目金額で、インフレは含みません。最大1200か月で最初の到達を探します。
        </p>
        <p>
          自己配当は企業の配当金ではなく、到達時の株式評価額×取り崩し率の売却額です。税引後の見積もりでは課税口座の取得額に積立中の課税口座への買付額を加え、評価額に対する利益割合を売却分に当てはめます。利益がない場合の推定税額は0円です。個別銘柄・手数料・損益通算・繰越控除・外国税は考慮しない概算で、申告用の税額ではありません。到達後の残高推移や資金の持続性は含みません。
        </p>
        <p>
          積立中の売却・枠復活・旧NISA・課税口座からNISAへの買い直しはモデル化しません。株式欄には株式・投信の評価額を入力し、証券口座内の預り金は現金欄へ分けてください。
        </p>
        <a href="https://www.fsa.go.jp/policy/nisa2/know/" target="_blank" rel="noreferrer">
          金融庁：NISAの制度と限度額
        </a>
        <p>
          <a
            href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1463.htm"
            target="_blank"
            rel="noreferrer"
          >
            国税庁：株式等を譲渡したときの課税
          </a>
        </p>
      </details>
    </section>
  );
}
