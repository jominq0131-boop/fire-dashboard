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

const yen = (n: number) => `${n.toLocaleString("ko-KR")} 엔`;
const assetFields = [
  ["cash", "현금·예금"],
  ["tsumitate", "NISA·적립"],
  ["growth", "NISA·성장"],
  ["taxable", "특정·일반 계좌 주식"],
] as const;
const fields = [
  ...assetFields,
  ["monthlyCash", "월 현금 저축(음수 가능)"],
  ["monthlyInvestment", "월 주식·펀드 적립"],
  ["target", "목표 금액(명목)"],
  ["returnBps", "주식 가정 연 수익률(%)"],
  ["withdrawalBps", "목표 달성 시 연 인출률(%)"],
] as const;
const nisaFields = [
  ["usedTotal", "신 NISA 보유 취득원가·합계"],
  ["usedGrowth", "그중 성장투자 한도의 보유 취득원가"],
  ["usedYearTsumitate", "올해 적립투자 한도·매수액"],
  ["usedYearGrowth", "올해 성장투자 한도·매수액"],
] as const;
function elapsed(month: number) {
  return `${Math.floor(month / 12)}년${month % 12}개월`;
}
function dateAt(start: string, months: number) {
  const index = Number(start.slice(0, 4)) * 12 + Number(start.slice(5)) - 1 + months;
  return `${Math.floor(index / 12)}년${(index % 12) + 1}월`;
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
  const [saveStatus, setSaveStatus] = useState("목표 계획을 불러오는 중…");
  const [saveError, setSaveError] = useState("");
  const baseline = useRef<GoalPlan | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const sequence = useRef(0);
  const changed = useRef(false);
  useEffect(() => {
    let cancelled = false;
    ++sequence.current;
    setReady(false);
    setSaveStatus("목표 계획을 불러오는 중…");
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
        setSaveStatus(plan ? "목표 계획이 이 기기에 저장되어 있습니다" : "");
        setReady(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSaveStatus("");
        setSaveError(e instanceof Error ? e.message : "목표 계획을 불러올 수 없습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [goalPlanRepository, revision]);
  useEffect(() => {
    if (!ready || !changed.current) return;
    const request = ++sequence.current;
    const draft = { ...values };
    setSaveStatus("목표 계획을 저장하는 중…");
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
        if (request === sequence.current) setSaveStatus("목표 계획을 이 기기에 저장했습니다");
      })
      .catch((e: unknown) => {
        if (request !== sequence.current) return;
        setSaveStatus("");
        setSaveError(
          e instanceof Error
            ? e.message
            : "목표 계획을 저장할 수 없습니다. 입력은 남겨 두었습니다.",
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
        `${today} 불러옴. 잔액은 계좌별 마지막 기록이며 확인일이 다를 수 있습니다. 미기록  ${seed.missing}개 계좌. 기타 자산  ${yen(seed.other)} 은 분류할 수 없어 제외했습니다. 필요하면 현금·주식에 직접 나누어 입력해 주세요.${seed.months.length ? `완료 월  ${seed.months.join("・")} 의 ${seed.months.length}개 평균을 사용했습니다(미기록 월과 이번 달 제외).` : "완료 월의 수입·지출이 없어 월 저축·적립액을 직접 입력해 주세요."}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "기록을 불러올 수 없습니다.");
    } finally {
      setBusy(false);
    }
  }
  function input(key: keyof Values, label: string) {
    return (
      <label key={key}>
        {label}
        {!key.endsWith("Bps") && key !== "taxRate" && "(엔)"}
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
      <p className="section-kicker">나의 목표 / NISA 우선</p>
      <h3 id="goal-heading">지금 속도라면 언제 목표에 도달할까요?</h3>
      <p>현금과 주식을 나누어 월 저축액으로 목표까지의 경로를 그립니다.</p>
      <p className="field-hint">
        입력은 이 기기에 자동 저장되고 JSON 백업에 포함됩니다. 복원 후 입력을 확인하고 다시 계산해
        주세요. 계산 결과는 저장하지 않습니다. 저장 완료 표시를 확인한 뒤 새로고침하거나 백업해
        주세요.
      </p>
      <p className="fire-save-state" aria-live="polite">
        {saveStatus}
      </p>
      {saveError && <p role="alert">{saveError}</p>}
      {ready && (
        <p className="field-hint">
          입력 확인 월: {referenceMonth}. 현재 잔액과 올해 NISA 매수액을 확인해 주세요.
        </p>
      )}
      {ready && referenceMonth !== localDate().slice(0, 7) && (
        <p role="alert">
          이전 월에 입력한 내용입니다. 해가 바뀌었다면 올해 NISA 매수액을 확인·수정해 주세요.
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
            setError(e instanceof Error ? e.message : "입력을 확인해 주세요.");
          }
        }}
      >
        <fieldset disabled={busy || !ready}>
          <legend>1. 현재 자산과 저축 속도</legend>
          <button type="button" onClick={() => void load()}>
            현재 자산·저축 속도 불러오기
          </button>
          {busy && <p role="status">기록을 불러오는 중…</p>}
          {source && <p className="field-hint">{source} 불러온 값은 수정할 수 있습니다.</p>}
          <div className="fire-fields">{fields.map(([key, label]) => input(key, label))}</div>
          <p className="field-hint">
            현금 저축 = 수입 − 소비 지출 − 투자 적립. 중복 집계 없이 현금과 주식에 각각 더합니다.
            현금 이자는 0%, 주식은 위의 고정 연 수익률을 적용합니다.
          </p>
        </fieldset>
        <fieldset disabled={busy || !ready}>
          <legend>2. NISA 사용 현황</legend>
          <p>
            평가액만으로 사용 한도를 추정할 수 없습니다. 증권사의 신 NISA 사용 현황을 확인하고,
            미사용이면 0을 입력해 주세요.
          </p>
          <div className="fire-fields">{nisaFields.map(([key, label]) => input(key, label))}</div>
          <p className="field-hint">
            두 한도의 대상 상품을 매수한다고 가정하며 적립투자→성장투자→특정·일반 계좌 순으로 신규
            적립합니다. 연 120만/240만 엔, 보유 취득원가 1,800만 엔(성장투자 1,200만 엔)을 한도로
            계산합니다. 연간 한도는 1월에 초기화합니다. 2023년 이전 구 NISA는 제외합니다.
          </p>
        </fieldset>
        <fieldset disabled={busy || !ready}>
          <legend>3. 세후 수령액 추정</legend>
          <p>
            특정·일반 계좌에서 현재 보유한 주식·펀드의 취득원가를 입력해 주세요. 평가액이나 NISA
            사용액과는 다릅니다.
          </p>
          <div className="fire-fields">
            {input("taxableCost", "과세 계좌 보유 취득원가(모르면 빈칸)")}
            {input("taxRate", "매도차익 가정 세율(%)")}
          </div>
          <p className="field-hint">
            취득원가를 몰라도 세전 계산은 사용할 수 있습니다. 기록을 다시 불러오면 취득원가를
            빈칸으로 되돌리므로 재확인해 주세요. 평가손실이 있다면 취득원가가 평가액보다 커도 입력할
            수 있습니다.
          </p>
          <p className="field-hint">
            20.315%는 일본 제도를 참고한 초기 가정입니다. 목표 달성 연도와 관계없이 입력한 세율을
            사용하며 미래 세법 변경은 자동 반영하지 않습니다.
          </p>
        </fieldset>
        <button disabled={busy || !ready} type="submit">
          목표 달성 계산
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && calculated && (
        <div className="goal-result">
          <div className="forecast-outcomes" role="status">
            <div>
              <span>목표 {yen(calculated.target)}</span>
              <strong>
                {result.reached
                  ? result.reached.month === 0
                    ? "이미 목표 달성"
                    : `${dateAt(calculated.startMonth, result.reached.month)} 에 달성`
                  : result.stopped
                    ? "계산 도중 중단"
                    : "100년 이내 미달성"}
              </strong>
              <small>
                {result.reached
                  ? `지금부터  ${elapsed(result.reached.month)}·최초 달성`
                  : "입력한 저축액과 수익률에 따른 계산"}
              </small>
            </div>
            {result.reached && (
              <div>
                <span>주식을 연 {values.withdrawalBps}%씩 직접 인출하면</span>
                <strong>월 {yen(result.monthlyWithdrawal!)}</strong>
                <small>연간 {yen(result.annualWithdrawal!)}·세전</small>
              </div>
            )}
          </div>
          {result.reached && result.annualNetWithdrawal && result.monthlyNetWithdrawal && (
            <section aria-label="세후 인출액 추정" className="withdrawal-estimate">
              <h4>인출해 받을 수 있는 금액</h4>
              <p>
                NISA·과세 계좌를 평가액 비율로 매도하며 현금은 인출하지 않습니다. 가정 세율{" "}
                {values.taxRate}
                %。
              </p>
              {result.annualNetWithdrawal.net === null && (
                <p className="field-hint">
                  취득원가를 알 수 없어 세금·세후 수령액은 계산하지 않았습니다. 위의 취득원가를
                  입력하고 다시 계산해 주세요.
                </p>
              )}
              <div className="goal-breakdown">
                {(
                  [
                    ["연 금액", result.annualNetWithdrawal],
                    ["월 환산액", result.monthlyNetWithdrawal],
                  ] as const
                ).map(([label, value]) => {
                  return (
                    <div key={label}>
                      <h5>{label}</h5>
                      <dl>
                        {(
                          [
                            ["세전 매도액", value.gross],
                            ["NISA 매도분(비과세)", value.nisaSale],
                            ["과세 계좌 매도분", value.taxableSale],
                            ["그중 과세 대상 이익(추정)", value.taxableGain],
                            ["추정 세금", value.tax],
                            ["세후 수령액", value.net],
                          ] as const
                        ).map(([name, amount]) => (
                          <div key={name}>
                            <dt>{name}</dt>
                            <dd>{amount === null ? "미계산" : yen(amount)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  );
                })}
              </div>
              <p className="field-hint">
                월 금액은 목표 달성 시점의 같은 자산에 연 인출률÷12를 적용한 값입니다. 매월 연속
                매도나 목표 달성 후 자산 유지를 예측하지 않습니다. 연 금액과 월 금액은 각각 1엔
                단위로 반올림합니다.
              </p>
            </section>
          )}
          {result.stopped && (
            <p role="alert">
              {result.stoppedMonth}개월째
              {result.stopped === "cash-shortfall"
                ? "현금이 부족해 중단했습니다. 주식을 자동 매도해 보충하지 않습니다."
                : "안전한 정수 범위를 초과해 중단했습니다."}{" "}
              달성 시점의 금액을 표시할 수 없습니다.
            </p>
          )}
          {result.reached && (
            <section aria-label="목표 달성 시 자산 구성">
              <h4>달성 시 자산 구성 · {yen(result.reached.total)}</h4>
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
            title="목표까지의 자산 변화"
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
                label: "총자산",
                color: chartColors[4],
                values: result.points.map((p) => p.total),
              },
              {
                id: "target",
                label: "목표",
                color: chartColors[5],
                dashed: true,
                values: result.points.map(() => calculated.target),
              },
            ]}
          />
          <p className="field-hint">
            그래프는 연 단위와 달성 월의 계산값입니다. 달성 월까지 매월 계산하며 선택한 시점의
            구성을 확인할 수 있습니다.
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
        <summary>가정과 계산 방법</summary>
        <p>
          이번 달을 기준으로 다음 달 말부터 적립합니다. 기존 현금은 주식으로 옮기지 않습니다. 매월
          주식에 연 수익률÷12를 적용해 1엔 단위로 반올림한 뒤 적립액을 더합니다. 목표는 고정 명목
          금액이며 물가는 반영하지 않습니다. 최대 1,200개월 동안 최초 달성을 찾습니다.
        </p>
        <p>
          자가배당은 기업이 지급하는 배당금이 아니라 달성 시점 주식 평가액×인출률만큼의
          매도액입니다. 세후 추정에는 기존 과세 취득원가에 적립 중 과세 계좌 매수액을 더하고, 평가액
          대비 이익 비율을 매도분에 적용합니다. 이익이 없으면 추정 세금은 0엔입니다.개별
          종목·수수료·손익통산·이월공제·외국세는 반영하지 않는 추정값으로 세금 신고용이 아닙니다.
          달성 후 잔액 변화나 자금 지속성은 포함하지 않습니다.
        </p>
        <p>
          적립 중 매도·한도 회복·구 NISA·과세 계좌에서 NISA로 재매수는 반영하지 않습니다. 주식에는
          주식·펀드 평가액을, 증권 계좌의 예수금은 현금에 따로 입력해 주세요.
        </p>
        <a href="https://www.fsa.go.jp/policy/nisa2/know/" target="_blank" rel="noreferrer">
          일본 금융청: NISA 제도와 한도
        </a>
        <p>
          <a
            href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1463.htm"
            target="_blank"
            rel="noreferrer"
          >
            일본 국세청: 주식 양도 시 과세
          </a>
        </p>
      </details>
    </section>
  );
}
