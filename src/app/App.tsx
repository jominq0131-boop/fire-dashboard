const summaryMetrics = [
  { label: "金融資産", description: "すべての口座残高の合計" },
  { label: "現金", description: "現金・預金の残高" },
  { label: "投資資産", description: "NISA・特定口座などの残高" },
  { label: "今月の収支", description: "収入から支出と投資額を引いた金額" },
  { label: "資産の増減", description: "前月末からの金融資産の変化" },
  { label: "FIRE達成度", description: "設定したFIRE目標に対する進捗" },
];

export function App() {
  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">PERSONAL FINANCE</p>
          <h1>FIRE Dashboard</h1>
          <p className="subtitle">資産の変化と、FIREまでの道のりを見える化します。</p>
        </div>
        <span className="status-badge">準備中</span>
      </header>

      <section aria-labelledby="summary-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">OVERVIEW</p>
            <h2 id="summary-heading">いまの状況</h2>
          </div>
          <p>記録を追加すると、ここに最新の数字が表示されます。</p>
        </div>
        <div className="metric-grid">
          {summaryMetrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <p>{metric.label}</p>
              <strong aria-label={`${metric.label}: データなし`}>—</strong>
              <span>{metric.description}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="empty-state" aria-labelledby="start-heading">
        <div className="empty-icon" aria-hidden="true">
          ↗
        </div>
        <div>
          <p className="eyebrow">FIRST STEP</p>
          <h2 id="start-heading">まだ金融記録がありません</h2>
          <p>
            次のマイルストーンで口座と月ごとの記録を追加できるようになります。実際のデータを入力すると、資産推移とFIRE進捗がこの画面に反映されます。
          </p>
        </div>
      </section>

      <section className="chart-placeholder" aria-labelledby="trend-heading">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">HISTORY</p>
            <h2 id="trend-heading">資産推移</h2>
          </div>
          <span>データ記録後に表示</span>
        </div>
        <div className="chart-grid" aria-label="資産推移チャートはデータ待ちです">
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}
