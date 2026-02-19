# Bridge Admin 서비스 소개

Bridge Admin은 플랫폼 운영자가 테넌트와 프로젝트를 통합 운영하는 콘솔입니다.
현재 버전은 테넌트 중심 운영 화면과 프로젝트별 탭 모니터링이 핵심입니다.

## 핵심 기능

1. 테넌트 목록 조회, 활성 상태 확인, 신규 테넌트 생성
2. 테넌트 상세에서 프로젝트/PM 사용자 현황 확인
3. 프로젝트 상세 탭(대시보드, 커뮤니케이션, 요청, 파일, 회의, 계약, 정산, Vault) 모니터링
4. 프로젝트 운영 탭 확장: 변경 이력, 멤버 설정 확인
5. 운영자 세션 기준 로그인/로그아웃 및 포털 접근 제어

## 스크린샷 캡처 기준

- 캡처 일시: 2026-02-19 (KST)
- 캡처 방식: Chrome MCP
- URL: `http://localhost:3002`
- 데모 tenantId: `d69e1dab-288b-43ee-a9fa-d183fc221255`
- 데모 projectId: `0d63ec02-93d3-48f6-af2e-171bbe2f3e05`

## 화면 미리보기

### 로그인
![Admin 로그인](../screenshots/admin-login.png)

### 테넌트 목록
![Admin 테넌트 목록](../screenshots/admin-tenants.png)

### 테넌트 상세
![Admin 테넌트 상세](../screenshots/admin-tenant-detail.png)

### 프로젝트 대시보드
![Admin 프로젝트 대시보드](../screenshots/admin-project-dashboard.png)
