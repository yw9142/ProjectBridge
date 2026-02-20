# Bridge 서비스 소개

Bridge는 Admin, PM, Client 3개 포털을 통해 프로젝트 운영과 실행을 분리한 협업 플랫폼입니다.
현재 버전은 프로젝트 단위 작업공간 중심으로 대시보드, 커뮤니케이션, 요청, 파일, 회의, 계약/전자서명, 정산, 금고(Vault)를 연결해 운영합니다.

## 포털별 역할

- Admin: 테넌트/프로젝트 운영, 프로젝트 탭 모니터링, 운영 설정 관리
- PM: 프로젝트 실행 주도, 협업 데이터 생성/관리, 계약 및 정산 운영
- Client: 요청 응답, 공유 자료 검토, 계약 서명/상태 확인, 정산 확인

## 현재 버전 공통 흐름

1. 로그인 후 프로젝트 목록에서 프로젝트 작업공간 진입
2. 대시보드에서 요청/회의/계약/정산 지표 확인
3. 커뮤니케이션/요청/파일/회의/계약 탭에서 실무 협업 수행
4. 정산 탭에서 항목 상태 관리
5. 금고(Vault) 탭에서 계정 정보 요청/제공/입력 흐름 관리
6. 계약 서명 단계에서 로그인 후 `/sign/{contractId}` 전자서명 페이지 사용

## 스크린샷 캡처 기준

- 캡처 일시: 2026-02-19 (KST)
- 캡처 방식: Chrome MCP
- 로컬 실행 URL:
  - Admin: `http://localhost:3002`
  - PM: `http://localhost:3000`
  - Client: `http://localhost:3001`
- 데모 데이터 기준:
  - Admin tenantId: `d69e1dab-288b-43ee-a9fa-d183fc221255`
  - Admin projectId: `0d63ec02-93d3-48f6-af2e-171bbe2f3e05`
  - PM/Client projectId: `22222222-2222-2222-2222-222222222222`
  - 전자서명 contractId: `7fee58e2-a2eb-4b48-84c6-7c0aef0bb749`

## 화면 미리보기

### Admin

#### 로그인
![Admin 로그인](./screenshots/admin-login.png)

#### 테넌트 목록
![Admin 테넌트 목록](./screenshots/admin-tenants.png)

#### 테넌트 상세
![Admin 테넌트 상세](./screenshots/admin-tenant-detail.png)

#### 프로젝트 대시보드
![Admin 프로젝트 대시보드](./screenshots/admin-project-dashboard.png)

### PM

#### 로그인
![PM 로그인](./screenshots/pm-login.png)

#### 프로젝트 목록
![PM 프로젝트 목록](./screenshots/pm-projects.png)

#### 대시보드
![PM 대시보드](./screenshots/pm-dashboard.png)

#### 커뮤니케이션
![PM 커뮤니케이션](./screenshots/pm-posts.png)

#### 요청
![PM 요청](./screenshots/pm-requests.png)

#### 파일
![PM 파일](./screenshots/pm-files.png)

#### 회의
![PM 회의](./screenshots/pm-meetings.png)

#### 계약
![PM 계약](./screenshots/pm-contracts.png)

#### 정산
![PM 정산](./screenshots/pm-billing.png)

#### 금고(Vault)
![PM 금고](./screenshots/pm-vault.png)

### Client

#### 로그인
![Client 로그인](./screenshots/client-login.png)

#### 프로젝트 목록
![Client 프로젝트 목록](./screenshots/client-projects.png)

#### 대시보드
![Client 대시보드](./screenshots/client-dashboard.png)

#### 요청
![Client 요청](./screenshots/client-requests.png)

#### 파일
![Client 파일](./screenshots/client-files.png)

#### 회의
![Client 회의](./screenshots/client-meetings.png)

#### 계약
![Client 계약](./screenshots/client-contracts.png)

#### 정산
![Client 정산](./screenshots/client-billing.png)

#### 금고(Vault)
![Client 금고](./screenshots/client-vault.png)

#### 전자서명
![Client 전자서명](./screenshots/client-signing.png)

## 참고 문서

- `README.md`
- `docs/Plan/PLAN.md`
- `docs/Plan/PLAN_PROGRESS.md`
