import type { GoalPlanRepository } from "../../domain/goal-plan";
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
  ["startingAssets", "시작 자산(엔)"],
  ["target", "목표 자산·현재 가치(엔)"],
  ["monthlyContribution", "월 적립액(엔)"],
  ["returnBps", "가정 연 수익률(%)"],
  ["inflationBps", "가정 물가상승률(%)"],
] as const;
const yen = (n: number) => `${n.toLocaleString("ko-KR")} 엔`;
export function FirePlanner({
  repository,
  firePlanRepository,
  goalPlanRepository,
  navigationRef,
  revision = 0,
}: {
  repository: PortfolioRepository;
  firePlanRepository: FirePlanRepository;
  goalPlanRepository: GoalPlanRepository;
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
        setSaveError(reason instanceof Error ? reason.message : "FIRE 계획을 불러올 수 없습니다.");
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
            : "FIRE 계획을 저장할 수 없습니다. 입력은 남겨 두었습니다.",
        );
      });
  }, [comparisons, currentValues, firePlanRepository, planReady, values]);
  useImperativeHandle(navigationRef, () => ({
    useAssets: (value, description) => {
      if (busy || !Number.isSafeInteger(value) || value < 0) return false;
      if (
        Object.values(values).some((v) => v !== "") &&
        !window.confirm(
          "입력 중인 시작 자산을 선택한 기록 금액으로 바꿀까요? 다른 가정과 비교는 유지합니다.",
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
        throw new Error("사용할 수 있는 잔액이 없습니다. 시작 자산을 입력해 주세요.");
      setValues((v) => ({ ...v, startingAssets: String(total) }));
      setSource(
        `${today} 불러옴: ${current.balances.length}/${current.accounts.length}개 계좌의 마지막 기록입니다. 확인일이 다르거나 오래된 계좌, 미기록 계좌를개요에서 확인하고 필요하면 금액을 수정해 주세요.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="fire" className="asset-card fire-planner" aria-labelledby="fire-heading">
      <h2 id="fire-heading">FIRE 시뮬레이션</h2>
      <GoalPlanner
        repository={repository}
        goalPlanRepository={goalPlanRepository}
        revision={revision}
      />
      <h3>전체 자산 계획·비교</h3>
      <p>목표까지 얼마나 남았을까요? 직접 정한 가정으로 계산해 보세요.</p>
      <p className="field-hint">
        입력과 비교는 이 기기에 자동 저장되며 JSON 백업에도 포함됩니다. 계산 결과는 저장한 가정으로
        다시 계산합니다. 기록된 잔액은 변경하지 않습니다.
      </p>
      <p className="fire-save-state" aria-live="polite">
        {saveState === "loading" && "저장된 FIRE 계획을 불러오는 중…"}
        {saveState === "saving" && "FIRE 계획을 저장하는 중…"}
        {saveState === "saved" && "FIRE 계획을 이 기기에 저장했습니다"}
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
            setError(e instanceof Error ? e.message : "입력을 확인해 주세요.");
          }
        }}
      >
        <fieldset disabled={busy || !planReady}>
          <legend>계산 가정</legend>
          <button type="button" onClick={() => void loadRecorded()}>
            기록한 총자산 사용
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
          <button type="submit">시뮬레이션 실행</button>
          <button
            type="button"
            onClick={() => {
              setValues(emptyFireScenario());
              setCurrentValues(null);
              setSource("");
              setError("");
            }}
          >
            가정 초기화
          </button>
        </fieldset>
      </form>
      {busy && <p role="status">기록을 불러오는 중…</p>}
      {error && <p role="alert">{error}</p>}
      {result && (
        <div role="status">
          <h3>{arrivalText(result)}</h3>
          <p>
            시작 자산 {yen(result.points[0].assets)} / 목표 {yen(result.points[0].target)}
          </p>
          {result.overflowMonth !== null && (
            <p>
              {result.overflowMonth}개월째 안전한 정수 계산 범위를 초과해 이후는 표시하지 않습니다.
            </p>
          )}
          <details>
            <summary>연도별 자산과 목표 보기</summary>
            <div
              className="history-table"
              role="region"
              aria-label="연도별 계산표·가로로 스크롤할 수 있습니다"
              tabIndex={0}
            >
              <table>
                <caption>적립 기간 계산(미래 명목 금액)</caption>
                <thead>
                  <tr>
                    <th>경과 연수</th>
                    <th>자산</th>
                    <th>물가 반영 목표</th>
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
          title="현재 예측 차트"
          items={[{ id: "draft", label: "현재 계산", result }]}
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
        <summary>계산 방법과 결과 해석</summary>
        <p>
          수익률은 명목 연율입니다. 연율÷12로 매월 복리 계산하고 월말에 일정액을 적립합니다. 목표도
          같은 방식으로 물가상승률을 반영합니다. 매월 자산·목표는 1엔 단위로 반올림합니다. 명목
          연율은 실효 연율과 다릅니다.
        </p>
        <p>
          최대 100년 동안 최초 달성 시점을 표시합니다. 달성 후에도 유지할 수 있다는 뜻은 아닙니다.
          세금·수수료·부채·인출·시장 변동은 계산하지 않습니다. 필요하면 비용을 반영한 수익률을
          입력하세요. 일정한 가정에 따른 계산이며 미래 성과나 은퇴 가능성을 보장하지 않습니다.
        </p>
      </details>
    </section>
  );
}
