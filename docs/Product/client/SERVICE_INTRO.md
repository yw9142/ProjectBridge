# Bridge Client 서비스 소개

Bridge Client는 발주/클라이언트가 프로젝트 진행 상태를 확인하고 응답하는 협업 작업공간입니다.
현재 버전은 프로젝트 사이드바 기반으로 요청, 파일, 계약, 정산, 금고를 빠르게 처리할 수 있게 구성되어 있습니다.

## 핵심 기능

1. 내 프로젝트 목록에서 참여 프로젝트 진입
2. 대시보드에서 요청/회의/계약 현황과 최근 액션 확인
3. 요청 상태 변경 및 저장(확인/진행 중/완료/반려/취소)
4. 공유 파일 트리 조회 및 최신 버전 다운로드
5. 회의 일정 확인 및 참석 응답 전송
6. 계약 서명 상태 확인, 상세 페이지 진입
7. 정산 항목 상태 확인/변경
8. 금고(Vault) 계정 정보 입력/재입력
9. 전자서명 페이지(`/sign/{contractId}`) 진입 후, 서명 데이터 조회/제출 API에서 인증 및 서명자 소유권 검증

## 스크린샷 캡처 기준

- 캡처 일시: 2026-02-19 (KST)
- 캡처 방식: Chrome MCP
- URL: `http://localhost:3001`
- 데모 projectId: `22222222-2222-2222-2222-222222222222`
- 전자서명 contractId: `7fee58e2-a2eb-4b48-84c6-7c0aef0bb749`

## 화면 미리보기

### 로그인
![Client 로그인](../screenshots/client-login.png)

### 내 프로젝트
![Client 프로젝트 목록](../screenshots/client-projects.png)

### 대시보드
![Client 대시보드](../screenshots/client-dashboard.png)

### 요청
![Client 요청](../screenshots/client-requests.png)

### 파일
![Client 파일](../screenshots/client-files.png)

### 회의
![Client 회의](../screenshots/client-meetings.png)

### 계약
![Client 계약](../screenshots/client-contracts.png)

### 정산
![Client 정산](../screenshots/client-billing.png)

### 금고(Vault)
![Client 금고](../screenshots/client-vault.png)

### 전자서명
![Client 전자서명](../screenshots/client-signing.png)
