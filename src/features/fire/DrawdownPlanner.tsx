import { useState } from "react";
import { projectDrawdown, type DrawdownResult, type DrawdownStart } from "../../domain/drawdown";
import type { DrawdownValues } from "../../domain/goal-plan";
import { parseYen } from "../../domain/monthly";
import { parseRate } from "../../domain/fire";
import { InteractiveLineChart } from "../charts/InteractiveLineChart";
import { chartColors } from "../charts/line-geometry";

const yen = (n: number) => `${n.toLocaleString("ko-KR")} 엔`;
const fields = [
  ["drawdownMonthly", "목표 달성 후 월 생활비(세후·엔)"],
  ["drawdownYears", "인출 기간(년)"],
  ["drawdownReturnBps", "목표 달성 후 주식 연 수익률(%)"],
  ["drawdownInflationBps", "목표 달성 후 생활비 상승률(연율·%)"],
  ["drawdownIncome", "월 연금·추가 소득(세후·엔)"],
  ["drawdownIncomeStart", "소득 지급 시작(목표 달성 후 개월째)"],
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
      <p className="section-kicker">목표 달성 이후</p>
      <h4 id="drawdown-heading">목표 달성 후에도 생활비를 충당할 수 있을까요?</h4>
      <p>
        {dateAt(0)}에 달성한 자산에서 다음 달 말부터 생활비를 인출합니다. 입력한 세후 소득을 먼저
        사용하고 부족분만 자산에서 충당합니다. 현금 이자는 0%입니다.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setResult(null);
          try {
            const next = projectDrawdown(start, {
              monthlySpending: parseYen(values.drawdownMonthly),
              monthlyIncome: parseYen(values.drawdownIncome),
              incomeStartMonth: parseYen(values.drawdownIncomeStart),
              years: parseYen(values.drawdownYears),
              returnBps: parseRate(values.drawdownReturnBps),
              inflationBps: parseRate(values.drawdownInflationBps),
              taxRate,
            });
            setResult(next);
            setSelected(0);
          } catch (e) {
            setError(e instanceof Error ? e.message : "입력을 확인해 주세요.");
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
          생활비는 목표 달성 시점의 월 금액을 입력하세요. 기간은 1~100년, 비율은 연 -99~100%입니다.
          입력은 목표 계획과 함께 자동 저장됩니다.
        </p>
        <p className="field-hint">
          소득이 없으면 0엔을 입력하세요. 지급 시작은 목표 달성 다음 달이 1개월째이며 최대
          1200개월째까지입니다. 소득은 시작 월부터 매월 말 같은 명목 금액으로 받으며, 남는 금액은
          현금으로 보관합니다. 세금·보험료를 제외한 수령액을 입력하세요.
        </p>
        <button type="submit">목표 달성 후 생활비 계산</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && last && (
        <div className="drawdown-result">
          <div className="forecast-outcomes" role="status">
            <div>
              <span>입력한 가정에 따른 결과</span>
              <strong>
                {result.status === "funded"
                  ? `${values.drawdownYears}년간 생활비 충당`
                  : result.status === "shortfall"
                    ? `${dateAt(result.stoppedMonth!)}에 생활비 부족`
                    : result.status === "unknown-cost"
                      ? "취득원가를 알 수 없어 계산 중단"
                      : "계산 범위를 초과해 중단"}
              </strong>
              <small>
                {result.status === "funded"
                  ? "미래의 자산 유지를 보장하지 않습니다"
                  : `목표 달성 후 ${result.stoppedMonth}개월째`}
              </small>
            </div>
            <div>
              <span>{dateAt(last.month)} 잔액</span>
              <strong>{yen(last.total)}</strong>
              <small>
                지급한 생활비 {yen(last.spendingPaid)} / 추정 세금 {yen(last.taxPaid)}
              </small>
              <small>받은 연금·추가 소득 {yen(last.incomeReceived)}</small>
            </div>
          </div>
          {result.status === "shortfall" && (
            <p>
              생활비가 부족한 달의 미충당 금액은 {yen(result.shortfall)}
              입니다. 해당 월에 사용할 수 있는 현금과 주식의 세후 매도액을 모두 사용한 시점에
              중단했습니다.
            </p>
          )}
          {result.status === "unknown-cost" && (
            <p>
              현금이 부족해 과세 주식을 매도해야 합니다. 위의 과세 계좌 취득원가를 확인하고 목표
              달성 계산부터 다시 실행해 주세요. 중단 전에 생활비 지급을 마친 월까지 표시합니다.
            </p>
          )}
          {result.status === "overflow" && (
            <p>
              잔액·생활비·누계가 안전한 정수 범위를 초과합니다. 중단 전에 생활비 지급을 마친 월까지
              표시합니다.
            </p>
          )}
          <InteractiveLineChart
            title="목표 달성 후 자산 잔액"
            labels={result.points.map((p) => dateAt(p.month))}
            selected={selected}
            onSelect={setSelected}
            series={(
              [
                ["cash", "현금"],
                ["nisa", "NISA"],
                ["taxable", "과세 주식"],
                ["total", "총자산"],
              ] as const
            ).map(([key, label], i) => ({
              id: key,
              label,
              color: chartColors[i],
              values: result.points.map((p) => p[key]),
            }))}
          />
          <p className="field-hint">
            매월 계산하며 연 단위와 중단 시점의 잔액을 표시합니다. 생활비 부족과 자산의 목표액
            미달은 서로 다른 상태입니다.
          </p>
        </div>
      )}
      <details>
        <summary>인출 순서와 가정</summary>
        <p>
          월초 잔액에 주식 연 수익률÷12를 적용해 1엔 단위로 반올림합니다. 지급 시작 월부터 세후
          소득을 현금에 더한 뒤 월말 생활비를 지급합니다. 부족분은 NISA·과세 주식을 평가액 비율로
          매도해 세후 필요액을 충당합니다. 과세 취득원가는 매도 비율만큼 줄입니다. 생활비는 둘째
          달부터 연 상승률÷12를 적용하고 1엔 단위로 반올림합니다. 소득에는 물가 연동·종료 시점·연금
          수급액 자동 추정을 적용하지 않습니다.
        </p>
        <p>
          세율은 위 설정을 고정해 사용합니다. NISA 재투자·한도 회복, 수익률 변동, 개별 종목,
          수수료와 손익통산은 포함하지 않습니다. 일정한 가정에 따른 계산이며 성공 확률이나 은퇴 가능
          여부를 판정하지 않습니다. 목표 입력을 바꾸면 목표 달성 계산부터 다시 실행해 주세요.
        </p>
      </details>
    </section>
  );
}
