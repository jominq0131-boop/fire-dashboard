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
      <p role="alert">차트를 표시할 수 없습니다. 입력 내용을 저장한 뒤 새로고침해 주세요.</p>
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
            차트를 준비하는 중…
          </div>
        }
      >
        <FinancialChart {...props} />
      </Suspense>
    </ChartBoundary>
  );
}
