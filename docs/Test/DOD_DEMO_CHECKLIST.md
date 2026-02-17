# DoD 데모 시나리오 1~9 체크리스트

작성일: 2026-02-17  
최종 갱신: 2026-02-17

## 기준
- `docs/Plan/PLAN.md` 18장 DoD

## 실증 실행 정보
- 실행 방식: API 실증 스크립트
- 스크립트: `scripts/run-dod-demo.ps1`
- 실행 시각(UTC): `2026-02-17T04:27:07.7625508Z`
- 증빙 파일:
  - `docs/Test/evidence/dod-demo-20260217-132706.md`
  - `docs/Test/evidence/dod-demo-20260217-132706.json`

## 시나리오 상태
1. admin: tenant 생성, PM 생성  
   - 상태: DONE  
   - 증빙: `tenantId=48324b65-a11e-4c05-bf93-74f540284c4f`, `pmUserId=bb46ca61-89a6-444d-9ebf-1497e876e226`
2. pm: 프로젝트 생성, 클라이언트 초대  
   - 상태: DONE  
   - 증빙: `projectId=d69731af-99c8-430b-abbf-5e0816522ee4`, `invitationToken=64542832a3b24d4abb5ddba0332aa999`
3. client: 초대 수락  
   - 상태: DONE  
   - 증빙: `accepted=true`
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
   - 증빙: `contractId=c32f3914-573e-46c1-b42a-bb9b02998fb9`, `envelopeId=4af68227-4295-4971-ae2f-3ca34cc6a35c`, `completed=true`
8. Billing: invoice 발행/확인/증빙  
   - 상태: DONE  
   - 증빙: `invoiceId=775b1925-a5d7-4a29-8a44-596520e6b8e9`, `status=CONFIRMED`, `attachments=1`
9. Vault: 정책/secret 생성 -> 접근요청/승인 -> reveal(열람 이벤트)  
   - 상태: DONE  
   - 증빙: `secretId=bd6eabde-2f85-4f43-8067-23f4891b51de`, `accessRequestId=c3a860ed-4573-4706-b512-aca824633094`, `revealVersion=1`

## 사전 게이트 (완료)
- [x] `backend` 테스트 통과
- [x] `pm-web` lint/build 통과
- [x] `client-web` lint/build 통과
- [x] `admin-web` lint/build 통과
- [x] Playwright MCP 스모크 시나리오 통과 (`docs/Test/PLAYWRIGHT_MCP_E2E.md`)
