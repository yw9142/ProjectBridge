<!--
PR 제목은 Conventional Commit 형식으로 작성합니다.
예) feat(pm-web): 프로젝트 목록 필터 개선
-->

## 변경 요약 (Summary)
- 

## 관련 이슈 (Related Issues)
- Closes #
- Related #

## 변경 범위 (Scope)
- [ ] `apps/pm-web`
- [ ] `apps/client-web`
- [ ] `apps/admin-web`
- [ ] `packages/ui`
- [ ] `packages/shared-types`

## 주요 변경 사항 (Key Changes)
1. 
2. 
3. 

## API 연동 영향 (API Integration Impact)
- [ ] API 요청/응답 변경 없음
- [ ] API 요청/응답 변경 있음 (아래 기재)

- API 변경:

## UI 변경 (Screenshots)
- 변경 전:
- 변경 후:

## 테스트 및 검증 (Validation)
- [ ] `pnpm -C apps/pm-web lint` (해당 시)
- [ ] `pnpm -C apps/client-web lint` (해당 시)
- [ ] `pnpm -C apps/admin-web lint` (해당 시)
- [ ] 주요 화면 수동 확인 (Desktop/Mobile)
- [ ] 접근성 기본 점검 (키보드 포커스/시맨틱)

## 작성자 체크리스트 (Author Checklist)
- [ ] 브랜치 네이밍 규칙 준수 (`feat/*`, `fix/*`, `chore/*`, `refactor/*`)
- [ ] `main` 최신 이력 반영 후 PR 생성
- [ ] 불필요한 `use client` 사용 최소화
- [ ] 공통 컴포넌트/타입 재사용 여부 확인
- [ ] 문서/환경 변수 변경 시 함께 반영
