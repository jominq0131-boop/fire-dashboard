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
    if (dirty && !window.confirm("未保存の入力を破棄して読み込みますか？")) return;
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
      setError(e instanceof Error ? e.message : "読込に失敗しました。");
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
      setMessage("月別記録を保存しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました。入力は保持しています。");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="account-panel monthly-panel" aria-labelledby="monthly-heading">
      <div className="section-heading">
        <div>
          <p className="section-kicker">MONTHLY NOTE</p>
          <h2 id="monthly-heading">月別記録</h2>
        </div>
        <span className="subtle-badge">{loaded === month ? "編集中の月" : "月を選択"}</span>
      </div>
      <p className="storage-note">
        思い出せない月は空欄のままで大丈夫です。確認できた日の残高から続けましょう。0円と未記録は区別します。
      </p>
      <div className="month-toolbar">
        <label>
          対象月
          <input
            type="month"
            min="1900-01"
            max="2199-12"
            value={month}
            disabled={busy}
            onChange={(e) => {
              if (dirty && !window.confirm("未保存の入力を破棄して月を変更しますか？")) return;
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
          {busy ? "処理中…" : "記録を読み込む"}
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
            <span>MONTHLY NOTE</span>
            <strong>{month.slice(-2) || "—"}</strong>
            <i />
          </div>
          <h3>ひと月の記録をひらく</h3>
          <p>
            対象月を選んで「記録を読み込む」を押すと、
            <br />
            収支と口座ごとの残高を入力できます。
          </p>
        </div>
      )}
      {loaded === month && (
        <>
          <div className="balance-heading">
            <h3>確認した残高（円）</h3>
            <span>口座ごとに保存</span>
          </div>
          <p className="field-hint">
            銀行・証券アプリで確認した日と金額を入力します。月末を忘れたときは履歴・明細を確認するか、過去は空欄のまま今日から再開できます。1口座につき月1件を保存し、同じ月の再入力は更新になります。
          </p>
          {accounts.length === 0 && <p>先に口座を登録してください。</p>}
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
                    {!account.isActive && "（休止中）"}
                  </legend>
                  <label>
                    残高
                    <input
                      aria-label={`${account.name}の残高`}
                      id={"balance-" + account.id}
                      placeholder="未入力"
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
                    確認日
                    <input
                      aria-label={`${account.name}の確認日`}
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
                    {records.balances.some((b) => b.accountId === account.id)
                      ? "保存済み"
                      : "未記録"}
                    {dirtyBalances.has(account.id) ? "・未保存の変更" : ""}
                  </span>
                  <button type="submit" aria-label={`${account.name}の残高を保存`}>
                    残高を保存
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
              <legend>月の現金収支（円）</legend>
              <p className="field-hint">投資への拠出は、消費支出と分けて記録します。</p>
              <div className="account-fields cash-fields">
                {(
                  [
                    ["income", "収入"],
                    ["expenses", "消費支出"],
                    ["investmentContribution", "投資への拠出"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      placeholder="未入力"
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
                  メモ
                  <textarea
                    placeholder="今月、残しておきたいこと（任意）"
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
              <button type="submit">現金収支を保存</button>
            </fieldset>
          </form>
        </>
      )}
    </section>
  );
}
