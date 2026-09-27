import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AccountError,
  MAX_ACCOUNTS,
  MAX_ACCOUNT_NAME_LENGTH,
  type AccountRepository,
} from "../../domain/accounts";
import { accountCategories, type AccountCategory, type AssetAccount } from "../../domain/models";

const labels: Record<AccountCategory, string> = {
  cash: "현금·예금",
  nisa_tsumitate: "NISA 적립투자 한도",
  nisa_growth: "NISA 성장투자 한도",
  taxable: "과세 계좌",
  other: "기타",
};
const errorMessage = (error: unknown) =>
  error instanceof AccountError
    ? error.message
    : "저장을 완료하지 못했습니다. 입력 내용을 따로 보관한 뒤 새로고침해 주세요.";

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
      setNotice("계좌를 이 기기에 저장했습니다.");
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
        saved.isActive
          ? "계좌 사용을 재개했습니다."
          : "계좌 사용을 중지했습니다. 데이터는 보존됩니다.",
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
          <p className="section-kicker">내 계좌</p>
          <h2 id="accounts-heading">계좌 관리</h2>
        </div>
        <span>
          {error && !ready
            ? "불러오기 실패"
            : ready
              ? `${accounts.filter((account) => account.isActive).length}개의 사용 중인 계좌`
              : "불러오는 중"}
        </span>
      </div>
      <p className="panel-description">기록할 계좌를 여기서 관리하세요.</p>
      <details className="storage-details">
        <summary>저장과 계좌 안내</summary>
        <p>
          이 브라우저에만 저장되며 자동 동기화는 지원하지 않습니다. 백업 화면에서 JSON을 저장할 수
          있습니다. 계좌번호는 입력하지 마세요. 중지한 계좌를 포함해 최대
          {MAX_ACCOUNTS}개까지 등록할 수 있습니다. 한도에 도달해도 기존 계좌는 편집할 수 있으며
          자동으로 삭제하지 않습니다.
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
      {!ready && !error && <p>저장된 계좌를 불러오는 중…</p>}
      <form className="account-create-form" onSubmit={(event) => void save(event)}>
        <fieldset disabled={!ready || busy}>
          <legend>{editing ? "계좌 편집" : "계좌 추가"}</legend>
          <div className="account-fields">
            <label htmlFor="account-name">
              계좌명
              <input
                id="account-name"
                ref={nameInput}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={MAX_ACCOUNT_NAME_LENGTH}
                required
                placeholder="예: 생활비 계좌"
                autoComplete="off"
              />
            </label>
            <label htmlFor="account-category">
              계좌 종류
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
              {busy ? "저장 중…" : editing ? "변경 저장" : "계좌 추가"}
            </button>
            {editing && (
              <button className="secondary" type="button" onClick={resetForm}>
                편집 취소
              </button>
            )}
          </div>
        </fieldset>
      </form>
      {ready && accounts.length === 0 && <p>등록된 계좌가 없습니다.</p>}
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
                  {labels[account.category]} · {account.isActive ? "사용 중" : "사용 중지"}
                </p>
              </div>
            </div>
            <div className="account-actions">
              <button
                className="secondary"
                type="button"
                disabled={busy || editing !== null}
                aria-label={`${account.name} 편집`}
                onClick={() => {
                  setEditing(account);
                  setName(account.name);
                  setCategory(account.category);
                  setError("");
                  setNotice("");
                  nameInput.current?.focus();
                }}
              >
                편집
              </button>
              <button
                className="secondary"
                type="button"
                disabled={busy || editing !== null}
                aria-label={`${account.name} ${account.isActive ? "사용 중지" : "사용 재개"}`}
                onClick={() => void toggle(account)}
              >
                {account.isActive ? "사용 중지" : "사용 재개"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
