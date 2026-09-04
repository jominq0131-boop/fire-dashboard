# 작업 재개 안내

## 체크아웃과 시작점

실제 체크아웃은 `C:\Users\MINGYU\Documents\Codex\2026-09-04\fire-dashboard-next`입니다. 이전 사본 `files-pasted-by-the-user-fire`는 수정하지 않습니다. 저장소는 `jominq0131-boop/fire-dashboard`, 배포는 GitHub Pages입니다.

이번 작업은 배포된 main `0d49f272c36841965785aa98f2288464201bc676`에서 시작했습니다. 최신 원격 일치·clean·열린 PR/issue 부재를 확인한 뒤 Issue #33과 `feat/professional-chart-workspace`를 만들었습니다.

## 현재 범위 — Milestone 11

사용자는 기존 차트 수준이 기대에 미치지 못한다고 지적하고 financial-os를 참고로 제공했습니다. 구독형 서비스 수준의 사용성을 목표로 Recharts 복합 차트, 툴팁·확대·월 수입/지출 비교와 예측 시나리오 표현을 개선합니다. [구체적 계약](milestone-11-plan.md)을 따릅니다.

로컬 구현, 검증, PR 검토, main 병합, 실제 배포는 별도 단계입니다. 최종 상태는 Issue #33 연결 PR과 [작업 기록](work-log.md)의 증거를 확인합니다. Milestone10 배포는 PR #32 릴리스 댓글에서 확인했습니다. 이전 출시 근거는 [출시 이력](release-history.md)에 있습니다.

## 작업 시작 순서

1. [AGENTS.md](../AGENTS.md), 이 문서, 관련 설계·검증·자원 정책을 읽습니다.
2. 실제 경로·remote·branch·dirty 상태와 GitHub main, 열린 issue/PR, 최근 Actions를 확인합니다.
3. 사용자 프로필이나 실제 금융 데이터를 조사하지 않고 합성 데이터로 재현합니다.
4. 작은 issue/브랜치에서 구현하고 영향을 받은 문서도 함께 수정합니다.
5. 관련 검사부터 실행하고 최종 CI/배포 검증은 유지합니다.

## 유지할 결정

브라우저 IndexedDB가 주 저장소이며 JSON은 버전 있는 백업입니다. 현재 DB v3/JSON v2, 외부 서비스·로그인·자동 동기화 없음, FIRE 가정/비교는 임시 상태입니다. UI는 도메인 계약을 주입받고 저장소를 직접 구현하지 않습니다. 데이터 스키마 변경에는 결정론적 마이그레이션과 보존 테스트가 필요합니다. 대규모 재작성·동기화 구조 변경·외부 서비스 도입은 명시적 승인을 먼저 받습니다.

## 이후 후보

영속 FIRE 설정과 백업 통합은 저장 계약 설계 후 승인받아 진행합니다. 인출 이후 시뮬레이션, PWA, 폭넓은 접근성/다중 브라우저 QA는 별도 범위입니다. 미완료 기능을 배포된 것으로 기록하지 않습니다.
