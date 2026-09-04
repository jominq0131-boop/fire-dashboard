import { useRef, useState } from "react";
import {
  canonical,
  MAX_BACKUP_BYTES,
  parseBackup,
  type Backup,
  type BackupRepository,
} from "../../domain/backup";

export function BackupManager({
  repository,
  onImported,
}: {
  repository: BackupRepository;
  onImported: () => void;
}) {
  const [preview, setPreview] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const running = useRef(false);
  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "バックアップ処理に失敗しました。");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      id="backup"
      className="account-panel backup-panel"
      aria-labelledby="backup-heading"
      aria-busy={busy}
    >
      <h2 id="backup-heading">バックアップと復元</h2>
      <p>
        記録をJSONファイルとして保存し、別のブラウザーへ移せます。ファイルには金融記録が含まれます。安全な場所に保管してください。
      </p>
      <button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const backup = await repository.exportBackup();
            const url = URL.createObjectURL(
              new Blob([canonical(backup)], { type: "application/json" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "fire-dashboard-backup-v2.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage(
              "バックアップのダウンロードを開始しました。保存先でファイルを確認してください。",
            );
          })
        }
      >
        JSONバックアップを保存
      </button>
      <label>
        復元するJSONファイル
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            setPreview(null);
            e.target.value = "";
            if (file)
              void run(async () => {
                if (file.size > MAX_BACKUP_BYTES)
                  throw new Error("ファイルは32 MiB以内にしてください。");
                const backup = parseBackup(await file.text());
                setPreview(backup);
              });
          }}
        />
      </label>
      <p className="field-hint">
        最大32
        MiB。既存の記録は削除・上書きしません。同一の記録は重複登録せず、異なる値や月の重複があれば全体を取り消します。完全な復元には空のブラウザーを使ってください。
      </p>
      {preview && (
        <div className="backup-preview">
          <h3>復元内容の確認</h3>
          <p>
            口座 {preview.accounts.length} 件 / 現金収支 {preview.monthlyCashFlows.length} 件 / 残高{" "}
            {preview.accountBalanceSnapshots.length} 件
          </p>
          <p>未保存の入力は含まれません。復元後は月別記録を読み込み直してください。</p>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const added = await repository.importBackup(preview);
                setPreview(null);
                setMessage(`${added} 件を追加しました。既存の記録は保持されています。`);
                onImported();
              })
            }
          >
            確認した記録を取り込む
          </button>
          <button disabled={busy} onClick={() => setPreview(null)}>
            取り込みをキャンセル
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
