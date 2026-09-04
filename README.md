# FIRE Dashboard

일본 거주자를 위한 장기 개인 FIRE Dashboard입니다. 이 저장소에는 소스 코드, 테스트, 문서 및 익명화된 예제 데이터만 둡니다. 실제 금융 데이터와 백업 파일은 절대 커밋하지 않습니다.

## 현재 상태

- Milestone 1 완료: React/TypeScript 기반, 테스트, CI, GitHub Pages 배포 기반을 구성했습니다.
- Milestone 2 완료: 금융 도메인 모델과 순수 검증 규칙을 정의했습니다.
- Milestone 3 완료: 실제 데이터 없이 대시보드 레이아웃과 빈 상태를 제공합니다.
- Milestone 4 구현: IndexedDB 계좌 저장과 등록·수정·휴지·재개 화면을 제공합니다. 이 작업 브랜치의 기능이며, main 병합과 배포 확인은 별도입니다.
- 다음 단계: Milestone 5 월별 현금흐름·계좌 잔액 입력. FIRE 계산과 JSON 백업 UI는 아직 구현하지 않았습니다.

## 계좌 관리와 저장 주의사항

계좌 이름과 종류를 등록하면 같은 브라우저에서 새로고침 후 복원됩니다. 휴지는 삭제가 아니며 다시 활성화할 수 있습니다. 이름이 같아도 서로 다른 ID의 계좌로 취급합니다. 계좌 번호나 실제 금융 정보는 입력하지 말고 현재 단계는 시험용으로 사용하세요.

데이터는 해당 사이트의 브라우저 IndexedDB에만 저장됩니다. 다른 기기·브라우저·출처(로컬 미리보기와 GitHub Pages 포함)로 자동 이동하지 않습니다. 아직 백업 기능이 없으며 브라우저 데이터 삭제나 저장소 정리로 소실될 수 있습니다. 저장 실패와 다른 탭의 변경 충돌은 화면에 표시하고, 입력을 유지합니다. 금융 지표는 월별 잔액이 없으므로 계속 빈 상태입니다.

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

새 대화나 새 작업을 시작할 때는 [프로젝트 컨텍스트 문서](docs/project-continuity.md)부터 읽으세요.
