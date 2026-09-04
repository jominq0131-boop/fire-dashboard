# Testing strategy

금액 계산, 데이터 검증, 마이그레이션, import/export를 최우선으로 테스트한다.

- Vitest: 도메인 단위 테스트 및 통합 수준 검증
- Playwright: 핵심 사용자 흐름 회귀 테스트
- GitHub Actions: lint, formatting, typecheck, unit test, production build 실행

의미 없는 커버리지 목표는 두지 않는다. 금융 계산이나 데이터 보존 관련 버그는 재현 테스트를 추가한 뒤 수정한다.

