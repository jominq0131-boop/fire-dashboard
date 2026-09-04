import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AccountError,
  MAX_ACCOUNTS,
  MAX_ACCOUNT_NAME_LENGTH,
  type AccountRepository,
} from "../../domain/accounts";
import { accountCategories, type AccountCategory, type AssetAccount } from "../../domain/models";

const labels: Record<AccountCategory, string> = {
  cash: "現金・預金",
  nisa_tsumitate: "NISA つみたて投資枠",
  nisa_growth: "NISA 成長投資枠",
  taxable: "課税口座",
  other: "その他",
};
const errorMessage = (error: unknown) =>
  error instanceof AccountError
    ? error.message
    : "保存処理を完了できませんでした。入力内容を控えて、再読み込みしてください。";

export function AccountManager({
  repository,
  onChanged,
  revision = 0,
}: {
  repository: AccountRepository;
  onChanged?: () => void;
  revision?: number;
}) {
  const [accounts, setAccounts] = useState<AssetAccount[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<AssetAccount | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AccountCategory>("cash");
  const saving = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    repository
      .list()
      .then((items) => {
        if (!cancelled) {
          setAccounts(items);
          setReady(true);
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(errorMessage(failure));
      });
    return () => {
      cancelled = true;
    };
  }, [repository, revision]);

  function resetForm() {
    setEditing(null);
    setName("");
    setCategory("cash");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !ready) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const details = { name, category, isActive: editing?.isActive ?? true };
      const saved = editing
        ? await repository.update(editing, details)
        : await repository.create(details);
      setAccounts((items) =>
        editing ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved],
      );
      onChanged?.();
      resetForm();
      setNotice("口座をこの端末に保存しました。");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function toggle(account: AssetAccount) {
    if (saving.current || !ready) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await repository.update(account, { ...account, isActive: !account.isActive });
      setAccounts((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      onChanged?.();
      setNotice(
        saved.isActive ? "口座を再開しました。" : "口座を休止しました。データは保持されています。",
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="account-panel" aria-labelledby="accounts-heading" aria-busy={busy}>
      <div className="section-heading">
        <div>
          <p className="section-kicker">YOUR ACCOUNTS</p>
          <h2 id="accounts-heading">口座を管理</h2>
        </div>
        <span>
          {error && !ready
            ? "読み込み不可"
            : ready
              ? `${accounts.filter((account) => account.isActive).length} 件の利用中口座`
              : "読み込み中"}
        </span>
      </div>
      <p className="panel-description">記録する口座を、ここで管理。</p>
      <details className="storage-details">
        <summary>保存と口座について</summary>
        <p>
          このブラウザーにのみ保存されます。自動同期はありません。バックアップ画面でJSONを保存できます。口座番号は入力しないでください。口座は休止中を含め
          {MAX_ACCOUNTS}件まで。上限でも既存の口座は編集でき、自動削除はしません。
        </p>
      </details>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <p role="status" className="save-notice">
        {notice}
      </p>
      {!ready && !error && <p>保存済みの口座を読み込んでいます…</p>}
      <form className="account-create-form" onSubmit={(event) => void save(event)}>
        <fieldset disabled={!ready || busy}>
          <legend>{editing ? "口座を編集" : "口座を追加"}</legend>
          <div className="account-fields">
            <label htmlFor="account-name">
              口座名
              <input
                id="account-name"
                ref={nameInput}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={MAX_ACCOUNT_NAME_LENGTH}
                required
                placeholder="例：生活用の口座"
                autoComplete="off"
              />
            </label>
            <label htmlFor="account-category">
              口座の種類
              <select
                id="account-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as AccountCategory)}
              >
                {accountCategories.map((value) => (
                  <option key={value} value={value}>
                    {labels[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="account-actions">
            <button type="submit" disabled={!editing && accounts.length >= MAX_ACCOUNTS}>
              {busy ? "保存中…" : editing ? "変更を保存" : "口座を追加"}
            </button>
            {editing && (
              <button className="secondary" type="button" onClick={resetForm}>
                編集をやめる
              </button>
            )}
          </div>
        </fieldset>
      </form>
      {ready && accounts.length === 0 && <p>口座はまだ登録されていません。</p>}
      <ul className="account-list">
        {accounts.map((account) => (
          <li key={account.id}>
            <div className="account-identity">
              <span className="account-avatar" aria-hidden="true">
                {account.name.slice(0, 1)}
              </span>
              <div>
                <strong>{account.name}</strong>
                <p>
                  {labels[account.category]} · {account.isActive ? "利用中" : "休止中"}
                </p>
              </div>
            </div>
            <div className="account-actions">
              <button
                className="secondary"
                type="button"
                disabled={busy || editing !== null}
                aria-label={`${account.name}を編集`}
                onClick={() => {
                  setEditing(account);
                  setName(account.name);
                  setCategory(account.category);
                  setError("");
                  setNotice("");
                  nameInput.current?.focus();
                }}
              >
                編集
              </button>
              <button
                className="secondary"
                type="button"
                disabled={busy || editing !== null}
                aria-label={`${account.name}を${account.isActive ? "休止" : "再開"}`}
                onClick={() => void toggle(account)}
              >
                {account.isActive ? "休止" : "再開"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
