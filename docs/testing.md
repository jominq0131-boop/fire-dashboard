## Milestone 8 — FIRE verification

Unit tests cover exact zero-rate arrival, already reached, no arrival, 1200-month boundary, monthly rounding and contribution order, inflation, first-crossing semantics, invalid money/rates and overflow. Browser tests cover explicit last-known asset loading, no mutation of source amounts, missing data, invalidation on edits, validation errors, reset, session-only values and 390px overflow. Existing financial/storage/migration tests remain. Actual execution results are recorded in work-log and Issue #27 PR.

## Everyday observation verification

Date tests cover leap years/century rules, month mismatch, missing/unknown dates and freshness thresholds. JSON tests cover deterministic v1→v2 and dated v2 round-trip; v3 tests retain earlier migration plans and verify index-only addition. Browser tests seed actual v2 data, force index creation failure, confirm rollback then successful upgrade and exact export preservation; today-recording tests cover last-known accounts, date defaults, focus, failed saves and reload. Existing migration/unknown-version regression fixtures now explicitly target v2 or the new v3/future-v4 as appropriate; their assertions remain. Execution results belong in work-log and Issue #25 PR.

## Milestone 7 verification scope

Unit tests add JSON canonical round-trip, inactive/zero/note preservation, invalid versions/fields/references/duplicates/amounts/dates, UTF-8/size bounds, idempotent merges/conflicts, calendar/year boundaries and monthly increases/decreases/missing/zero-base/overflow. Chromium tests add automatic latest assets, future exclusion, partial coverage, bounded12-month reads, drilldown/draft protection, export download→empty-context restore, preview/cancel, duplicate imports, conflict rejection, failed-write rollback, concurrent import and oversized-store preservation. Existing suites remain. Actual results and final release evidence are in work-log.md and Issue #23 PR.

## Milestone 6 coverage

metrics.test.ts covers separate investment allocation, negative cash, inactive and partial balances, missing versus zero, exact safe-integer boundaries/overflow, invalid months/references/duplicates and source preservation. metrics.spec.ts covers committed-only updates, failed-write draft preservation, month switching, reload, failed reread invalidation and mobile overflow. Existing suites remain; see work-log.md for actual execution results.

# Testing strategy

## Resource-safety coverage — Issue #15

Vitest maxWorkers와 Playwright workers는 각각 1이다. 기존 검증과 Actions 설치·감사·배포 절차는 유지한다. 단위 테스트는 count 경계/잘못된 값, 이름/ID 길이, 추가 필드를 검증한다. Chromium은 99건에서 동시 생성 2건 중 1건 성공, 100건 조회/상한 편집, 기존 101건 getAll 없이 거부·보존, 20회 반복 수정 후 100건/5필드 유지, Web Storage 쓰기 없는 동작을 검증한다.

로컬 typecheck/lint/단위 31개/build/Chromium 16개 통과(E2E 8.7초). 작은 합성 데이터·격리 컨텍스트와 기존 설치 브라우저만 사용했다. 사용자 프로필·새 설치·전역 설정 변경은 없다. 전용 서버는 Playwright가 시작/종료한다. 이는 구조적 상한/보존 테스트이며 Chrome 전체 RAM 측정이나 누수 부재 증명이 아니다.

금액 계산, 데이터 검증, 마이그레이션, import/export를 최우선으로 테스트한다.

- Vitest: 도메인 단위 테스트 및 통합 수준 검증
- Playwright: 핵심 사용자 흐름 회귀 테스트
- GitHub Actions: lint, formatting, typecheck, unit test, production build, Chromium E2E 실행

의미 없는 커버리지 목표는 두지 않는다. 금융 계산이나 데이터 보존 관련 버그는 재현 테스트를 추가한 뒤 수정한다.

## Milestone 4 coverage

- 단위 테스트: 계좌명 공백/길이, 종류/상태, 저장된 레코드와 안전 정수 순서 검증, 동시 수정 비교, 결정론적 v0 → v1 계획 및 미지원 버전 거부.
- Chromium: 등록·편집·휴지·재개 후 새로고침 복원, 편집 취소, 잘못된 입력과 쓰기 실패 시 입력 보존, 저장 접근 차단, 여러 탭 수정 충돌, 동시 생성의 ID/순서, 실제 초기 스키마와 재열기, 트랜잭션 롤백, 미래 버전 보존, 잘못된 저장 레코드 거부.
- 계좌만 등록해도 금융 지표가 임의의 금액으로 바뀌지 않는지 확인한다. 기존 빈 상태 테스트를 유지한다.
- 비동기 기본키 충돌로 인한 쓰기 abort와 기존 기록 보존, versionchange 시 실제 연결 해제, blocked 후 늦게 열린 연결의 닫힘도 검증한다. 마지막 blocked 이벤트 순서는 시뮬레이션이며 나머지 영속화 검증은 실제 IndexedDB에서 실행한다.
- 테스트는 Playwright의 격리된 브라우저 컨텍스트와 합성 계좌명만 사용한다. 실제 사용자 데이터·백업·계좌 번호를 사용하지 않는다.

`npm run test:e2e`는 전용 포트 4180에서 테스트 대상 체크아웃의 서버를 직접 시작한다. 다른 체크아웃의 실행 중 서버를 재사용하지 않으며, 포트가 사용 중이면 명확히 실패한다. 개발 서버 기반 통합 테스트이며 프로덕션 산출물의 실행 검증과는 구분한다. 프로덕션 컴파일은 `npm run build`가 검증한다.

