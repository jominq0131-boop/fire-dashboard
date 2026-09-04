## Milestone 9 — comparison and layout

ScenarioComparison holds at most three immutable assumption/result snapshots from the existing calculation. Parent edits invalidate only the current result; removal affects only a comparison item. No automatic recalculation or storage writes. A shared UI formatter keeps arrival/overflow labels consistent. CSS defines shrinkable tracks, separate account/name/action areas, tabular numeric text, fixed table columns with local keyboard-accessible scrolling, and bounded responsive control dimensions. Text may wrap vertically; values are not truncated or silently hidden to fit a fixed height.

## Milestone 8 — scenario boundary

FirePlanner receives PortfolioRepository and reads only on explicit user action, reusing bounded overview queries. It writes no data. React state holds assumptions and results; no localStorage or new persistence adapter is used. Edits clear the previous result; a failed read preserves input and shows the error. domain/fire.ts is a pure bounded projection with BigInt monthly arithmetic. No new dependency, service, or storage architecture change.

## Everyday balance recording

CurrentAssets is separate from the single-month MetricsSource. Overview reads each account through the new accountMonth reverse index and returns at most one current balance per account. Account/date provenance travels with the amount. Its combined read stays in the overview transaction. At most two index cursor rows per account are examined: a future day in the cutoff month may require skipping to the previous month. Calendar validation ensures earlier months cannot also exceed the cutoff.

Today navigation defaults observation date to local today, focuses the selected account, and preserves the existing unsaved-draft confirmation. General month navigation restores the recorded date. Balance entry comes before cash flow; the monthly summary no longer precedes the entry form. Commit-only UI updates, conflict protection, failed-draft preservation, backup boundaries and injection remain.

## Milestone 7 overview and backup

PortfolioRepository and BackupRepository are separate injected contracts. IndexedDbPortfolioRepository reuses the existing DB v2 opener and indexes. Overview counts all stores first, reads at most 100 accounts and 1200 range balances plus a separate latest month of at most 100. The latest month is found with a reverse key cursor bounded by the local current month; one readonly transaction makes each overview consistent. No accumulated balance or implicit carry-forward is computed. AssetOverview loads automatically and refreshes after committed writes/imports; explicit refresh covers other tabs. Monthly selection uses a guarded navigation handle, retaining the existing unsaved-draft confirmation.

Backup snapshots cursor through the three stores in one transaction with record and UTF-8 byte caps. Import validates before opening a write transaction, reads current records within that transaction, checks conflicts/caps, and adds only missing records. All stores commit or abort together. No clear/delete/put, network upload, new DB version or external dependency is introduced. Export is coherent and import does not overwrite concurrent writes. See milestone-7-plan.md for limits and semantics.

## Milestone 6 derived dashboard

MonthlyManager publishes only its loaded month, bounded account list and committed monthly records through an injected callback. App passes that snapshot to MonthlyOverview; no additional history queries, storage writes or adapter dependencies are introduced. Month changes and failed reads invalidate the summary; failed writes retain the last committed values. Account changes and other tabs require explicit rereading, as stated in the UI. metrics.ts computes derived values without persistence.

# Architecture

계좌 목록/생성은 같은 트랜잭션에서 count를 검사한 뒤 `getAll(undefined, 100)`으로 제한 조회한다. 생성까지 같은 readwrite 트랜잭션이므로 동시 등록도 상한을 지킨다. 초과 저장소는 전체 객체를 읽지 않고 오류로 중단·보존한다. 앱 생성 객체는 길이가 제한된 5필드이고 UI도 100건 이내다. 후속 월별 조회는 기간/인덱스 기반으로 별도 설계한다. [자원 안전 정책](resource-safety.md)을 따른다.

## MVP decision

MVP는 GitHub Pages에서 제공되는 정적 React 앱이며, 개인 데이터는 각 기기의 IndexedDB에 저장한다. 자동 기기 동기화는 구현하지 않는다. 전체 데이터는 버전 관리되는 JSON으로 내보내고 가져올 수 있어야 한다.

## Boundaries

```text
src/app             application bootstrap and shared UI
src/features        feature UI and orchestration
src/domain          financial rules, validation, migrations; no UI/storage imports
src/infrastructure  persistence and external-service adapters
```

향후 동기화는 `infrastructure`의 저장소 구현을 추가하는 방식으로 도입한다. UI와 도메인 코드는 특정 데이터베이스나 클라우드 서비스에 직접 의존하지 않는다.

