import { useEffect, useState } from "react";
import type { MonthlyRepository } from "../domain/monthly";
import { MonthlyManager } from "../features/monthly/MonthlyManager";
import type { AccountRepository } from "../domain/accounts";
import { AccountManager } from "../features/accounts/AccountManager";
import type { MetricsSource } from "../domain/metrics";
import { MonthlyOverview } from "../features/monthly/MonthlyOverview";
import { Icon } from "./Icon";

export function App({
  accountRepository,
  monthlyRepository,
}: {
  accountRepository: AccountRepository;
  monthlyRepository: MonthlyRepository;
}) {
  const [summary, setSummary] = useState<MetricsSource | null>(null);
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
        <div className="sidebar-label">YOUR SPACE</div>
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
            <p className="page-kicker">MY FINANCE</p>
            <h1>FIRE Dashboard</h1>
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
            <MonthlyOverview source={summary} />
            <article className="start-card">
              <span className="step-indicator">小さく続ける、資産管理</span>
              <h2 aria-label="金融記録を月ごとに残しましょう">
                <span>金融記録を</span>
                <span>月ごとに残しましょう</span>
              </h2>
              <p>
                口座を登録して、ひと月ずつ。
                <br />
                収支と月末残高を分けて記録できます。
              </p>
              <a className="primary-link" href="#monthly">
                月別記録をはじめる <Icon name="arrow" />
              </a>
              <span className="start-footnote">チャート・FIRE予測は今後追加予定</span>
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
              onSummary={setSummary}
            />
          </div>
          <div id="accounts">
            <AccountManager repository={accountRepository} />
          </div>
        </div>
        <footer id="storage-info" className="page-footer">
          <Icon name="lock" />
          <div>
            <strong>あなたの記録は、この端末に。</strong>
            <p>
              同期・バックアップはまだありません。ブラウザーのデータを削除すると記録も失われます。現在は試用版としてお使いください。
            </p>
          </div>
          <span>FIRE / PERSONAL FINANCE</span>
        </footer>
      </main>
    </div>
  );
}
