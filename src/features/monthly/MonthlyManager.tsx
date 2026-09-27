import { localDate, monthEnd, observationStatus } from "../../domain/observations";
import type { MetricsSource } from "../../domain/metrics";
import { useEffect, useRef, useState, useImperativeHandle, type Ref } from "react";
import type { AccountRepository } from "../../domain/accounts";
import type { AssetAccount } from "../../domain/models";
import {
  assertMonth,
  parseYen,
  type MonthlyRepository,
  type MonthRecords,
} from "../../domain/monthly";
const initialMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
export function MonthlyManager({
  repository,
  accountsRepository,
  onSummary,
  navigationRef,
}: {
  repository: MonthlyRepository;
  accountsRepository: AccountRepository;
  onSummary: (source: MetricsSource | null) => void;
  navigationRef?: Ref<{
    openMonth: (month: string) => void;
    openToday: (accountId?: string) => void;
  }>;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [records, setRecords] = useState<MonthRecords>({ cash: null, balances: [] });
  const [accounts, setAccounts] = useState<AssetAccount[]>([]);
  const [cash, setCash] = useState({
    income: "",
    expenses: "",
    investmentContribution: "",
    note: "",
  });
  const [dates, setDates] = useState<Record<string, string>>({});
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [dirtyCash, setDirtyCash] = useState(false);
  const [dirtyBalances, setDirtyBalances] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const running = useRef(false);
  useEffect(() => {
    onSummary(loaded === month ? { month, accounts, records } : null);
  }, [loaded, month, accounts, records, onSummary]);
  const dirty = dirtyCash || dirtyBalances.size > 0;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useImperativeHandle(navigationRef, () => ({
    openToday: (accountId?: string) => {
      void load(localDate().slice(0, 7), true).then((ok) => {
        if (ok && accountId)
          setTimeout(() => document.getElementById("balance-" + accountId)?.focus(), 0);
      });
    },
    openMonth: (next: string) => {
      void load(next);
    },
  }));
  async function load(targetMonth = month, recordToday = false) {
    if (running.current) return;
    if (dirty && !window.confirm("저장하지 않은 입력을 버리고 불러올까요?")) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setLoaded(null);
      assertMonth(targetMonth);
      setMonth(targetMonth);
      const nextAccounts = await accountsRepository.list();
      const next = await repository.readMonth(targetMonth);
      setAccounts(nextAccounts);
      setRecords(next);
      setLoaded(targetMonth);
      setCash({
        income: next.cash ? String(next.cash.income) : "",
        expenses: next.cash ? String(next.cash.expenses) : "",
        investmentContribution: next.cash ? String(next.cash.investmentContribution) : "",
        note: next.cash?.note ?? "",
      });
      setDates(
        Object.fromEntries(
          nextAccounts.map((a) => {
            const saved = next.balances.find((b) => b.accountId === a.id);
            return [
              a.id,
              recordToday
                ? localDate()
                : (saved?.asOfDate ??
                  (saved ? "" : targetMonth === localDate().slice(0, 7) ? localDate() : "")),
            ];
          }),
        ),
      );
      setBalances(Object.fromEntries(next.balances.map((b) => [b.accountId, String(b.balance)])));
      setDirtyCash(false);
      setDirtyBalances(new Set());
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기에 실패했습니다.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function save(target: { kind: "cash" } | { kind: "balance"; accountId: string }) {
    if (loaded !== month || running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (target.kind === "cash") {
        const result = await repository.saveCash(
          month,
          {
            income: parseYen(cash.income),
            expenses: parseYen(cash.expenses),
            investmentContribution: parseYen(cash.investmentContribution),
            note: cash.note,
          },
          records.cash,
        );
        setRecords((previous) => ({ ...previous, cash: result }));
        setDirtyCash(false);
      } else {
        const result = await repository.saveBalance(
          month,
          target.accountId,
          parseYen(Object.hasOwn(balances, target.accountId) ? balances[target.accountId] : ""),
          records.balances.find((b) => b.accountId === target.accountId) ?? null,
          dates[target.accountId] || undefined,
        );
        setRecords((previous) => ({
          ...previous,
          balances: [...previous.balances.filter((b) => b.accountId !== target.accountId), result],
        }));
        setDirtyBalances((previous) => {
          const next = new Set(previous);
          next.delete(target.accountId);
          return next;
        });
      }
      setMessage("월별 기록을 저장했습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다. 입력은 보존됩니다.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="account-panel monthly-panel" aria-labelledby="monthly-heading">
      <div className="section-heading">
        <div>
          <p className="section-kicker">월별 기록</p>
          <h2 id="monthly-heading">월별 기록</h2>
        </div>
        <span className="subtle-badge">{loaded === month ? "편집 중인 월" : "월 선택"}</span>
      </div>
      <p className="storage-note">
        기억나지 않는 월은 빈칸으로 두어도 괜찮습니다. 확인한 날의 잔액부터 이어 가세요. 0엔과
        미기록은 구별합니다.
      </p>
      <div className="month-toolbar">
        <label>
          대상 월
          <input
            type="month"
            min="1900-01"
            max="2199-12"
            value={month}
            disabled={busy}
            onChange={(e) => {
              if (dirty && !window.confirm("저장하지 않은 입력을 버리고 월을 바꿀까요?")) return;
              setMonth(e.target.value);
              setLoaded(null);
              setDirtyCash(false);
              setDirtyBalances(new Set());
              setError("");
              setMessage("");
            }}
          />
        </label>
        <button type="button" disabled={busy} onClick={() => void load()}>
          {busy ? "처리 중…" : "기록 불러오기"}
        </button>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {loaded !== month && (
        <div className="month-empty">
          <div className="calendar-art" aria-hidden="true">
            <span>월별 기록</span>
            <strong>{month.slice(-2) || "—"}</strong>
            <i />
          </div>
          <h3>한 달의 기록 열기</h3>
          <p>
            대상 월을 선택하고 ‘기록 불러오기’를 누르면
            <br />
            수입·지출과 계좌별 잔액을 입력할 수 있습니다.
          </p>
        </div>
      )}
      {loaded === month && (
        <>
          <div className="balance-heading">
            <h3>확인한 잔액(엔)</h3>
            <span>계좌별 저장</span>
          </div>
          <p className="field-hint">
            은행·증권 앱에서 확인한 날짜와 금액을 입력하세요. 월말 기록을 놓쳤다면 거래 내역을
            확인하거나, 과거는 빈칸으로 두고 오늘부터 다시 시작해도 됩니다. 계좌당 월 1건을 저장하며
            같은 월에 다시 입력하면 갱신됩니다.
          </p>
          {accounts.length === 0 && <p>먼저 계좌를 등록해 주세요.</p>}
          <div className="monthly-balances">
            {accounts.map((account) => (
              <form
                key={account.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  void save({ kind: "balance", accountId: account.id });
                }}
              >
                <fieldset disabled={busy}>
                  <legend>
                    {account.name}
                    {!account.isActive && "(사용 중지)"}
                  </legend>
                  <label>
                    잔액
                    <input
                      aria-label={`${account.name} 잔액`}
                      id={"balance-" + account.id}
                      placeholder="미입력"
                      inputMode="numeric"
                      maxLength={16}
                      required
                      value={Object.hasOwn(balances, account.id) ? balances[account.id] : ""}
                      onChange={(e) => {
                        setBalances({ ...balances, [account.id]: e.target.value });
                        setDirtyBalances((previous) => new Set(previous).add(account.id));
                      }}
                    />
                  </label>
                  <label>
                    확인일
                    <input
                      aria-label={`${account.name} 확인일`}
                      type="date"
                      min={month + "-01"}
                      max={monthEnd(month) < localDate() ? monthEnd(month) : localDate()}
                      required={
                        !records.balances.some((b) => b.accountId === account.id && !b.asOfDate)
                      }
                      value={dates[account.id] ?? ""}
                      onChange={(e) => {
                        setDates({ ...dates, [account.id]: e.target.value });
                        setDirtyBalances((previous) => new Set(previous).add(account.id));
                      }}
                    />
                  </label>
                  <p className="field-hint">
                    {observationStatus(
                      records.balances.find((b) => b.accountId === account.id),
                      localDate(),
                    )}
                  </p>
                  <span>
                    {records.balances.some((b) => b.accountId === account.id) ? "저장됨" : "미기록"}
                    {dirtyBalances.has(account.id) ? "·저장하지 않은 변경" : ""}
                  </span>
                  <button type="submit" aria-label={`${account.name} 잔액 저장`}>
                    잔액 저장
                  </button>
                </fieldset>
              </form>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save({ kind: "cash" });
            }}
          >
            <fieldset disabled={busy}>
              <legend>월 현금 수입·지출(엔)</legend>
              <p className="field-hint">투자 납입은 소비 지출과 나누어 기록합니다.</p>
              <div className="account-fields cash-fields">
                {(
                  [
                    ["income", "수입"],
                    ["expenses", "소비 지출"],
                    ["investmentContribution", "투자 납입"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      placeholder="미입력"
                      inputMode="numeric"
                      maxLength={16}
                      required
                      value={cash[key]}
                      onChange={(e) => {
                        setCash({ ...cash, [key]: e.target.value });
                        setDirtyCash(true);
                      }}
                    />
                  </label>
                ))}
                <label className="note-field">
                  메모
                  <textarea
                    placeholder="이번 달 기억할 내용(선택)"
                    rows={2}
                    maxLength={1000}
                    value={cash.note}
                    onChange={(e) => {
                      setCash({ ...cash, note: e.target.value });
                      setDirtyCash(true);
                    }}
                  />
                </label>
              </div>
              <button type="submit">현금 수입·지출 저장</button>
            </fieldset>
          </form>
        </>
      )}
    </section>
  );
}