## Privacy

GitHub 저장소와 GitHub Pages에는 실제 개인 금융 데이터를 두지 않는다. `.gitignore`는 일반적인 개인 백업·로컬 데이터 경로를 제외하지만, 커밋 전 점검 책임을 대체하지는 않는다.

## Milestone 4 account storage

- `src/domain/accounts.ts`: 계좌 검증과 저장소 인터페이스. React/브라우저에 의존하지 않는다.
- `src/domain/storage-migrations.ts`: 버전 0 → 1의 순수하고 결정론적인 초기 스키마 계획.
- `src/infrastructure/indexeddb-accounts.ts`: 계획을 IndexedDB 업그레이드 트랜잭션에 적용하고 계좌 CRUD 중 생성·조회·수정만 제공한다. 삭제 API는 없다.
- `src/features/accounts/AccountManager.tsx`: 인터페이스를 주입받는 계좌 UI. 저장소 구현을 직접 import하지 않는다.
- `src/main.tsx`: 어댑터를 생성해 App과 기능 UI에 주입하는 조립 지점.

쓰기 성공은 개별 요청 성공이 아니라 트랜잭션 commit 이후에만 반환한다. 생성 시 순서 부여와 저장을 같은 readwrite 트랜잭션으로 실행한다. 수정은 같은 트랜잭션 안에서 UI가 읽은 이전 값과 현재 저장값을 비교하여 다른 탭의 변경을 덮어쓰지 않는다. 충돌 시 입력을 보존하고 재읽기를 안내한다. 탭 간 자동 동기화는 구현하지 않는다.

연결은 작업 완료·실패와 versionchange 시 닫는다. blocked, 버전 불일치, 손상된 계좌, 사용 불가·용량 부족은 실패로 처리하며 저장소를 삭제하거나 빈 데이터로 대체하지 않는다. 초기 실패 때는 쓰기 UI를 비활성화한다.

기존 GitHub Pages/IndexedDB 결정을 유지하며 새 의존성·서버·인증·외부 서비스를 추가하지 않는다.

최초 제안과의 대응, 아직 구현하지 않은 MVP 요구사항, 후속 검증 주의점은 [진행 점검](proposal-alignment.md)을 참고한다. 계좌 저장 기반을 전체 금융 데이터 저장·JSON 백업 완성으로 간주하지 않는다.

## Milestone 5 monthly storage and UI

src/domain/monthly.ts는 월/금액 입력 검증과 저장 레코드 검증, 상한 및 MonthlyRepository 계약을 정의한다. src/infrastructure/indexeddb-monthly.ts는 계좌 어댑터의 공통 DB 열기 함수를 재사용하고 계좌·현금흐름·잔액 저장소를 한 트랜잭션 범위에서 접근한다. 기존 계좌 어댑터도 v2를 연다. UI는 main.tsx에서 주입하는 계약만 사용한다.

읽기는 전역/월별 count를 검사한 뒤 month 인덱스로 현금흐름 1개, 잔액 100개 이하를 가져온다. 잔액의 계좌 참조도 같은 트랜잭션에서 확인한다. 저장은 전역/월 상한, 기존 값 비교, 계좌 참조를 같은 readwrite 트랜잭션에서 확인하고 commit 이후에 성공을 반환한다. 실패·손상·상한 초과는 원본을 삭제/부분 표시하지 않는다. 고유 인덱스는 같은 월 또는 월/계좌의 중복을 막는다.

MonthlyManager는 선택 월을 명시적으로 읽고 현금흐름과 각 계좌 잔액을 별도 저장한다. 실패하면 입력을 유지하며 월 전환/재읽기/페이지 이탈 시 미저장 입력을 경고한다. 계좌 등록 후 명시적 재읽기로 목록을 갱신한다. 자동 탭 동기화와 전체 이력 조회는 없다. 지표/차트는 미구현임을 표시한다.

## UI presentation — Issue #19

App organizes overview and the existing feature managers with anchor navigation. Desktop uses a sidebar and two feature columns; mobile uses a compact top navigation and one column. Features stay mounted during navigation so drafts are preserved. Icon.tsx supplies small inline SVG UI icons without external assets or dependencies. Presentation CSS includes visible keyboard focus, reduced-motion handling and responsive form widths. Persistence and domain boundaries are unchanged.
