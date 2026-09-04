# Architecture

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

