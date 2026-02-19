<!--
PR 제목은 Conventional Commit 형식으로 작성합니다.
예) feat(pm-web): 프로젝트 대시보드 필터 추가
    fix(backend): 서명 토큰 검증 누락 수정
-->

> GitHub에서 PR 생성 시 상황에 맞게 아래 템플릿을 사용하세요.
> - 프론트엔드 전용: `.github/PULL_REQUEST_TEMPLATE/frontend.md`
> - 백엔드 전용: `.github/PULL_REQUEST_TEMPLATE/backend.md`
> - 프론트/백 동시 변경: 이 문서(`docs/pull_request_template.md`) 내용을 사용

## 변경 요약 (Summary)
- 

## 관련 이슈 (Related Issues)
- Closes #
- Related #

## 변경 범위 (Scope)
### Frontend
- [ ] `apps/pm-web`
- [ ] `apps/client-web`
- [ ] `apps/admin-web`
- [ ] `packages/ui`
- [ ] `packages/shared-types`

### Backend
- [ ] `backend` API/도메인 로직
- [ ] `backend` DB/Flyway
- [ ] `backend` 보안/인증/인가
- [ ] `backend` 이벤트/SSE/알림

## 주요 변경 사항 (Key Changes)
1. 
2. 
3. 

## API/스키마 영향 (API & Schema Impact)
- [ ] API 요청/응답 스펙 변경 없음
- [ ] API 요청/응답 스펙 변경 있음 (아래 기재)
- [ ] DB 스키마 변경 없음
- [ ] DB 스키마 변경 있음 (Flyway 파일 기재)

- API 변경:
- DB 변경:

## 테스트 및 검증 (Validation)
### Frontend
- [ ] `pnpm -C apps/pm-web lint`
- [ ] `pnpm -C apps/client-web lint`
- [ ] `pnpm -C apps/admin-web lint`
- [ ] 주요 화면 수동 확인 (Desktop/Mobile)

### Backend
- [ ] `cd backend && gradlew.bat test`
- [ ] `cd backend && gradlew.bat build`
- [ ] 멀티테넌트/권한 경계 케이스 확인

## 스크린샷/영상 (UI Changes)
- 변경 전:
- 변경 후:

## 배포 및 롤백 메모 (Deploy/Rollback Notes)
- 배포 시 유의사항:
- 롤백 방법:

## 리뷰어 참고사항 (Notes for Reviewers)
- 중점 리뷰 포인트:
- 우려되는 리스크:

## 작성자 체크리스트 (Author Checklist)
- [ ] 브랜치 네이밍 규칙 준수 (`feat/*`, `fix/*`, `chore/*`, `refactor/*`)
- [ ] `main` 최신 이력 반영 후 PR 생성
- [ ] 디버그 코드/불필요 주석 제거
- [ ] 환경 변수/문서(README 포함) 변경 시 함께 업데이트
- [ ] Breaking change 여부 및 영향 범위 명시
