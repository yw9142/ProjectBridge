# DoD 데모 시나리오 1~9 체크리스트

작성일: 2026-02-17  
최종 갱신: 2026-02-20

## 기준
- `docs/Plan/PLAN.md` 18장 DoD

## 실증 실행 정보
- 실행 방식: API 실증 스크립트
- 스크립트: `scripts/run-dod-demo.ps1`
- 실행 시각(UTC): `2026-02-20T10:46:41.2457663Z`
- 증빙 파일:
  - `docs/Test/evidence/dod-demo-20260220-194639.md`
  - `docs/Test/evidence/dod-demo-20260220-194639.json`

## 시나리오 상태
1. admin: tenant 생성, PM 생성(setup code 발급)  
   - 상태: DONE  
   - 증빙: `tenantId=3135b81f-aed5-4571-9c03-763aecc7f5c8`, `pmUserId=67fc59dc-0fb4-4790-b8ca-2210d4594cfd`
2. pm: `/first-password` 설정 후 로그인, 프로젝트 생성, 클라이언트 초대  
   - 상태: DONE  
   - 증빙: `pmInitialized=true`, `projectId=cd2bd277-69db-4a77-90d3-51f537eacfcb`, `clientMemberId=5f1705a9-4160-4086-b1a5-5cf641b3d9fe`
3. client: `/first-password` 설정 후 로그인, 초대 수락  
   - 상태: DONE  
   - 증빙: `passwordInitialized=true`
4. 프로젝트 룸: Post/Request/Decision  
   - 상태: DONE  
   - 증빙: `postId=b8441311-4cca-4ae5-97b7-ebeda5c5ec86`, `requestId=48506fcc-dd0e-4ded-afc9-76aebfa32bb5`, `decisionId=88b437cc-a567-4721-9268-0b37b9d9aedc`
5. Files: 업로드/버전/주석  
   - 상태: DONE  
   - 증빙: `fileId=ad2b21e6-182a-436a-9c0a-ffcabce83526`, `fileVersionId=9f43b285-4af5-4af5-8adb-167a858f3206`, `commentId=b3c4acb0-4a06-4a15-95f2-7a0570d3f2c3`
6. Meetings: 생성 -> client 확인/응답  
   - 상태: DONE  
   - 증빙: `meetingId=43e7242c-0043-4443-b7ff-79bdeaf47ee2`, `response=ACCEPTED`
7. Contracts: envelope/fields/send -> client sign -> 완료본 생성  
   - 상태: DONE  
   - 증빙: `contractId=d740bcbe-6dfb-4395-b532-f6e4fa5f1e11`, `envelopeId=7428f28a-8db0-4062-875c-760830d36f89`, `completed=true`
8. Billing: invoice 발행/확인/증빙  
   - 상태: DONE  
   - 증빙: `invoiceId=30f9cb35-9f74-4ea0-a2f5-97018c7f6bea`, `status=CONFIRMED`, `attachments=1`
9. Vault: 정책/secret 생성 -> 접근요청/승인 -> reveal(열람 이벤트)  
   - 상태: DONE  
   - 증빙: `secretId=49afeb07-6859-4eca-8def-08793aa1cfae`, `accessRequestId=8fd2d34a-a8bb-43ef-8463-918fbba6eac2`, `revealVersion=1`

## 사전 게이트 (완료)
- [x] `backend` 테스트 통과
- [x] `pm-web` lint/build 통과
- [x] `client-web` lint/build 통과
- [x] `admin-web` lint/build 통과
- [x] Playwright MCP 스모크 시나리오 통과 (`docs/Test/PLAYWRIGHT_MCP_E2E.md`)
