# 작업 재개 안내

## 체크아웃과 시작점

실제 체크아웃은 `C:\Users\MINGYU\Documents\Codex\2026-09-04\fire-dashboard-next`입니다. 이전 사본 `files-pasted-by-the-user-fire`는 수정하지 않습니다. 저장소는 `jominq0131-boop/fire-dashboard`, 배포는 GitHub Pages입니다.

## 현재 작업 — Milestone19 한국어·연금 소득

시작 main2b5193a의 CI/Pages가 성공했고 열린 작업은 없었습니다. [Issue #54](https://github.com/jominq0131-boop/fire-dashboard/issues/54), codex/milestone-19-korean-income에서 [한국어·소득 계약](milestone-19-plan.md)을 구현합니다. 전체 UI/오류/접근성/설치 설명은 한국어, 통화는 엔(JPY), NISA·세금은 일본 기준입니다. 사용자 원문은 보존합니다. 월 세후 소득·시작 월을 추가하고 DB v5 유지/JSON v7/21필드로 읽기 이행합니다. 최종 배포 증거는 연결 PR에 기록합니다.

## 직전 출시 — Milestone18 도달 후 생활비

PR #52/#53을 main2b5193a에 병합했고 최종 CI·Pages와 공개390px 인출·복원을 확인했습니다. [PR #52](https://github.com/jominq0131-boop/fire-dashboard/pull/52)에 증거를 남겼습니다.

시작 main d1f8fa0에서 [Issue #51](https://github.com/jominq0131-boop/fire-dashboard/issues/51)의 [인출 계약](milestone-18-plan.md)을 구현·로컬 검증했습니다. 기간·세후 생활비·인출 수익률·물가를 자동 저장하고 도달 후 잔액/부족 시점을 표시합니다. 구현과 배포 완료는 구분하며 최종 상태는 연결 PR에 기록합니다.

## 직전 출시 — Milestone17

시작 main은7ac6540이며 PR #46/#48의 CI·Pages까지 성공했습니다. [Issue #49](https://github.com/jominq0131-boop/fire-dashboard/issues/49)와 [Milestone17 계약](milestone-17-plan.md)에 따라 취득원가·세율 입력과 세후 인출액, 구계획 보존 이행을 구현·로컬 검증했습니다. 최종 병합 SHA·CI·Pages·공개 검증 결과는 [PR #50](https://github.com/jominq0131-boop/fire-dashboard/pull/50)의 검증 기록을 확인합니다.

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

브라우저 IndexedDB가 주 저장소이며 JSON은 버전 있는 백업입니다. 이번 작업 DB v5/JSON v7, 외부 서비스·로그인·자동 동기화는 없습니다. 기존 FIRE 가정/비교는 저장하지만 계산 결과 점은 다시 계산합니다. UI는 도메인 계약을 주입받고 저장소를 직접 구현하지 않습니다. 데이터 스키마 변경에는 결정론적 마이그레이션과 보존 테스트가 필요합니다. 대규모 재작성·동기화 구조 변경·외부 서비스 도입은 명시적 승인을 먼저 받습니다.

## 이후 후보

변동 수익률/인출 시나리오 비교와 소득 종료·물가 연동은 후속 범위입니다. 일별 장부, 금융기관 자동 수집, 서비스 워커 기반 오프라인, 자동 동기화와 폭넓은 다중 브라우저 QA는 별도 범위입니다. 미완료 기능을 배포된 것으로 기록하지 않습니다.

## 검증 비용 정책

사용자 요청(2026-09-26)에 따라 로컬 검증은 변경한 계산·저장·대표 UI 경로에 집중하고, 작은 변경마다 전체 회귀를 반복하지 않는다. 여러 변경을 묶은 최종 PR CI에 전체 회귀를 맡기며 main CI·Pages·공개 대표 흐름 확인은 유지한다. 금융 계산·데이터 보존의 관련 검증을 생략하거나 테스트를 약화하지 않는다. 실패/실질적 코드 변경이 없으면 통과 결과를 재사용한다.
