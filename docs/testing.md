# Testing strategy

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
