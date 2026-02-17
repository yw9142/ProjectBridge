# Bridge 서비스 소개

Bridge는 관리자(Admin), PM(Vendor), 클라이언트(Client) 3개 포털로 구성된 B2B 프로젝트 협업 서비스입니다.
프로젝트 생성부터 커뮤니케이션, 파일 검토, 회의, 계약/전자서명, 정산, Vault까지 하나의 흐름으로 운영합니다.

## 포털별 역할

- Admin: 테넌트/사용자/프로젝트 운영 관리
- PM: 프로젝트 생성 및 실행, 실무 협업 주도
- Client: 요청 응답, 파일/계약/정산 검토 및 승인

## 공통 제공 기능

1. 테넌트/사용자 관리
2. 프로젝트 생성 및 멤버 초대
3. 게시글 기반 커뮤니케이션
4. 요청 상태 관리
5. 파일 버전 및 리뷰 협업
6. 회의 일정/참석 관리
7. 계약 및 전자서명(eSign)
8. 정산(Billing) 상태 관리
9. Vault 보안 정보 관리

## 스크린샷 캡처 기준

- 캡처 일시: 2026-02-17 (KST)
- 캡처 방식: Chrome MCP
- 로컬 실행 URL:
  - Admin: `http://localhost:3002`
  - PM: `http://localhost:3000`
  - Client: `http://localhost:3001`
- 데모 데이터 기준:
  - tenant slug: `dod-20260217192452`
  - projectId: `0d63ec02-93d3-48f6-af2e-171bbe2f3e05`

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
![PM 게시글](./screenshots/pm-posts.png)

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

#### Vault
![PM Vault](./screenshots/pm-vault.png)

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

#### Vault
![Client Vault](./screenshots/client-vault.png)

#### 전자서명
![Client 전자서명](./screenshots/client-signing.png)

## 참고 문서

- `README.md`
- `docs/Plan/PLAN.md`
- `docs/Plan/PLAN_PROGRESS.md`
