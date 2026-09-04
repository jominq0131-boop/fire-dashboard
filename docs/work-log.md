# Work log

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
