# Architecture

계좌 목록/생성은 같은 트랜잭션에서 count를 검사한 뒤 `getAll(undefined, 100)`으로 제한 조회한다. 생성까지 같은 readwrite 트랜잭션이므로 동시 등록도 상한을 지킨다. 초과 저장소는 전체 객체를 읽지 않고 오류로 중단·보존한다. 앱 생성 객체는 길이가 제한된 5필드이고 UI도 100건 이내다. 후속 월별 조회는 기간/인덱스 기반으로 별도 설계한다. [자원 안전 정책](resource-safety.md)을 따른다.

## MVP decision

MVP는 GitHub Pages에서 제공되는 정적 React 앱이며, 개인 데이터는 각 기기의 IndexedDB에 저장한다. 자동 기기 동기화는 구현하지 않는다. 전체 데이터는 버전 관리되는 JSON으로 내보내고 가져올 수 있어야 한다.

## Boundaries

```text
src/app             application bootstrap and shared UI
src/features        feature UI and orchestration
src/domain          financial rules, validation, migrations; no UI/storage imports
src/infrastructure  persistence and external-service adapters
```

향후 동기화는 `infrastructure`의 저장소 구현을 추가하는 방식으로 도입한다. UI와 도메인 코드는 특정 데이터베이스나 클라우드 서비스에 직접 의존하지 않는다.

## Privacy

GitHub 저장소와 GitHub Pages에는 실제 개인 금융 데이터를 두지 않는다. `.gitignore`는 일반적인 개인 백업·로컬 데이터 경로를 제외하지만, 커밋 전 점검 책임을 대체하지는 않는다.

## Milestone 4 account storage

- `src/domain/accounts.ts`: 계좌 검증과 저장소 인터페이스. React/브라우저에 의존하지 않는다.
- `src/domain/storage-migrations.ts`: 버전 0 → 1의 순수하고 결정론적인 초기 스키마 계획.
- `src/infrastructure/indexeddb-accounts.ts`: 계획을 IndexedDB 업그레이드 트랜잭션에 적용하고 계좌 CRUD 중 생성·조회·수정만 제공한다. 삭제 API는 없다.
- `src/features/accounts/AccountManager.tsx`: 인터페이스를 주입받는 계좌 UI. 저장소 구현을 직접 import하지 않는다.
- `src/main.tsx`: 어댑터를 생성해 App과 기능 UI에 주입하는 조립 지점.

쓰기 성공은 개별 요청 성공이 아니라 트랜잭션 commit 이후에만 반환한다. 생성 시 순서 부여와 저장을 같은 readwrite 트랜잭션으로 실행한다. 수정은 같은 트랜잭션 안에서 UI가 읽은 이전 값과 현재 저장값을 비교하여 다른 탭의 변경을 덮어쓰지 않는다. 충돌 시 입력을 보존하고 재읽기를 안내한다. 탭 간 자동 동기화는 구현하지 않는다.

연결은 작업 완료·실패와 versionchange 시 닫는다. blocked, 버전 불일치, 손상된 계좌, 사용 불가·용량 부족은 실패로 처리하며 저장소를 삭제하거나 빈 데이터로 대체하지 않는다. 초기 실패 때는 쓰기 UI를 비활성화한다.

기존 GitHub Pages/IndexedDB 결정을 유지하며 새 의존성·서버·인증·외부 서비스를 추가하지 않는다.

최초 제안과의 대응, 아직 구현하지 않은 MVP 요구사항, 후속 검증 주의점은 [진행 점검](proposal-alignment.md)을 참고한다. 계좌 저장 기반을 전체 금융 데이터 저장·JSON 백업 완성으로 간주하지 않는다.
