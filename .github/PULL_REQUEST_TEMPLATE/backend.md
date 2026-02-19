<!--
PR 제목은 Conventional Commit 형식으로 작성합니다.
예) fix(backend): 프로젝트 요청 상태 전이 검증 추가
-->

## 변경 요약 (Summary)
- 

## 관련 이슈 (Related Issues)
- Closes #
- Related #

## 변경 범위 (Scope)
- [ ] `backend` API/도메인 로직
- [ ] `backend` DB/Flyway
- [ ] `backend` 보안/인증/인가
- [ ] `backend` 이벤트/SSE/알림

## 주요 변경 사항 (Key Changes)
1. 
2. 
3. 

## API/DB 영향 (API & DB Impact)
- [ ] API 요청/응답 스펙 변경 없음
- [ ] API 요청/응답 스펙 변경 있음 (아래 기재)
- [ ] DB 스키마 변경 없음
- [ ] DB 스키마 변경 있음 (Flyway 파일 기재)

- API 변경:
- DB 변경:

## 테스트 및 검증 (Validation)
- [ ] `cd backend && gradlew.bat test`
- [ ] `cd backend && gradlew.bat build`
- [ ] 멀티테넌트/권한 경계 케이스 확인
- [ ] 상태 전이/예외 케이스 확인

## 보안 및 운영 체크 (Security & Ops)
- [ ] 인증/인가 우회 가능성 점검
- [ ] 로그에 민감 정보 노출 없음
- [ ] 배포/롤백 시 주의사항 기재

## 작성자 체크리스트 (Author Checklist)
- [ ] 브랜치 네이밍 규칙 준수 (`feat/*`, `fix/*`, `chore/*`, `refactor/*`)
- [ ] `main` 최신 이력 반영 후 PR 생성
- [ ] 트랜잭션/락 범위 과도 여부 점검
- [ ] 문서/환경 변수 변경 시 함께 반영
- [ ] Breaking change 여부 및 영향 범위 명시
