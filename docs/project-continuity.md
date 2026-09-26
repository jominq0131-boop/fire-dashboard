# 작업 재개 안내

## 체크아웃과 시작점

실제 체크아웃은 `C:\Users\MINGYU\Documents\Codex\2026-09-04\fire-dashboard-next`입니다. 이전 사본 `files-pasted-by-the-user-fire`는 수정하지 않습니다. 저장소는 `jominq0131-boop/fire-dashboard`, 배포는 GitHub Pages입니다.

## 현재 작업 — Milestone17 세후 인출액

시작 main은7ac6540이며 PR #46/#48의 CI·Pages까지 성공했습니다. [Issue #49](https://github.com/jominq0131-boop/fire-dashboard/issues/49)와 [Milestone17 계약](milestone-17-plan.md)에 따라 취득원가·세율 입력과 세후 인출액, 구계획 보존 이행을 구현·로컬 검증했습니다. 아직 이번 기능의 배포 완료 기록은 아닙니다.

## 직전 출시 — Milestone16

[PR #45](https://github.com/jominq0131-boop/fire-dashboard/pull/45)를 main ae285ca02b33efab4af3dfa30449280ef4315b19에 병합했으며 PR #43의 커밋도 함께 main에 들어갔습니다. 목표형 입력 자동 저장/JSON v4와 반응형 창 크기 수정을 포함합니다.

Pages 성공과 공개 HTML/JS/CSS SHA-256 일치,320~2560px 실화면 크기 변경,390px 가로 넘침 없음, 저장 후 새로고침 복원과 pageerror0건을 확인했습니다. PR CI/main CI/Pages 링크와 상세 근거는 [작업 기록](work-log.md)을 확인합니다.

[목표 입력 저장 계약](milestone-16-plan.md)에 따라 DB v5, JSON v4와 기존 자료 보존을 유지합니다. 결과 점은 저장하지 않고 입력 확인 후 다시 계산합니다.

## 작업 시작 순서

1. [AGENTS.md](../AGENTS.md), 이 문서, 관련 설계·검증·자원 정책을 읽습니다.
2. 실제 경로·remote·branch·dirty 상태와 GitHub main, 열린 issue/PR, 최근 Actions를 확인합니다.
3. 사용자 프로필이나 실제 금융 데이터를 조사하지 않고 합성 데이터로 재현합니다.
4. 작은 issue/브랜치에서 구현하고 영향을 받은 문서도 함께 수정합니다.
5. 관련 검사부터 실행하고 최종 CI/배포 검증은 유지합니다.

## 유지할 결정

브라우저 IndexedDB가 주 저장소이며 JSON은 버전 있는 백업입니다. 이번 작업 DB v5/JSON v5, 외부 서비스·로그인·자동 동기화는 없습니다. 기존 FIRE 가정/비교는 저장하지만 계산 결과 점은 다시 계산합니다. UI는 도메인 계약을 주입받고 저장소를 직접 구현하지 않습니다. 데이터 스키마 변경에는 결정론적 마이그레이션과 보존 테스트가 필요합니다. 대규모 재작성·동기화 구조 변경·외부 서비스 도입은 명시적 승인을 먼저 받습니다.

## 이후 후보

도달 후 인출·유지 가능성은 후속 범위입니다. 일별 장부, 금융기관 자동 수집, 서비스 워커 기반 오프라인, 자동 동기화와 폭넓은 다중 브라우저 QA는 별도 범위입니다. 미완료 기능을 배포된 것으로 기록하지 않습니다.
