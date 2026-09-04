# Project continuity guide

이 문서는 새 Codex 대화에서 이 프로젝트를 이어갈 때 가장 먼저 읽는 운영 문서다. 세부 규칙의 원본은 루트의 `AGENTS.md`이며, 아키텍처와 데이터 모델의 상세 내용은 아래 문서를 따른다.

- `docs/architecture.md`
- `docs/data-model.md`
- `docs/testing.md`

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

현재 배포 화면은 대시보드의 레이아웃·지표 자리표시자·빈 상태만 제공한다. 실제 계좌, 월별 기록, IndexedDB 저장, JSON import/export, FIRE 계산은 아직 구현되지 않았다.

### Milestone 4 — 작업 브랜치 구현, 병합·배포 확인 전

[Issue #11](https://github.com/jominq0131-boop/fire-dashboard/issues/11), `feat/account-storage`: 저장소 인터페이스, IndexedDB v1 초기 마이그레이션, 계좌 등록·수정·휴지·재개 및 복원을 구현한다. 실제 브라우저 저장소 보존·실패·충돌 테스트를 추가한다. 새 의존성은 없으며 월별 기록·FIRE·JSON 백업은 포함하지 않는다. 위의 배포 상태와 이 브랜치의 구현 상태는 별개다. 검증·운영 기록은 `docs/work-log.md`를 따른다.

## Confirmed architecture decisions

- 프런트엔드는 GitHub Pages에서 제공되는 정적 React 앱이다.
- MVP의 실제 데이터 저장소는 각 기기의 브라우저 IndexedDB다.
- JSON은 주 데이터베이스가 아니라, 버전이 있는 export/import/backup/restore 형식이다.
- 자동 기기 동기화와 인증은 MVP 범위 밖이다. 실제 필요성이 확인된 뒤 별도 설계·승인을 거쳐 도입한다.
- `src/domain`은 React, IndexedDB, 네트워크, UI에 의존하지 않는다.
- `src/infrastructure`는 향후 IndexedDB와 외부 서비스 어댑터를 둔다.
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
4. 로컬에서 `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`를 실행한다.
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

사용자가 자동 삭제 설정 활성화와 기존 불필요 브랜치 정리를 승인했다(2026-09-04). PR #2/#4/#6/#8의 병합 여부와 head SHA를 대조한 뒤 해당 브랜치 4개를 삭제했다. 열린 PR #10의 `docs/mark-milestone-3-complete`는 보존했다. main과 열린 PR, 병합 후 추가 변경이 있는 브랜치는 삭제하지 않는다. 복구용 SHA는 `docs/work-log.md`에 기록한다.

## Next recommended milestone

**Milestone 4를 검토·병합한 다음 Milestone 5: 월별 현금흐름과 계좌별 월말 잔액 입력**으로 진행한다.

Milestone 5는 기존 월별 현금흐름·잔액 모델에 맞춘 입력/수정, 월 키·정수 엔 검증, 계좌와 월의 중복/참조 정책, 저장소 마이그레이션과 보존 테스트를 작은 issue로 나눈다. 스키마를 확장하기 전에 설계·승인을 확인한다. FIRE 예측·자동 동기화는 포함하지 않는다. 백업이 없으므로 실제 장기 기록용 사용은 아직 권장하지 않는다.

## New-session checklist

새 Codex 대화에서는 다음 순서로 시작한다.

1. `AGENTS.md`와 이 문서를 읽는다.
2. `docs/architecture.md`, `docs/data-model.md`, `docs/testing.md`를 읽는다.
3. GitHub의 `main`, 열린 issue/PR, 최근 Actions 상태를 확인한다.
4. 실제 개인 금융 데이터가 작업 디렉터리에 없는지 확인한다.
5. 다음 작업을 하나의 작은 issue와 브랜치로 분리한다.
6. 아키텍처·스키마·외부 서비스 변경이라면 구현 전에 사용자 승인을 받는다.

새 대화의 첫 요청 예시는 다음과 같다.

> `docs/project-continuity.md`와 `AGENTS.md`, `docs/work-log.md`를 읽고, GitHub에서 Milestone 4의 병합·배포 상태를 확인한 뒤 다음 미완료 작업을 이어가 줘.
