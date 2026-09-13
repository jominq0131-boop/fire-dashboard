# 작업 재개 안내

## 체크아웃과 시작점

실제 체크아웃은 `C:\Users\MINGYU\Documents\Codex\2026-09-04\fire-dashboard-next`입니다. 이전 사본 `files-pasted-by-the-user-fire`는 수정하지 않습니다. 저장소는 `jominq0131-boop/fire-dashboard`, 배포는 GitHub Pages입니다.

2026-09-13에 원격 main 538ffc89와 열린 문서 PR #43/CI 대기를 확인하고 Milestone16을 시작했습니다. 작업 이력은 work-log.md를 확인합니다.

## 현재 범위 — Milestone 16 및 반응형 수정 통합 중

Milestone15는 PR #42로 main 538ffc89에 병합·배포했습니다. 배포 기록 PR #43의 이력을 통합 브랜치에 병합했습니다. Milestone15의 main CI/Pages/공개 파일/390px 검증 근거는 work-log.md에 보존했습니다.

[Issue #44](https://github.com/jominq0131-boop/fire-dashboard/issues/44)의 [목표 입력 저장 계약](milestone-16-plan.md)에 따라 codex/milestone-16-goal-persistence에서 작업합니다. 목표 입력 자동 저장, DB v5, JSON v4, 이전 데이터 보존과 기준 월 안내가 범위입니다. 구현·검증과 PR/main/배포 완료는 구분합니다.

## 작업 시작 순서

1. [AGENTS.md](../AGENTS.md), 이 문서, 관련 설계·검증·자원 정책을 읽습니다.
2. 실제 경로·remote·branch·dirty 상태와 GitHub main, 열린 issue/PR, 최근 Actions를 확인합니다.
3. 사용자 프로필이나 실제 금융 데이터를 조사하지 않고 합성 데이터로 재현합니다.
4. 작은 issue/브랜치에서 구현하고 영향을 받은 문서도 함께 수정합니다.
5. 관련 검사부터 실행하고 최종 CI/배포 검증은 유지합니다.

## 유지할 결정

브라우저 IndexedDB가 주 저장소이며 JSON은 버전 있는 백업입니다. 이번 작업 DB v5/JSON v4, 외부 서비스·로그인·자동 동기화는 없습니다. 기존 FIRE 가정/비교는 저장하지만 계산 결과 점은 다시 계산합니다. UI는 도메인 계약을 주입받고 저장소를 직접 구현하지 않습니다. 데이터 스키마 변경에는 결정론적 마이그레이션과 보존 테스트가 필요합니다. 대규모 재작성·동기화 구조 변경·외부 서비스 도입은 명시적 승인을 먼저 받습니다.

## 이후 후보

취득원가를 반영한 세후 인출액, 도달 후 인출·유지 가능성은 후속 범위입니다. 일별 장부, 금융기관 자동 수집, 서비스 워커 기반 오프라인, 자동 동기화와 폭넓은 다중 브라우저 QA는 별도 범위입니다. 미완료 기능을 배포된 것으로 기록하지 않습니다.

사용자가2026-09-13 모든 열린 PR 병합/배포를 승인했습니다. 창 폭 상한을 제거하고320~2560px 변경 검사를 추가했습니다. 이전 게시 승인 차단은 해소됐으며, 현재 최종 CI와 배포를 진행합니다.