## Actions timing review — 2026-09-04

main 커밋 `6a01ff1`의 [CI 실행](https://github.com/jominq0131-boop/fire-dashboard/actions/runs/33845061456)은 약 6분 5초, [Pages 실행](https://github.com/jominq0131-boop/fire-dashboard/actions/runs/33845061470)은 약 5분 23초였다(생성~완료 시각 기준). 로그상 `npm ci`는 각각 약 302초였고, CI의 format/lint/typecheck/unit/build는 합계 약 8초, Playwright 설치는 약 33초, E2E 단계는 약 4초였다. 앞선 [PR #8 CI](https://github.com/jominq0131-boop/fire-dashboard/actions/runs/33844898445)의 `npm ci`는 약 37초였다.

병목은 검증 수가 아니라 설치 단계의 가변 지연이다. npm 캐시는 이미 사용 중이다. 로그만으로 감사 API/레지스트리/재시도 중 어느 것이 원인인지 확정할 수 없어, 이번에는 검증·감사·브라우저 설치를 제거하거나 캐시 구조를 복잡하게 바꾸지 않는다. 재발 시 설치 상세 타이밍을 수집한 뒤 별도 변경으로 검토한다.

CI와 Pages는 현재 main push에서 독립 실행되므로 Pages가 CI 성공을 기다리는 구조는 아니다. 이번에는 워크플로를 유지한다. 향후 검증된 동일 빌드 산출물 배포로 묶는 것은 속도 개선보다는 배포 안전성 측면의 별도 검토 사항이다.

## Milestone 4 release verification — 2026-09-04

PR #10 병합 뒤 README 충돌을 해결한 #12 최종 head의 CI와, squash merge 결과 `817ad45`의 main CI/Pages 배포가 모두 성공했다. 단위 23개와 Chromium 13개 검증을 유지했다. 실제 Pages HTML 및 앱 파일 HTTP 200, 배포 앱 파일 SHA-256과 검증 빌드의 일치를 확인했다. 실행 근거는 `docs/work-log.md`에 연결했다. 공개 사이트에서 실제 계좌를 생성하거나 사용자의 IndexedDB를 변경하지 않았다. 프로덕션 브라우저 종합 E2E나 모바일/접근성 검증 완료로 확대 해석하지 않는다.

## Milestone 5 local verification — 2026-09-04

단위 66개와 Chromium 22개(최종 11.4초)가 통과했다. 기존 계좌 테스트의 현재 DB 버전은 2, 미래 버전은 3으로 이동했고 v1 초기 마이그레이션 검증은 명시적 대상 버전으로 유지했다. 신규 테스트는 날짜/엔/길이/총량 경계, 결정론적 v2, 실제 v1 계좌 보존과 업그레이드 실패 롤백, 동시 중복 등록/오래된 수정 거부, 없는 계좌/휴지 계좌, commit 전 abort, 손상 레코드 보존, 인덱스 제한 조회, UI 재열기/실패 입력 보존/월 전환 경고를 다룬다. 100계좌/100잔액 실제 UI 경계와 가짜 전역 count를 결합해 상한에서 편집 가능·추가 거부를 검증한다.

기본 브라우저 경로 실행은 설치 바이너리가 없어 시작에 실패했다. 기존 files-pasted-by-the-user-fire/.playwright-browsers를 PLAYWRIGHT_BROWSERS_PATH로 명령 프로세스에만 지정해 재사용했다. 샌드박스 실행은 종료 지연으로 중단해 통과로 계산하지 않았다. 같은 격리 테스트를 승인된 샌드박스 밖 실행에서 정상 종료/exit 0으로 확인했다. 새 브라우저 설치·사용자 프로필·전역 환경변수 변경은 없다. 테스트 서버는 전용 4180 포트에서 Playwright가 소유한다.

최종 format/lint/typecheck/build와 git diff --check도 통과했다. 월별 저장 화면은 데스크톱 및 390px 모바일 스크린샷으로 확인했고 모바일 가로 넘침이 없음을 테스트했다. 전체 제품의 접근성/다중 브라우저 인증을 의미하지 않는다.

## 반복 개발의 검증 비용

설치는 최초 준비 또는 의존성/lockfile 변경 시, dev는 별도 개발 서버로만 실행한다. 일상 수정에서는 관련 검사부터 수행하고 문서만 바뀌면 format/diff를 확인한다. 최종 PR CI와 배포 확인은 유지한다. 검증 커밋과 제품 코드/테스트/설정이 같음을 확인한 문서 변경에서는 로컬 단위/E2E를 다시 돌리지 않는다. 테스트 삭제·작업자 증가·감사 생략·배포 게이트 완화는 하지 않는다. 이 정책은 AGENTS와 연속성 문서에 함께 반영했다.

## UI refresh coverage — Issue #19

기존 Chromium 22개의 등록/편집/휴지/복원/실패 입력 보존/충돌/100개 상한 검증을 유지했다. design.spec.ts는 키보드 본문 링크, 앵커 이동, 저장 설명 펼침, 390px 가로 넘침을 검증한다. 1440px 빈 상태와 1280px 입력 상태, 390px의 두 상태를 스크린샷으로 확인했다. 합성 데이터만 사용하며 스크린샷은 test-results에 두고 커밋하지 않는다.
