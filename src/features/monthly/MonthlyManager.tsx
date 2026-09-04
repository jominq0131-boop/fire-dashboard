import { useEffect, useRef, useState } from "react";
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
}: {
  repository: MonthlyRepository;
  accountsRepository: AccountRepository;
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
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [dirtyCash, setDirtyCash] = useState(false);
  const [dirtyBalances, setDirtyBalances] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const running = useRef(false);
  const dirty = dirtyCash || dirtyBalances.size > 0;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function load() {
    if (running.current) return;
    if (dirty && !window.confirm("未保存の入力を破棄して読み込みますか？")) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      assertMonth(month);
      const nextAccounts = await accountsRepository.list();
      const next = await repository.readMonth(month);
      setAccounts(nextAccounts);
      setRecords(next);
      setLoaded(month);
      setCash({
        income: next.cash ? String(next.cash.income) : "",
        expenses: next.cash ? String(next.cash.expenses) : "",
        investmentContribution: next.cash ? String(next.cash.investmentContribution) : "",
        note: next.cash?.note ?? "",
      });
      setBalances(Object.fromEntries(next.balances.map((b) => [b.accountId, String(b.balance)])));
      setDirtyCash(false);
      setDirtyBalances(new Set());
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
      <h2 id="monthly-heading">月別記録</h2>
      <p className="storage-note">
        収入・消費支出・投資への拠出と、口座ごとの月末残高を別々に記録します。空欄は未入力、0は0円です。対象月だけを読み込みます。同期・バックアップはまだありません。
      </p>
      <div className="account-actions">
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
      {loaded === month && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save({ kind: "cash" });
            }}
          >
            <fieldset disabled={busy}>
              <legend>月の現金収支（円）</legend>
              <div className="account-fields">
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
                <label>
                  メモ
                  <textarea
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
          <h3>月末残高（円）</h3>
          <p>
            口座ごとに保存してください。休止中の口座も過去の記録を修正できます。口座を追加した後は「記録を読み込む」で更新してください。
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
                    {account.name}の月末残高
                    <input
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
                  <span>
                    {records.balances.some((b) => b.accountId === account.id)
                      ? "保存済み"
                      : "未記録"}
                    {dirtyBalances.has(account.id) ? "・未保存の変更" : ""}
                  </span>
                  <button type="submit">{account.name}の残高を保存</button>
                </fieldset>
              </form>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
