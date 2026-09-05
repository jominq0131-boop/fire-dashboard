# Infrastructure

IndexedDB 어댑터만 구현합니다. DB는 fire-dashboard v4이며 domain의 저장소 계약을 따릅니다.

- indexeddb-accounts:공통 열기/마이그레이션, count 후 제한 조회, 계좌 생성/수정.
- indexeddb-monthly:월 인덱스 조회, 참조/중복/이전 값 비교, commit 이후 성공.
- indexeddb-fire-plan:단일 계획 제한 조회, 이전 값 비교 저장, 탭 간 충돌 보존.
- indexeddb-portfolio:한 트랜잭션의 제한 잔액/현금흐름 이력·현재 잔액 읽기, FIRE 계획을 포함한 JSONv3 내보내기와 v1/v2/v3 추가 복원.

완료·실패·versionchange 때 연결을 닫습니다. 초과/손상/알 수 없는 버전은 삭제하거나 복구 값을 추정하지 않습니다. 사용자 데이터 clear/delete와 자동 동기화는 제공하지 않습니다. 차트 선택/예측은 이 계층에 새 쓰기를 추가하지 않습니다.

[자원 정책](../../docs/resource-safety.md) · [아키텍처](../../docs/architecture.md)
