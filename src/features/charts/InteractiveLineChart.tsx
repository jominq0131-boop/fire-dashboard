import { Component, lazy, Suspense, type ComponentProps, type ReactNode } from "react";
const FinancialChart = lazy(() => import("./FinancialChart"));
export type { ChartSeries } from "./FinancialChart";
class ChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">
        チャートを表示できません。入力内容を保存してからページを再読み込みしてください。
      </p>
    ) : (
      this.props.children
    );
  }
}
export function InteractiveLineChart(props: ComponentProps<typeof FinancialChart>) {
  return (
    <ChartBoundary>
      <Suspense
        fallback={
          <div className="chart-loading" aria-busy="true">
            チャートを準備しています…
          </div>
        }
      >
        <FinancialChart {...props} />
      </Suspense>
    </ChartBoundary>
  );
}
