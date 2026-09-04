# Domain

금융 모델·검증·계산과 저장소 계약을 정의합니다. React, IndexedDB, 네트워크나 UI를 import하지 않습니다.

- accounts:100계좌/이름/필드 검증, 계좌 저장소 계약.
- monthly:1900-01~2199-12, 정수 엔, 레코드/참조/상한·월별 저장소 계약.
- observations:실제 확인 날짜, 마지막 잔액 합계와 확인 상태.
- metrics/portfolio:월별 지표,12개월 창, 비교 가능한 월의 차이.
- backup:JSONv1/v2 검증, 결정론적 v2 정규화, 추가 복원 충돌 규칙.
- fire:명시적 가정,BigInt 월별 반올림,1200개월 상한과 overflow.
- storage-migrations:DBv1→v2→v3 결정론적 추가 계획.

차트 좌표·선 연결의 표시 처리는 features/charts에 있으며 금융 값을 바꾸지 않습니다. 세부 계약은 [데이터 모델](../../docs/data-model.md)을 따릅니다.
