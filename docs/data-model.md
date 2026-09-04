## Milestone 7 JSON v1 and derived history

IndexedDB remains v2. JSON first-format version 1 contains exactly schemaVersion, accounts, monthlyCashFlows and accountBalanceSnapshots. Existing record fields and validation are unchanged, including IDs, timestamps, optional notes, inactive accounts, zero yen and future months. Top-level/record extra fields, duplicate IDs/natural keys, broken references, unsupported versions and unsafe values are rejected. normalizeBackup performs deterministic v1-to-v1 canonical ordering; there is no released older JSON format to migrate. Versions 0/future are rejected instead of inventing conversion. Domain tests cover normalization/round-trip/version refusal and DB v1→v2 migration tests remain intact.

Latest total means the most recent recorded month at or before the local current month, summed across recorded accounts only. Missing balances are not zero/carried forward and this is not live valuation/net worth. History is at most 12 months; the first row has no prior-window comparison. Changes require adjacent months with exactly matching nonempty account-ID sets and represent balance change, not investment return. Percent is rounded half away from zero to one decimal using integer intermediate arithmetic; zero base or percentage overflow has no percentage. Unsafe total sums remain calculation overflow.

## Milestone 6 calculation contract (no schema change)

IndexedDB remains v2 with unchanged fields, indexes and migrations. Metrics are derived, never stored. Financial assets sum only recorded month-end balances, including inactive accounts; absent balances are unknown, not zero. Input coverage uses the account list at read time and is not a historical completeness claim. Assets are not net worth because liabilities are not modeled. Income minus consumption expenses is surplus; subtract investment contribution separately for remaining cash. These values are not portfolio returns or balance deltas. Missing cash yields missing metrics. BigInt intermediates preserve exact arithmetic; results outside signed safe-integer yen range display calculation overflow independently, without changing source records. Month mismatches, duplicate balances and invalid references are rejected.

# Data model principles

## 계좌 자원 정책 — Issue #15

휴지 포함 최대 100개를 생성한다. 100개에서는 수정·휴지·재개가 가능하다. 기존 101개 이상은 목록/등록 오류로 중단하며 삭제·부분 표시하지 않는다. 이름은 trim 이전에도 최대 100 UTF-16 코드 단위, 저장 ID도 최대 100이다(생성 UUID는 36). 저장 레코드는 id/name/category/isActive/sortOrder 5필드만 허용하며 다른 필드는 오류로 원본 보존한다. 정상 기존 앱 레코드 형식은 동일하다. 저장소/필드 변환이나 DB 버전 변경은 없는 런타임 정책 보강이다. 초과/비정상 데이터의 자동 마이그레이션·복구는 하지 않는다.

Milestone 2 도메인, Milestone 4 계좌 저장에 이어 작업 브랜치의 Milestone 5는 월별 현금흐름·잔액을 영속화한다. FIRE 설정은 미구현이다. v2의 병합/배포 확인은 PR #18의 릴리스 기록을 따른다.

- 금액은 정수 일본 엔으로 저장한다.
- 월별 현금흐름과 계좌별 월말 잔액 스냅샷을 분리한다.
- 계좌 유형은 확장 가능한 식별자로 관리한다.
- 모든 JSON export에는 `schemaVersion`을 포함한다.
- 스키마 변경에는 순수하고 결정론적인 마이그레이션과 테스트가 필요하다.

## 기존 IndexedDB v1 (보존)

- DB 이름: `fire-dashboard`, 네이티브 IndexedDB 버전: `1`.
- 객체 저장소: `accounts`, keyPath: `id`. 추가 인덱스나 샘플 데이터는 없다.
- 필드: `id`(비어 있지 않은 문자열), `name`(trim된 1~100 UTF-16 코드 단위 문자열), `category`(기존 5종), `isActive`(boolean), `sortOrder`(0 이상의 안전한 정수).
- 이름 중복은 허용한다. 식별자는 생성 시 UUID로 부여하며 수정·휴지·재개에도 유지한다.
- `sortOrder`는 첫 계좌에서 0, 이후 저장된 최댓값 + 1로 트랜잭션 내에서 부여한다. 같으면 ID 사전순으로 안정 정렬한다. 순서 변경 UI는 범위 밖이다.
- 계좌 휴지는 `isActive=false`이며 레코드는 삭제하지 않는다. 잔액은 계좌 레코드에 포함하지 않는다.

## 초기 마이그레이션과 보존

`storageMigrationPlan(0, 1)`은 빈 `accounts` 저장소를 생성하는 하나의 고정 계획을 반환한다. DB가 없는 버전 0에서만 적용하며, 버전 1 재열기는 무변경이다. 시간·난수·개인 데이터는 마이그레이션에 사용하지 않는다. UUID 생성은 이후 사용자가 계좌를 등록할 때만 한다.

이전 배포에는 저장소가 없었으므로 이전 사용자 데이터를 변환하는 단계는 없다. 현재 지원 v2보다 높은 알 수 없는 미래 버전은 거부하며 자동 다운그레이드·삭제·재초기화하지 않는다. 실패한 업그레이드/쓰기는 IndexedDB 트랜잭션으로 롤백된다. 저장된 데이터의 유효성 검사 실패는 오류로 알리고 원본을 유지한다.

향후 변경은 새 버전의 결정론적 마이그레이션과 보존 회귀 테스트를 추가한다. JSON `schemaVersion`은 향후 백업 형식 버전이며, 현재 IndexedDB 버전과 혼동하지 않는다. JSON import/export는 아직 구현되지 않았다.

## Milestone 5 IndexedDB v2

accounts와 기존 레코드는 그대로 둔다. monthlyCashFlows(id)는 month unique 인덱스를, accountBalanceSnapshots(id)는 [month, accountId] unique 및 month 인덱스를 가진다. 기존 도메인 필드를 저장하며 추가 필드는 오류 처리한다. createdAt/updatedAt은 정확한 UTC ISO 밀리초 형식과 유효 달력 날짜이며 수정 시 createdAt 보존, updatedAt 비감소를 유지한다. ID는 1~100, 메모는 선택적으로 최대 1000 UTF-16 코드 단위다.

입력 월은 정확한 YYYY-MM, 1900-01~~2199-12다. 기본 월은 기기의 로컬 달력으로 선택한다. 수입/소비 지출/투자 납입/잔액은 0~~Number.MAX_SAFE_INTEGER의 정수 엔이다. 빈칸을 0으로 바꾸지 않으며 부호/소수/지수/쉼표는 거부한다. 총 현금흐름 3600개, 총 잔액 360000개, 월별 잔액 100개다. 휴지 계좌를 포함해 존재하는 계좌만 잔액을 기록할 수 있고 휴지 시 잔액은 보존한다.

v0→v2는 v1 생성과 v2 추가 순서, v1→v2는 빈 월별 저장소/인덱스 추가만, v2 재열기는 무변경이다. 기존 계좌 전체 조회/변환, 시간·난수 생성은 업그레이드에 없다. 하나의 업그레이드 트랜잭션이 실패하면 v1과 계좌 원본을 보존한다. v1 계획 자체도 명시적 대상 버전으로 테스트한다. JSON schemaVersion과 백업/복원은 미구현이다. 상세 계약은 [월별 설계](milestone-5-plan.md)를 따른다.
