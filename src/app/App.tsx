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
}: {
  accountRepository: AccountRepository;
  monthlyRepository: MonthlyRepository;
  portfolioRepository: PortfolioRepository;
  backupRepository: BackupRepository;
  firePlanRepository: FirePlanRepository;
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
        本文へ移動
      </a>
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="FIRE ホーム">
          <span className="brand-mark">
            <Icon name="mark" />
          </span>
          <span>
            fire<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="sidebar-label">PERSONAL FINANCE</div>
        <nav aria-label="メインナビゲーション">
          <a href="#overview" aria-current={active === "#overview" ? "location" : undefined}>
            <Icon name="home" />
            概要
          </a>
          <a href="#monthly" aria-current={active === "#monthly" ? "location" : undefined}>
            <Icon name="calendar" />
            月別記録
          </a>
          <a href="#accounts" aria-current={active === "#accounts" ? "location" : undefined}>
            <Icon name="wallet" />
            口座管理
          </a>
          <a href="#backup" aria-current={active === "#backup" ? "location" : undefined}>
            <Icon name="lock" />
            バックアップ
          </a>
          <a href="#fire" aria-current={active === "#fire" ? "location" : undefined}>
            <Icon name="spark" /> FIRE試算
          </a>
        </nav>
        <div className="sidebar-bottom">
          <Icon name="lock" />
          <div>
            あなたの端末に保存<span>プライベートな資産ノート</span>
          </div>
        </div>
      </aside>
      <main id="main-content" className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <p className="page-kicker">YOUR FINANCIAL COMPASS</p>
            <h1 aria-label="FIRE Dashboard">資産を、もっと自分らしく。</h1>
          </div>
          <span className="status-badge">
            <span />
            端末内保存<span className="trial-label">試用版</span>
          </span>
        </header>
        <section id="overview" aria-labelledby="overview-heading" className="overview-section">
          <div className="page-heading">
            <div>
              <h2 id="overview-heading">資産と、これから。</h2>
              <p>毎月の記録を、ひとつの場所に。</p>
            </div>
            <a className="text-link" href="#monthly">
              今月を記録する <Icon name="arrow" />
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
              <span className="step-indicator">記録を忘れても、ここから再開</span>
              <h2 aria-label="金融記録を月ごとに残しましょう">
                <span>金融記録を</span>
                <span>月ごとに残しましょう</span>
              </h2>
              <p>
                過去の残高を思い出せなくても大丈夫。
                <br />
                確認できる日の残高から続けられます。
              </p>
              <a className="primary-link" href="#monthly">
                今日から記録を続ける <Icon name="arrow" />
              </a>
              <a className="start-footnote" href="#fire">
                目標までの期間を試算する
              </a>
            </article>
          </div>
        </section>
        <div className="workspace-heading">
          <h2>記録する</h2>
          <span>金額はすべて日本円</span>
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
            <strong>あなたの記録は、この端末に。</strong>
            <p>
              自動同期はありません。ブラウザーのデータを削除すると記録も失われます。JSONバックアップを定期的に保存してください。
            </p>
          </div>
          <span>FIRE / PERSONAL FINANCE</span>
        </footer>
      </main>
    </div>
  );
}
