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
      setError(e instanceof Error ? e.message : "백업 처리에 실패했습니다.");
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
      <h2 id="backup-heading">백업과 복원</h2>
      <p>
        기록을 JSON 파일로 저장하고 다른 브라우저로 옮길 수 있습니다. 파일에는 금융 기록이
        포함되므로 안전한 곳에 보관해 주세요.
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
            link.download = "fire-dashboard-backup-v4.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage("백업 다운로드를 시작했습니다. 저장 위치에서 파일을 확인해 주세요.");
          })
        }
      >
        JSON 백업 저장
      </button>
      <label>
        복원할 JSON 파일
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
                  throw new Error("파일 크기는 32 MiB 이하여야 합니다.");
                const backup = parseBackup(await file.text());
                setPreview(backup);
              });
          }}
        />
      </label>
      <p className="field-hint">
        최대 32 MiB. 기존 기록은 삭제하거나 덮어쓰지 않습니다. 같은 기록은 중복 등록하지 않으며,
        값이 다르거나 월이 중복되면 전체 복원을 취소합니다. 전체 복원에는 비어 있는 브라우저를
        사용해 주세요.
      </p>
      {preview && (
        <div className="backup-preview">
          <h3>복원 내용 확인</h3>
          <p>
            계좌 {preview.accounts.length}개 / 현금 수입·지출 {preview.monthlyCashFlows.length}개 /
            잔액 {preview.accountBalanceSnapshots.length}개 / FIRE 계획{" "}
            {preview.firePlan ? "1개" : "없음"} / 목표 계획 {preview.goalPlan ? "1개" : "없음"}
          </p>
          <p>
            FIRE 계획 입력과 비교, 목표 계획 입력도 포함합니다. 복원 후 월별 기록과 FIRE 화면을 다시
            불러옵니다.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const added = await repository.importBackup(preview);
                setPreview(null);
                setMessage(`${added}개를 추가했습니다. 기존 기록은 보존됩니다.`);
                onImported();
              })
            }
          >
            확인한 기록 가져오기
          </button>
          <button disabled={busy} onClick={() => setPreview(null)}>
            가져오기 취소
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
