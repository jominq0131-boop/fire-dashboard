import type { GoalPlanRepository } from "../domain/goal-plan";
import { useEffect, useState, useCallback, useRef } from "react";
import type { MonthlyRepository } from "../domain/monthly";
import { MonthlyManager } from "../features/monthly/MonthlyManager";
import type { AccountRepository } from "../domain/accounts";
import { AccountManager } from "../features/accounts/AccountManager";
import type { MetricsSource } from "../domain/metrics";
import { MonthlyOverview } from "../features/monthly/MonthlyOverview";
import { AssetOverview } from "../features/monthly/AssetOverview";
import { BackupManager } from "../features/backup/BackupManager";
import type { PortfolioRepository } from "../domain/portfolio";
import type { BackupRepository } from "../domain/backup";
import type { FirePlanRepository } from "../domain/fire-plan";
import { Icon } from "./Icon";
import { FirePlanner } from "../features/fire/FirePlanner";

export function App({
  accountRepository,
  monthlyRepository,
  portfolioRepository,
  backupRepository,
  firePlanRepository,
  goalPlanRepository,
}: {
  accountRepository: AccountRepository;
  monthlyRepository: MonthlyRepository;
  portfolioRepository: PortfolioRepository;
  backupRepository: BackupRepository;
  firePlanRepository: FirePlanRepository;
  goalPlanRepository: GoalPlanRepository;
}) {
  const [summary, setSummary] = useState<MetricsSource | null>(null);
  const fireRef = useRef<{ useAssets: (value: number, source: string) => boolean }>(null);
  const [revision, setRevision] = useState(0);
  const [importRevision, setImportRevision] = useState(0);
  const navigationRef = useRef<{
    openMonth: (month: string) => void;
    openToday: (accountId?: string) => void;
  }>(null);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const publish = useCallback((source: MetricsSource | null) => {
    setSummary(source);
    if (source) setRevision((n) => n + 1);
  }, []);
  const [active, setActive] = useState(() => window.location.hash || "#overview");
  useEffect(() => {
    const update = () => setActive(window.location.hash || "#overview");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="FIRE 홈">
          <span className="brand-mark">
            <Icon name="mark" />
          </span>
          <span>
            fire<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="sidebar-label">개인 자산 관리</div>
        <nav aria-label="주 메뉴">
          <a href="#overview" aria-current={active === "#overview" ? "location" : undefined}>
            <Icon name="home" />
            개요
          </a>
          <a href="#monthly" aria-current={active === "#monthly" ? "location" : undefined}>
            <Icon name="calendar" />
            월별 기록
          </a>
          <a href="#accounts" aria-current={active === "#accounts" ? "location" : undefined}>
            <Icon name="wallet" />
            계좌 관리
          </a>
          <a href="#backup" aria-current={active === "#backup" ? "location" : undefined}>
            <Icon name="lock" />
            백업
          </a>
          <a href="#fire" aria-current={active === "#fire" ? "location" : undefined}>
            <Icon name="spark" /> FIRE 계산
          </a>
        </nav>
        <div className="sidebar-bottom">
          <Icon name="lock" />
          <div>
            내 기기에 저장<span>나만의 자산 노트</span>
          </div>
        </div>
      </aside>
      <main id="main-content" className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <p className="page-kicker">나의 자산 나침반</p>
            <h1 aria-label="FIRE 대시보드">나에게 맞는 자산 관리.</h1>
          </div>
          <span className="status-badge">
            <span />
            기기 내 저장<span className="trial-label">시험 버전</span>
          </span>
        </header>
        <section id="overview" aria-labelledby="overview-heading" className="overview-section">
          <div className="page-heading">
            <div>
              <h2 id="overview-heading">자산과 앞으로의 삶.</h2>
              <p>매달의 기록을 한곳에.</p>
            </div>
            <a className="text-link" href="#monthly">
              이번 달 기록하기 <Icon name="arrow" />
            </a>
          </div>
          <div className="overview-grid">
            <AssetOverview
              onForecast={(value, source) => {
                if (fireRef.current?.useAssets(value, source)) window.location.hash = "fire";
              }}
              onRecordToday={(accountId) => {
                navigationRef.current?.openToday(accountId);
                window.location.hash = "monthly";
              }}
              repository={portfolioRepository}
              revision={revision}
              onSelectMonth={(month) => {
                navigationRef.current?.openMonth(month);
                window.location.hash = "monthly";
              }}
            />
            <article className="start-card">
              <span className="step-indicator">기록을 놓쳤어도 여기서 다시 시작</span>
              <h2 aria-label="금융 기록을 월별로 남겨 보세요">
                <span>금융 기록을</span>
                <span>월별로 남겨 보세요</span>
              </h2>
              <p>
                과거 잔액이 기억나지 않아도 괜찮아요.
                <br />
                확인할 수 있는 날의 잔액부터 이어 가세요.
              </p>
              <a className="primary-link" href="#monthly">
                오늘부터 기록 이어가기 <Icon name="arrow" />
              </a>
              <a className="start-footnote" href="#fire">
                목표까지 걸리는 기간 계산
              </a>
            </article>
          </div>
        </section>
        <div className="workspace-heading">
          <h2>기록하기</h2>
          <span>모든 금액은 일본 엔화</span>
        </div>
        <div className="workspace-grid">
          <div id="monthly">
            <MonthlyManager
              repository={monthlyRepository}
              accountsRepository={accountRepository}
              onSummary={publish}
              navigationRef={navigationRef}
            />
            <MonthlyOverview source={summary} />
          </div>
          <div id="accounts">
            <AccountManager
              repository={accountRepository}
              onChanged={refresh}
              revision={importRevision}
            />
          </div>
        </div>
        <FirePlanner
          repository={portfolioRepository}
          firePlanRepository={firePlanRepository}
          goalPlanRepository={goalPlanRepository}
          navigationRef={fireRef}
          revision={importRevision}
        />
        <BackupManager
          repository={backupRepository}
          onImported={() => {
            refresh();
            setImportRevision((n) => n + 1);
          }}
        />
        <footer id="storage-info" className="page-footer">
          <Icon name="lock" />
          <div>
            <strong>내 기록은 이 기기에 저장됩니다.</strong>
            <p>
              자동 동기화는 지원하지 않습니다. 브라우저 데이터를 삭제하면 기록도 사라집니다. JSON
              백업을 주기적으로 저장해 주세요.
            </p>
          </div>
          <span>FIRE / 개인 자산 관리</span>
        </footer>
      </main>
    </div>
  );
}
