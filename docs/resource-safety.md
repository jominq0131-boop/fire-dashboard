## Milestone 9 — comparison cap

Comparison UI retains at most3 existing projection results of at most101 points each and five bounded strings per item. It performs no new history scan, database write or automatic simulation. Tables use local horizontal scrolling instead of forcing the page wider. Tests use synthetic maximum values and existing browser binaries with one worker.

## Current-account lookup in v3

Overview retains account100/range1200/latest-month100 limits and adds at most100 current balances via per-account reverse accountMonth cursor. It visits no more than2 rows per account, with no full-history scan. JSON remains32 MiB and existing record caps. IndexedDB builds the new index during transactional upgrade; this can require time/storage proportional to existing records and is not claimed to have zero resource cost. No record deletion/repair/guessing is performed.

## Milestone 7 bounded history and JSON

Overview uses a 12-month index range, at most1200 balances, a separate latest month up to100, and accounts up to100 after global counts. All totals are derived; no unbounded history render or automatic whole-backup read occurs on startup.

Explicit backup/export and restore use the existing100/3600/360000 record caps and a32 MiB UTF-8 document/combined-data cap. File size is checked before text loading, bytes before parsing, then fields/references/duplicates. Export cursors check each record and growing serialized size and reject oversized data without truncating/deleting it. Both current and incoming bounded snapshots plus parsing/canonicalization can coexist in memory;32 MiB is not a browser RAM guarantee. Data exceeding this version capability stays intact but cannot be fully exported/imported by this UI; streaming/larger-scale recovery is a future design.

# 자원 안전 정책

계좌 저장은 localStorage/sessionStorage가 아닌 IndexedDB다. 저장 공간과 JS 메모리는 다른 자원이며 IndexedDB도 객체를 읽을 때 메모리를 사용한다. [MDN getAll](https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/getAll)은 결과 복제와 count 제한을 설명한다.

## 현재 보장 범위

휴지 포함 계좌 100개는 브라우저 한도가 아닌 보수적인 앱 정책이다. 같은 트랜잭션에서 count 선검사 후 최대 100개를 읽는다. 100개는 편집 가능하고 101개 이상 저장소는 목록/생성을 오류로 중단한다. 자동 삭제나 부분 표시를 하지 않는다. 별도 복구·내보내기는 원본 보존 설계와 승인을 먼저 받는다. 백업 UI는 아직 없다.

앱 생성 레코드는 길이 제한이 있는 5필드이며 숨은 변경 이력을 누적하지 않는다. 외부 코드가 넣은 거대한 단일 객체는 검증 전에 읽힐 수 있다. 다른 탭/확장, 브라우저 자체 메모리까지 제한하지는 않는다. 과거 Chrome 메모리 문제의 원인은 이번에 진단하지 않았다.

## 로컬 작업 원칙

사용자 프로필·실제 금융 데이터·백업을 테스트/정리 대상으로 삼지 않는다. 기존 설치를 재사용하고 전역 설치·시스템 설정 변경·광범위 프로세스 종료를 피한다. 정확한 체크아웃과 권한 범위에서 요청에 필요한 명령만 실행한다. 합성 데이터·격리 컨텍스트·작업자 1개로 테스트하고 자신이 만든 서버만 종료한다. 명령별 환경변수는 해당 프로세스에만 적용한다. 모든 부작용이나 OS 자원 사용이 0임을 보장할 수 없으므로 위험/범위가 불명확하면 먼저 확인한다.

## Milestone 5 구현

월별 기록은 전체 이력 무제한 조회 대신 월/기간 인덱스와 제한 조회·렌더링을 설계한다. 월/계좌 중복, 입력 기간·건수 한도와 정수 엔 검증을 명시하고 결정론적 마이그레이션·보존 테스트를 함께 작성한다. 이후 JSON 복원도 파일 크기·레코드 수 사전 검사와 원자적 적용을 별도 설계한다. 용량 부족 때 사용자 데이터를 자동 삭제하지 않는다.

승인된 월 범위 1900-01~2199-12에서 현금흐름 총 3600건, 잔액 총 360000건, 월별 최대 100건을 제한한다. count 선검사 후 month 인덱스 getAll(month, 1/100)만 사용한다. 한 화면은 한 달/최대 100계좌이며 미입력 잔액을 자동 생성하지 않는다. 큰 총량 경계는 합성 count 응답을 이용하여 36만 건을 실제 생성하지 않고 검증한다. 실제 100계좌/100잔액에서 표시/수정과 0엔 보존을 검증한다. 외부 손상 레코드의 월 인덱스 누락까지 전체 스캔하는 복구 기능은 이번 범위에 없다.
