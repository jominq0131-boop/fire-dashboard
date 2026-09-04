# FIRE Dashboard

일본 거주자를 위한 장기 개인 FIRE Dashboard입니다. 이 저장소에는 소스 코드, 테스트, 문서 및 익명화된 예제 데이터만 둡니다. 실제 금융 데이터와 백업 파일은 절대 커밋하지 않습니다.

## 현재 상태

Milestone 1: 프로젝트 기반만 구성되었습니다. 금융 기능이나 실제 데이터 모델은 아직 구현하지 않았습니다.

## 개발 명령

```bash
npm install
npm run dev
npm run lint
npm run format
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## 아키텍처 원칙

- MVP 데이터는 브라우저 IndexedDB에 보관한다.
- JSON은 버전이 있는 백업·가져오기·내보내기 형식으로 사용한다.
- UI, 금융 도메인, 저장소 구현을 분리한다.
- 자동 동기화는 MVP 범위 밖이며, 필요성이 검증될 때 별도 마일스톤으로 도입한다.

자세한 내용은 [아키텍처 문서](docs/architecture.md)와 [데이터 모델 원칙](docs/data-model.md)을 참고하세요.

