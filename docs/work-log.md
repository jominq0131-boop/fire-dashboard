# Work log

## 2026-09-04 — Milestone 5 / Issue #17 구현

- [Draft PR #18](https://github.com/jominq0131-boop/fire-dashboard/pull/18)을 생성했다. GitHub CI 최종 상태는 PR에서 확인한다. main 병합·배포는 수행하지 않았다.
- 사용자 승인 후 feat/monthly-records에서 월별 도메인→v2 저장소→UI를 순서대로 구현했다. PR #16 CI 성공(33859153564)을 확인했으나 미병합이므로 안전 보강 head 92f09af에서 분기해 후속 PR로 검토한다. #16 병합 후 main으로 기준 전환이 필요하다.
- 한 달의 현금흐름 1개와 계좌별 잔액 최대 100개, 총량 3600/360000 상한, 정수 엔/월/ISO 검증, 중복/참조/동시 수정 충돌, commit 이후 성공을 구현했다. 계좌 휴지·0엔·미입력 정책을 유지한다.
- v1 계좌를 읽거나 변환하지 않는 v2 빈 저장소/인덱스 추가와 실패 롤백·보존을 구현했다. 새 의존성·외부 서비스·백업/실제 금융 데이터·전역 설정 변경은 없다. UI는 명시적 월 읽기, 현금흐름/각 잔액 별도 저장, 실패 입력 보존과 미저장 변경 경고를 제공한다.
- 단위 66개, Chromium 22개(최종 11.4초) 통과. format/lint/typecheck/build와 git diff --check 통과. 데스크톱/390px 모바일 스크린샷 및 가로 넘침 검증 통과. 첫 E2E는 기본 바이너리 경로 부재, 다음 샌드박스 실행은 종료 지연으로 통과로 계산하지 않았다. 기존 설치 경로를 프로세스 환경변수로 지정한 승인 실행에서 정상 종료했다.
- README/연속성/설계/모델/자원 정책/검증/계층 README/제안 대응/작업 기록을 갱신했다. 운영 규칙 자체는 그대로이므로 AGENTS는 수정하지 않았다. JSON 백업, 지표/차트/FIRE, 자동 동기화, main 병합·배포는 미완료다.

## 2026-09-04 — Milestone 5 재개 설계 초안

- 지정된 지침과 설계/모델/테스트/제안 대응 문서를 읽고 실제 체크아웃, remote, clean 상태를 확인했다. GitHub main은 172ebc4, PR #16 head와 로컬은 92f09af다.
- PR #16은 열림/병합 가능/리뷰 0건, CI 33859153564는 확인 시 npm ci 실행 중이었다. 병합·배포하지 않았다.
- 월별 입력의 중복/참조/날짜/금액/상한, v2 결정론적 마이그레이션, 보존 테스트와 3개 구현 단위를 milestone-5-plan.md에 제안했다. 연속성 문서가 요구하는 스키마 확장 승인 전 초안이다.
- README와 연속성 문서를 함께 갱신했다. 현재 설계·스키마·테스트 구현 및 계층 책임은 그대로여서 해당 현행 문서는 변경하지 않았다. 제품 코드 변경이 없어 단위/E2E는 재실행하지 않는다. 초안은 로컬 미커밋이며 원격 PR에 추가하지 않았다.

## 2026-09-04 — 자원 안전 보강 / Issue #15

- 사용자 요청에 따라 Milestone 5 전에 계좌 누적 조회와 로컬 실행 부담을 제한했다. localStorage가 아닌 IndexedDB를 사용하지만 기존 무제한 getAll을 개선했다.
- 휴지 포함 100건, 이름/ID 길이 100, 5필드 검증, count 선검사와 제한 조회, 동시 생성 상한 및 UI 안내를 추가했다. 초과 기존 데이터는 오류로 중단·보존한다.
- 테스트 작업자 각각 1개. typecheck/lint/단위 31개/build/Chromium 16개 통과(E2E 8.7초). Chrome 전체 메모리 보장이나 측정은 아니다.
- 새 의존성·스키마 변환·외부 서비스·전역 설정 변경·Chrome 데이터 정리는 없다. 운영 규칙/README/설계/모델/테스트/계층 설명/제안 점검/연속성/PR 체크리스트를 갱신했다.
- 기준 main 172ebc4, 브랜치 fix/bounded-account-storage. 로컬 검증 완료이며 병합·배포는 연결 PR에서 별도 확인한다. 월별 입력은 후속이다.

## 2026-09-04 — Milestone 4 출시 상태 문서 / Issue #13

- PR #10과 #12 병합 완료, 연결 issue #9/#11 닫힘 확인.
- 계좌 기능 릴리스 커밋: `817ad451c4c901e3e3c4b0d670f937e184c06058`.
- [main CI](https://github.com/jominq0131-boop/fire-dashboard/actions/runs/33849362398) 및 [GitHub Pages 배포](https://github.com/jominq0131-boop/fire-dashboard/actions/runs/33849362394) 성공.
- [실제 배포](https://jominq0131-boop.github.io/fire-dashboard/)의 HTML과 `/fire-dashboard/assets/index-BiOXOyk8.js`가 HTTP 200이며, 앱 파일 SHA-256이 검증한 로컬 Pages 빌드와 일치함을 확인했다. 사용자 저장소를 변경하지 않는 읽기 전용 배포 확인이다. 실제 주소에서 계좌 등록·삭제를 실행한 검증은 아니다.
- 이번 문서 변경은 README의 작업 브랜치 표현, 연속성 문서의 검토 중/미배포 표현을 실제 출시 상태로 갱신하고 테스트 문서에 확인 범위를 남긴다. 과거 기록은 당시 시점의 이력으로 보존한다.
- 제품 코드·데이터 스키마·의존성·워크플로에는 변경이 없다. 최초 제안 점검 결과와 다음 마일스톤은 `docs/proposal-alignment.md`와 `docs/project-continuity.md`에 기록했다.
- format/lint/typecheck, 단위 23개, build, Chromium 13개를 재실행해 모두 통과했다(E2E 4.2초). 문서 전용 PR의 최종 CI·병합 상태는 해당 PR을 따른다. 이후 문서 커밋의 Actions 상태는 별도 실행 이력이며 위 링크는 계좌 기능 릴리스의 확인된 결과다.

## 2026-09-04 — 병합·배포 승인 및 최초 제안 점검

사용자가 PR #10/#12 병합과 배포를 승인했다. 두 PR head의 CI 성공을 확인한 뒤 #10을 먼저 squash merge했다(`8198d04`). #12에 최신 main을 합치는 과정의 README 충돌은 #10의 완료 표기와 #12의 계좌 안내를 모두 보존하여 해결했다. 제품 코드 변경은 없다.

최초 제안 대비 `docs/proposal-alignment.md`를 추가했다. 아키텍처 방향은 일치하지만 빈 대시보드를 먼저 만들면서 마일스톤 번호/순서가 달라졌고, 계좌 저장만 완성됐으며 월별 저장·계산·JSON 백업·PWA는 미구현이다. 백업의 실사용 전 필수 조건과 날짜 검증 등 후속 검토 항목을 기록했다. 점검에 따라 기능·의존성·배포 구조를 임의로 변경하지 않았다.

충돌 해결·문서 변경 후 format/lint/typecheck, 단위 23개, 빌드, Pages 하위 경로 Chromium 13개(4.1초)를 다시 통과했다. [최종 PR CI](https://github.com/jominq0131-boop/fire-dashboard/actions/runs/33848831253) 성공 후 #12를 `817ad451c4c901e3e3c4b0d670f937e184c06058`로 squash merge했다. #10/#12 단기 브랜치는 GitHub가 자동 삭제했다. 복구할 head는 각각 `a265fe53d970d8007dca5b74ee64f399ede5f6f4`, `f5c22a38f8bf878628dd451bf2fa69d48c317ff4`이며 PR 이력은 보존됐다. 아래 첫 구현 기록은 당시 시점의 이력이다.

## 2026-09-04 — Milestone 4 / Issue #11

### 기준과 범위

GitHub main `6a01ff1`의 최근 변경(PR #2 도메인, #4 LF 수정, #6 빈 대시보드, #8 연속성 문서)을 확인했다. PR #10은 README에서 Milestone 3 완료를 표기하는 열린 문서 PR이다. 이 변경에도 완료 표기를 반영하므로 #10을 검토할 때 중복을 확인한다. 기존 원격 미연결 사본은 수정하지 않고 최신 저장소의 `feat/account-storage` 브랜치에서 작업한다.

계좌 저장 계약, 순수 검증, IndexedDB 초기 스키마, 계좌 관리 UI, 저장 보존/오류/동시성 테스트를 추가한다. 데이터 손실을 피하도록 물리 삭제 API를 만들지 않고, 저장 commit 전에 성공을 표시하지 않는다. UI/도메인/어댑터 분리와 GitHub Pages를 유지한다. 새 패키지·외부 서비스·실제 금융 데이터는 없다.

### 문서 운영

매 작업에서 영향받은 문서를 전부 갱신하도록 AGENTS와 연속성 문서에 명시했다. README, architecture, data-model, testing, 세 계층 README, PR 템플릿을 현 구현에 맞췄다. 구현 상태와 실제 병합·배포 상태를 구분한다.

### 브랜치 정리

사용자 승인에 따라 PR 병합 여부와 원격 head 일치를 확인하고 아래 4개를 삭제했다. squash merge 때문에 조상 관계만으로 삭제 가능 여부를 판단하지 않았다. 삭제 시 SHA lease로 추가 커밋이 생겼으면 거부하도록 했다. PR·main 이력은 보존되며 필요하면 아래 커밋에서 브랜치를 복구할 수 있다.

| 브랜치                          | 병합 PR | 삭제 전 head SHA                           |
| ------------------------------- | ------- | ------------------------------------------ |
| `feat/financial-domain-model`   | #2      | `df89e9f14a0584463446a82ba9471da8569a2225` |
| `fix/normalize-line-endings`    | #4      | `7ee5fb8eb4f303cee7ba5a77299248116ecc416b` |
| `feat/dashboard-empty-state`    | #6      | `3783179bc043976cec7f573fdcb324730b760332` |
| `docs/project-continuity-guide` | #8      | `e18b36e05614535e34aea0c25499e4717bf9ca7b` |

`main`과 열린 PR #10 브랜치는 보존했다. Actions 실측과 유지 결정은 `docs/testing.md`에 기록했다.

### 검증 및 미완료

- `npm run format`, `npm run lint`, `npm run typecheck`: 통과.
- `npm test`: 3개 파일, 23개 테스트 통과 (기존 8개 유지).
- `npm run build`: 루트 경로와 GitHub Pages `/fire-dashboard/` 경로 모두 통과.
- `npm run test:e2e -- --reporter=line`: Chromium 13개 통과. 최종 실행은 GitHub Actions/Pages 하위 경로 환경에서도 13개 모두 통과(4.3초).
- 첫 샌드박스 E2E 실행은 종료가 지연되어 중단했고 통과로 계산하지 않았다. 승인 후 같은 테스트를 샌드박스 밖에서 재실행해 정상 종료를 확인했다. 테스트를 삭제하거나 타임아웃을 늘려 우회하지 않았다.
- 개발 서버 기반 UI/IndexedDB 통합 검증이며, 실제 Pages 배포 검증을 의미하지 않는다. 프로덕션 산출물은 별도 빌드로 확인했다.

[PR #12](https://github.com/jominq0131-boop/fire-dashboard/pull/12)를 생성해 검토를 요청하는 상태다. main 병합·GitHub Pages 배포는 수행하지 않았다. 월별 입력, JSON 백업/복원, FIRE 계산은 미구현이며 다음 작업으로 분리한다. GitHub CI의 최종 결과와 PR 검토 상태는 PR에서 확인한다.
