import { useEffect, useMemo, useRef, useState, useImperativeHandle, type Ref } from "react";
import { ProjectionChart } from "./ProjectionChart";
import { ScenarioComparison } from "./ScenarioComparison";
import { GoalPlanner } from "./GoalPlanner";
import { arrivalText } from "./fire-format";
import {
  emptyFireScenario,
  FIRE_PLAN_ID,
  MAX_FIRE_COMPARISONS,
  projectFireValues,
  sameFirePlanContent,
  type FirePlan,
  type FirePlanRepository,
  type FireScenarioValues,
  type SavedFireScenario,
} from "../../domain/fire-plan";
import { currentTotal, localDate } from "../../domain/observations";
import type { PortfolioRepository } from "../../domain/portfolio";

const fields = [
  ["startingAssets", "開始資産（円）"],
  ["target", "目標資産・今日の価値（円）"],
  ["monthlyContribution", "毎月の積立額（円）"],
  ["returnBps", "想定年利（%）"],
  ["inflationBps", "想定インフレ率（%）"],
] as const;
const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;
export function FirePlanner({
  repository,
  firePlanRepository,
  navigationRef,
  revision = 0,
}: {
  repository: PortfolioRepository;
  firePlanRepository: FirePlanRepository;
  navigationRef?: Ref<{ useAssets: (value: number, source: string) => boolean }>;
  revision?: number;
}) {
  const [values, setValues] = useState<FireScenarioValues>(emptyFireScenario);
  const [currentValues, setCurrentValues] = useState<FireScenarioValues | null>(null);
  const [comparisons, setComparisons] = useState<SavedFireScenario[]>([]);
  const result = useMemo(
    () => (currentValues ? projectFireValues(currentValues) : null),
    [currentValues],
  );
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveState, setSaveState] = useState<"loading" | "idle" | "saving" | "saved">("loading");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [planReady, setPlanReady] = useState(false);
  const baseline = useRef<FirePlan | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveRevision = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void saveQueue.current
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return null;
        setPlanReady(false);
        setSaveState("loading");
        setSaveError("");
        return firePlanRepository.load();
      })
      .then((plan) => {
        if (cancelled) return;
        baseline.current = plan;
        setValues(plan?.draft ?? emptyFireScenario());
        setCurrentValues(plan?.current ?? null);
        setComparisons(plan?.comparisons ?? []);
        setSource("");
        setError("");
        setPlanReady(true);
        setSaveState(plan ? "saved" : "idle");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setSaveError(reason instanceof Error ? reason.message : "FIRE計画を読み込めません。");
        setSaveState("idle");
      });
    return () => {
      cancelled = true;
    };
  }, [firePlanRepository, revision]);

  useEffect(() => {
    if (!planReady) return;
    const content = {
      id: FIRE_PLAN_ID,
      draft: values,
      current: currentValues,
      comparisons,
    } as const;
    if (
      !baseline.current &&
      !content.current &&
      content.comparisons.length === 0 &&
      Object.values(content.draft).every((value) => value === "")
    )
      return;
    if (sameFirePlanContent(baseline.current, content)) return;
    const requestRevision = ++saveRevision.current;
    setSaveState("saving");
    setSaveError("");
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (requestRevision !== saveRevision.current) return;
        const next: FirePlan = {
          ...content,
          draft: { ...content.draft },
          current: content.current ? { ...content.current } : null,
          comparisons: content.comparisons.map((item) => ({
            id: item.id,
            values: { ...item.values },
          })),
          updatedAt: new Date().toISOString(),
        };
        const saved = await firePlanRepository.save(next, baseline.current);
        baseline.current = saved;
        if (requestRevision === saveRevision.current) setSaveState("saved");
      })
      .catch((reason: unknown) => {
        if (requestRevision !== saveRevision.current) return;
        setSaveState("idle");
        setSaveError(
          reason instanceof Error
            ? reason.message
            : "FIRE計画を保存できません。入力は残しています。",
        );
      });
  }, [comparisons, currentValues, firePlanRepository, planReady, values]);
  useImperativeHandle(navigationRef, () => ({
    useAssets: (value, description) => {
      if (busy || !Number.isSafeInteger(value) || value < 0) return false;
      if (
        Object.values(values).some((v) => v !== "") &&
        !window.confirm(
          "入力中の開始資産を選択した記録額に置き換えますか？ほかの仮定と比較は保持します。",
        )
      )
        return false;
      setValues((v) => ({ ...v, startingAssets: String(value) }));
      setCurrentValues(null);
      setError("");
      setSource(description);
      return true;
    },
  }));
  async function loadRecorded() {
    setBusy(true);
    setError("");
    setCurrentValues(null);
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
      <GoalPlanner repository={repository} />
      <h3>従来の一括資産プラン・比較</h3>
      <p>目標まで、あとどのくらい？ ご自身の仮定で計算できます。</p>
      <p className="field-hint">
        入力と比較はこの端末に自動保存し、JSONバックアップにも含めます。計算結果は保存した仮定から再現します。記録済みの残高は変更しません。
      </p>
      <p className="fire-save-state" aria-live="polite">
        {saveState === "loading" && "保存済みのFIRE計画を読み込んでいます…"}
        {saveState === "saving" && "FIRE計画を保存しています…"}
        {saveState === "saved" && "FIRE計画をこの端末に保存しました"}
      </p>
      {saveError && <p role="alert">{saveError}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setCurrentValues(null);
          try {
            projectFireValues(values);
            setCurrentValues({ ...values });
          } catch (e) {
            setError(e instanceof Error ? e.message : "入力を確認してください。");
          }
        }}
      >
        <fieldset disabled={busy || !planReady}>
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
                    setCurrentValues(null);
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
              setValues(emptyFireScenario());
              setCurrentValues(null);
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
          <h3>{arrivalText(result)}</h3>
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
            <div
              className="history-table"
              role="region"
              aria-label="年別試算表・横にスクロールできます"
              tabIndex={0}
            >
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
      {result && (
        <ProjectionChart
          title="今回の予測チャート"
          items={[{ id: "draft", label: "今回の試算", result }]}
        />
      )}
      <ScenarioComparison
        result={result}
        items={comparisons}
        onAdd={() => {
          if (!result || comparisons.length >= MAX_FIRE_COMPARISONS) return;
          const id = Math.max(0, ...comparisons.map((item) => item.id)) + 1;
          setComparisons([...comparisons, { id, values: { ...values } }]);
        }}
        onRemove={(id) => setComparisons(comparisons.filter((item) => item.id !== id))}
      />
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
