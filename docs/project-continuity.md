## Current work — Milestone 7 / Issue #23 / 2026-09-04

사용자가 전체 자산 우선 → 월별 그래프/상세 보강과 다음 마일스톤까지 구현·배포를 요청했다. 시작 main은 1edd378(PR #22)이며 로컬 clean, 최신 원격 일치와 열린 issue/PR 부재를 확인했다. Milestone 6 main CI 33867721976 및 Pages 33867722049 성공과 실제 JS/CSS 일치는 PR #22 릴리스 댓글에 기록되어 있다. 아래 과거 상태는 당시 이력이다.

feat/asset-history-backup에서 전체 자산 자동 읽기, 12개월 추이/상세 이동, JSON v1 백업과 원자적 추가 복원을 구현한다. [Milestone 7 계약](milestone-7-plan.md)을 따른다. DB v2와 기존 저장 필드는 유지하며 새 의존성/외부 서비스/동기화는 없다. 구현·검증·배포 상태는 work-log.md와 Issue #23 연결 PR을 확인한다. 복원은 덮어쓰기가 아니며 충돌한 파일의 전체 복원에는 빈 브라우저를 사용한다. 다음 권장 기능은 명시적 가정값을 사용하는 FIRE 설정/예측 설계다. 밝기/UI 전체 검토는 기능 완성 후 진행한다.

## Current milestone — 2026-09-04 / Issue #21

실제 main은 95eddb4이며 Milestone 5(PR #18)와 UI 변경(PR #20)이 병합됐다. PR #20 main CI 33865786104와 Pages 33865786122 성공을 이번 작업에서 확인했다. 열린 issue/PR은 없었다. 다음 로드맵의 대시보드 지표를 Milestone 6으로 구현하며 사용자가 구현부터 배포까지 요청했다. feat/monthly-dashboard-metrics의 구현/검증/배포 결과는 work-log.md와 Issue #21 연결 PR에 기록한다. 아래의 오래된 미구현/별도 결정 문구는 당시 기록이다.

Milestone 6은 기존 월별 읽기 결과에서 계산하는 저장값 요약이다. DB v2, 저장 계약과 상한을 유지한다. 로컬 재읽기와 저장 성공 후만 반영하며 월 전환/읽기 실패는 이전 요약을 숨긴다. 스키마 변경은 없어 마이그레이션 추가가 필요하지 않다. 다음 권장 범위는 버전 있는 JSON 백업/복원 설계이며 파일 크기, 건수, 미리보기, 원자적 복원, 실패 보존을 정한 뒤 승인받아 구현한다. 차트/FIRE보다 데이터 이식성과 복원 검증을 우선 권장한다. 밝기/UI 검토는 기능 완성 후로 보류한다.

# Project continuity guide

## Safety prerequisite — Issue #15

`fix/bounded-account-storage`에서 Milestone 5 이전 안전 보강을 로컬 검증했다. 당시 단위 31개/Chromium 16개, typecheck/lint/build 통과. 이후 사용자 배포 승인으로 PR #16을 f21c873으로 squash merge했다. 배포 상태는 [Issue #15](https://github.com/jominq0131-boop/fire-dashboard/issues/15)의 연결 PR과 최신 Actions를 확인한다. 월별 입력은 승인 후 feat/monthly-records에서 구현했다.

실제 체크아웃은 `C:\Users\MINGYU\Documents\Codex\2026-09-04\fire-dashboard-next`이다. 이전 사본 `files-pasted-by-the-user-fire`와 혼동하지 않는다. 새 대화에서는 AGENTS.md와 이 문서, resource-safety.md를 읽고 경로·remote·branch·dirty 상태·쓰기 권한을 확인한다. 권한 밖 쓰기는 승인 절차를 따른다. 사용자 Chrome 프로필이나 실제 데이터는 조사/정리 대상으로 삼지 않는다.

이 문서는 새 Codex 대화에서 이 프로젝트를 이어갈 때 가장 먼저 읽는 운영 문서다. 세부 규칙의 원본은 루트의 `AGENTS.md`이며, 아키텍처와 데이터 모델의 상세 내용은 아래 문서를 따른다.

- `docs/architecture.md`
- `docs/data-model.md`
- `docs/testing.md`
- `docs/proposal-alignment.md` — 최초 제안과 현재 범위·번호의 대응, 미완료 MVP 요구사항

## Product purpose

일본 거주자를 위한 장기 개인 FIRE Dashboard다. 단순 계산기가 아니라, 수년 동안 실제 개인 금융 기록을 안전하게 축적하고 점진적으로 개선하는 제품을 목표로 한다.

제품의 우선순위는 금융 데이터 정확성, 개인정보 보호, 유지보수성, 이식성, 사용성이다. 게임화는 향후 고려 사항일 뿐 MVP 목표가 아니다.

## Current state — 2026-09-04

### Completed

| Milestone | Result                                                                                     | GitHub record                                                     |
| --------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1         | React + TypeScript + Vite, Vitest, Playwright, ESLint/Prettier, CI, GitHub Pages 배포 기반 | Initial commits on `main`                                         |
| 2         | 금융 도메인 모델과 순수 검증 규칙                                                          | [PR #2](https://github.com/jominq0131-boop/fire-dashboard/pull/2) |
| CI repair | LF 줄바꿈 정책과 CI 포맷 안정화                                                            | [PR #4](https://github.com/jominq0131-boop/fire-dashboard/pull/4) |
| 3         | 데이터 없는 반응형 대시보드 빈 상태                                                        | [PR #6](https://github.com/jominq0131-boop/fire-dashboard/pull/6) |

현재 작업 브랜치는 계좌 관리와 월별 현금흐름·계좌별 월말 잔액 입력/수정, IndexedDB v2 저장/복원을 제공한다. 금융 지표, JSON import/export, FIRE 계산은 미구현이다. 릴리스의 main 병합·배포 검증 결과는 [PR #18](https://github.com/jominq0131-boop/fire-dashboard/pull/18)에 기록하며 Actions와 함께 확인한다. 전체 MVP나 장기 실사용 준비 완료가 아니다.

### Milestone 4 — main 병합·배포 완료

[PR #10](https://github.com/jominq0131-boop/fire-dashboard/pull/10)(`8198d04`)과 [PR #12](https://github.com/jominq0131-boop/fire-dashboard/pull/12)(`817ad45`)를 사용자 승인 후 squash merge했다. README 충돌을 두 변경 모두 보존해 해결하고 최종 PR CI를 다시 통과했다. 계좌 저장 계약·IndexedDB v1·계좌 관리가 구현됐으며 단위 23개·Chromium 13개가 통과했다. 새 의존성·외부 서비스는 없다. 두 단기 브랜치는 자동 삭제됐다. 배포 검증 근거는 `docs/work-log.md`를 따른다.

`817ad45`의 [main CI](https://github.com/jominq0131-boop/fire-dashboard/actions/runs/33849362398)와 [Pages 배포](https://github.com/jominq0131-boop/fire-dashboard/actions/runs/33849362394)가 성공했다. [배포 주소](https://jominq0131-boop.github.io/fire-dashboard/)의 HTML/앱 파일 HTTP 200과 검증 빌드의 앱 파일 SHA-256 일치를 확인했다. 실제 사용자 브라우저에 테스트 계좌를 만들지는 않았다.

## Confirmed architecture decisions

- 프런트엔드는 GitHub Pages에서 제공되는 정적 React 앱이다.
- MVP의 실제 데이터 저장소는 각 기기의 브라우저 IndexedDB다.
- JSON은 주 데이터베이스가 아니라, 버전이 있는 export/import/backup/restore 형식이다.
- 자동 기기 동기화와 인증은 MVP 범위 밖이다. 실제 필요성이 확인된 뒤 별도 설계·승인을 거쳐 도입한다.
- `src/domain`은 React, IndexedDB, 네트워크, UI에 의존하지 않는다.
- `src/infrastructure`는 IndexedDB 계좌 어댑터를 두며, 승인된 경우에만 미래 외부 서비스 어댑터를 추가한다.
- `src/features`는 기능별 UI·오케스트레이션을 둔다.

## Financial model invariants

- 금액은 부동소수점이 아닌 안전한 정수 일본 엔으로 다룬다.
- 수입·지출·투자 납입으로 구성된 월별 현금흐름과, 계좌별 월말 잔액 스냅샷은 별도 모델이다.
- 투자 납입을 소비 지출과 혼합하지 않는다.
- 계좌 분류는 `cash`, `nisa_tsumitate`, `nisa_growth`, `taxable`, `other`로 시작하며 확장 가능해야 한다.
- FIRE 가정값은 명시적으로 사용자 설정으로 둔다. 보편적인 인출률을 하드코딩하지 않는다.

## Privacy and data ownership

- 실제 금융 데이터, JSON 백업, API 키, 비밀값을 Git 저장소·테스트·공개 배포 파일에 넣지 않는다.
- `.gitignore`는 일반적인 개인 데이터·백업 경로를 제외하지만, 커밋 전 검토를 대체하지 않는다.
- 익명화된 예제 데이터도 필요성이 생기기 전까지 만들지 않는다.
- 외부 서비스로 이전하더라도 버전이 있는 JSON export로 데이터를 떠날 수 있어야 한다.

## AI collaboration rules

`AGENTS.md`의 규칙을 반드시 따른다. 특히 다음을 지킨다.

- 요청 범위 밖 파일은 수정하지 않는다.
- 새 의존성은 목적, 대안, 유지 비용을 설명한 뒤에만 도입한다.
- 데이터 스키마 변경에는 결정론적 마이그레이션, 테스트, 문서를 함께 제공한다.
- 테스트를 삭제하거나 약화해 통과시키지 않는다.
- 금액·날짜·FIRE 계산 변경에는 관련 테스트를 추가한다.
- 대규모 재작성, 동기화 구조 변경, 외부 서비스 도입 전에는 명시적 승인을 받는다.
- 변경은 작고 검토 가능해야 하며, 이유와 검증 결과를 PR에 기록한다.
- 매 작업마다 문서 영향도를 확인하고 영향받은 모든 문서를 같은 PR에서 갱신한다. README/이 문서(진행), architecture(설계), data-model(스키마), testing(검증), 계층 README(책임), AGENTS(규칙), work-log(결과)를 확인한다. 영향 없는 문서는 의미 없이 수정하지 않는다.
- 구현 완료, 로컬 검증, PR 검토, main 병합, 배포 확인을 구분한다.

## Development and GitHub workflow

1. 작은 요구사항을 GitHub issue로 만든다.
2. `main`에서 짧은 작업 브랜치를 만든다. 예: `feat/account-setup`, `fix/import-validation`, `docs/project-continuity-guide`.
3. 구현과 테스트를 수행하고 관련 문서를 함께 갱신한다.
4. 변경 관련 검사부터 실행하고 PR 준비 시 format/lint/typecheck/unit/build/E2E를 검증한다. 의존성 설치는 최초 또는 의존성/lockfile 변경 시만 수행하며 dev는 별도 상시 서버다. 검증 후 코드가 동일한 문서 변경에는 로컬 전체 검증을 반복하지 않고 format/diff를 확인한다. 최종 GitHub CI와 배포 확인은 유지한다.
5. PR에 변경 이유, 개인정보·스키마 영향, 검증 결과, 범위 밖 항목을 기록한다.
6. GitHub Actions CI가 녹색인지 확인한다.
7. 검토 후 squash merge하고, `Closes #번호`로 연결한 issue가 닫혔는지 확인한다.
8. 배포에 영향이 있으면 GitHub Pages 워크플로와 실제 URL을 확인한다.

### Branch lifecycle policy

기능 브랜치를 영구 보관하는 것은 일반적인 대기업 개발 방식이 아니다. 대부분의 팀은 짧은 기능 브랜치를 PR 병합 뒤 삭제한다. 오래 유지하는 브랜치는 `main`, 필요할 때의 `release/*`, 긴급 수정용 `hotfix/*` 정도다.

이 프로젝트는 다음 정책을 적용한다.

- `main`: 항상 배포 가능해야 하는 유일한 장기 브랜치
- `feat/*`, `fix/*`, `docs/*`: PR 병합 뒤 삭제하는 단기 브랜치
- GitHub Settings → General → Pull Requests의 **Automatically delete head branches**를 활성화
- PR·커밋·이슈 이력은 브랜치를 지워도 유지되므로 학습 기록은 사라지지 않음

사용자가 자동 삭제 설정 활성화와 기존 불필요 브랜치 정리를 승인했다(2026-09-04). PR #2/#4/#6/#8 브랜치 4개는 head 확인 후 정리했다. 이후 PR #10/#12도 승인·병합되어 두 브랜치가 자동 삭제됐음을 확인했다. main과 열린 PR, 병합 후 추가 변경이 있는 브랜치는 삭제하지 않는다. 복구용 SHA는 `docs/work-log.md`에 기록한다.

## Next recommended milestone

2026-09-04 사용자가 월별 설계를 승인했다. PR #16의 CI 실행 33859153564 성공을 확인했고 이후 사용자 배포 승인으로 f21c873에 병합했다. 선행 변경을 유지하기 위해 `92f09af`에서 `feat/monthly-records`를 분기했고 Issue #17에서 도메인→저장소→UI 순으로 구현했다. [PR #18](https://github.com/jominq0131-boop/fire-dashboard/pull/18)은 처음 #16 브랜치에 의존했고 이후 main으로 전환했다. 선행 squash 통합 충돌은 기존 v2 변경을 보존해 해결했으며 제품 트리가 검증 커밋과 동일함을 확인했다. [승인된 설계](milestone-5-plan.md), DB v2, 상한/참조/충돌/보존 테스트를 추가했다. 로컬 단위 66개와 Chromium 22개 통과(최종 11.4초), format/lint/typecheck/build 통과. 이후 병합/실제 배포 확인 결과는 PR #18과 연결 Actions에서 확인한다.

**Milestone 5 릴리스 상태는 PR #18과 연결 Actions를 확인한다. 다음 기능 범위는 별도 결정한다.**

Milestone 5는 승인된 설계에 따라 입력/수정, 월 키·정수 엔 검증, 계좌와 월의 중복/참조 정책, 저장소 마이그레이션과 보존 테스트를 Issue #17에서 구현했다. 후속 스키마 확장에도 설계·승인 규칙을 적용한다. FIRE 예측·자동 동기화는 포함하지 않는다. 백업이 없으므로 실제 장기 기록용 사용은 아직 권장하지 않는다.

## New-session checklist

새 Codex 대화에서는 다음 순서로 시작한다.

1. `AGENTS.md`와 이 문서를 읽는다.
2. `docs/architecture.md`, `docs/data-model.md`, `docs/testing.md`를 읽는다.
3. GitHub의 `main`, 열린 issue/PR, 최근 Actions 상태를 확인한다.
4. 실제 개인 금융 데이터가 작업 디렉터리에 없는지 확인한다.
5. 다음 작업을 하나의 작은 issue와 브랜치로 분리한다.
6. 아키텍처·스키마·외부 서비스 변경이라면 구현 전에 사용자 승인을 받는다.

새 대화의 첫 요청 예시는 다음과 같다.

> `docs/project-continuity.md`와 `AGENTS.md`, `docs/proposal-alignment.md`를 읽고, 최신 GitHub 상태를 확인한 뒤 Milestone 5의 작은 작업 단위를 정리해 줘.

## UI refresh — Issue #19 / 2026-09-04

사용자 요청으로 Toss/iOS의 차분한 시각 언어를 참고해 흰색·중립 회색·파란색 중심 UI를 구현했다. 요약→월별 기록→계좌 관리 앵커 이동, 좁은 화면의 1열 배치, 입력/라벨/상태 메시지/안내문을 정리했다. 대형 빈 차트와 미구현 지표 6개는 금융자산 미집계 표시와 간결한 안내로 대체했다. 가상 금액이나 그래프는 표시하지 않는다. 저장 로직/모델/스키마/의존성은 그대로이며 공개·CI 결과는 Issue #19의 연결 PR 릴리스 기록을 확인한다.
