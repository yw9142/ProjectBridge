# DoD 데모 시나리오 1~9 체크리스트

작성일: 2026-02-17

## 기준
- `docs/PROJECT.md` 11장 E2E 데모 시나리오(1~9)
- `docs/PLAN.md` 18장 DoD

## 시나리오 상태
1. admin: tenant 생성, PM 생성  
   - 상태: PENDING
2. pm: 프로젝트 생성, 클라이언트 초대  
   - 상태: PENDING
3. client: 초대 수락  
   - 상태: PENDING
4. 프로젝트 룸: Post/Request/Decision  
   - 상태: PENDING
5. Files: 업로드/버전/주석  
   - 상태: PENDING
6. Meetings: 생성 -> client 확인/응답  
   - 상태: PENDING
7. Contracts: envelope/fields/send -> client sign -> 완료본 생성  
   - 상태: PENDING
8. Billing: invoice 발행/확인/증빙  
   - 상태: PENDING
9. Vault: 정책/secret 생성 -> 접근요청/승인 -> reveal(열람 이벤트)  
   - 상태: PENDING

## 사전 게이트 (완료)
- [x] `backend` 테스트 통과
- [x] `pm-web` lint/build 통과
- [x] `client-web` lint/build 통과
- [x] `admin-web` lint/build 통과
- [x] Playwright MCP 스모크 시나리오 통과 (`docs/PLAYWRIGHT_MCP_E2E.md`)

## 실행 방법 (권장 순서)
1. `docker compose up -d`
2. `cd backend && gradlew.bat bootRun`
3. `pnpm -C apps/pm-web dev --port 3000`
4. `pnpm -C apps/client-web dev --port 3001`
5. `pnpm -C apps/admin-web dev --port 3002`
6. 시나리오 1~9를 순서대로 수행하고 증빙(스크린샷/요청응답)을 이 문서에 업데이트
