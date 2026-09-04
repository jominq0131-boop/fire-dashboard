# FIRE Dashboard

계좌 자원 안전 보강(Issue #15): 저장소는 localStorage가 아닌 IndexedDB입니다. 휴지 포함 100개 상한, 제한 조회와 기존 초과 데이터 보존을 추가했습니다. 병합·배포 여부는 연결 PR에서 확인하세요. [자원 안전 정책](docs/resource-safety.md)을 참고하세요.

일본 거주자를 위한 장기 개인 FIRE Dashboard입니다. 이 저장소에는 소스 코드, 테스트, 문서 및 익명화된 예제 데이터만 둡니다. 실제 금융 데이터와 백업 파일은 절대 커밋하지 않습니다.

## 현재 상태

- Milestone 1 완료: React/TypeScript 기반, 테스트, CI, GitHub Pages 배포 기반을 구성했습니다.
- Milestone 2 완료: 금융 도메인 모델과 순수 검증 규칙을 정의했습니다.
- Milestone 3 완료: 실제 데이터 없이 대시보드 레이아웃과 빈 상태를 제공합니다.
- Milestone 4 완료: IndexedDB 계좌 저장과 등록·수정·비활성화·재활성화 화면을 제공합니다. [PR #12](https://github.com/jominq0131-boop/fire-dashboard/pull/12)가 main에 병합되었습니다.
- Milestone 5 로컬 구현: 월별 현금흐름·계좌별 월말 잔액 입력과 IndexedDB v2 저장을 제공합니다. main 병합·배포는 아직 하지 않았습니다. FIRE 계산과 JSON 백업 UI는 미구현입니다.

승인된 [월별 입력 설계](docs/milestone-5-plan.md)에 따라 대상 월(1900-01~2199-12)을 읽고 수입·소비 지출·투자 납입과 계좌별 잔액을 별도 저장합니다. 빈칸은 미입력, 0은 0엔입니다. 정수 엔만 허용하며 월별 최대 100개 계좌를 처리합니다. 계좌 추가 후 월별 기록을 다시 읽으면 새 계좌가 표시됩니다.

## 계좌 관리와 저장 주의사항

계좌 이름과 종류를 등록하면 같은 브라우저에서 새로고침 후 복원됩니다. 휴지는 삭제가 아니며 다시 활성화할 수 있습니다. 이름이 같아도 서로 다른 ID의 계좌로 취급합니다. 계좌 번호나 실제 금융 정보는 입력하지 말고 현재 단계는 시험용으로 사용하세요.

데이터는 해당 사이트의 브라우저 IndexedDB에만 저장됩니다. 다른 기기·브라우저·출처(로컬 미리보기와 GitHub Pages 포함)로 자동 이동하지 않습니다. 아직 백업 기능이 없으며 브라우저 데이터 삭제나 저장소 정리로 소실될 수 있습니다. 저장 실패와 다른 탭의 변경 충돌은 화면에 표시하고, 입력을 유지합니다. 월별 기록을 저장해도 대시보드 집계·차트·FIRE 지표는 아직 계산하지 않습니다.

## 개발 명령

배포 주소: [FIRE Dashboard](https://jominq0131-boop.github.io/fire-dashboard/). 계좌 관리 시험판이며 전체 MVP 완성이나 백업 가능 상태를 의미하지 않습니다.

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

최초 계획과 현재 진행의 차이는 [최초 제안 대비 점검](docs/proposal-alignment.md)에 정리했습니다. 마일스톤 번호가 최초 제안과 달라졌으며, JSON 백업·복원까지 갖추기 전에는 장기 실사용 준비 완료가 아닙니다.
