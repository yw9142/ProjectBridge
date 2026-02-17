# Bridge 서비스 소개

Bridge는 PM(벤더), 클라이언트, 관리자 3개 포털을 통해 프로젝트 협업을 한곳에서 처리하는 B2B SaaS입니다.  
요청/결정/파일/회의/전자서명/정산/Vault를 하나의 프로젝트 룸에서 연결해 운영할 수 있습니다.

## 주요 사용자

- 관리자(Admin): 테넌트/사용자/프로젝트 운영 관리
- PM(Vendor): 프로젝트 생성과 실행, 협업 플로우 주도
- 클라이언트(Client): 요청 응답, 파일 검토, 계약/정산 확인

## 핵심 기능

1. **테넌트·사용자 관리**: 관리자 포털에서 테넌트 생성, PM 사용자 생성, 프로젝트 모니터링
2. **프로젝트 생성·초대**: PM이 프로젝트를 만들고 클라이언트를 초대/연결
3. **커뮤니케이션**: 게시글/댓글 기반으로 공유형 커뮤니케이션 진행
4. **요청·결정 워크플로**: 요청 등록 및 상태 전이, 결정 승인/반려 처리
5. **파일 협업**: 파일 등록, 버전 관리, 주석/해결(Resolve) 흐름 지원
6. **회의 운영**: 회의 일정 생성, 참석 응답, 링크 공유
7. **전자서명(eSign)**: Envelope/서명 필드/수신자 기반 서명 처리와 상태 추적
8. **정산(Billing)**: 인보이스 상태 관리와 증빙 첨부 확인
9. **Vault 보안정보 관리**: 접근 요청/승인/열람 이력 기반 비밀정보 운용

## 화면 미리보기

아래 이미지는 2026-02-17 기준 로컬 데모 환경에서 Chrome MCP로 캡처한 화면입니다.

### Admin

**Admin 로그인**

![Admin 로그인](./screenshots/admin-login.png)

**테넌트 목록**

![Admin 테넌트 목록](./screenshots/admin-tenants.png)

**테넌트 상세(프로젝트/PM 사용자 포함)**

![Admin 테넌트 상세](./screenshots/admin-tenant-detail.png)

**프로젝트 대시보드(관리자 뷰)**

![Admin 프로젝트 대시보드](./screenshots/admin-project-dashboard.png)

### PM

**PM 로그인**

![PM 로그인](./screenshots/pm-login.png)

**프로젝트 목록**

![PM 프로젝트 목록](./screenshots/pm-projects.png)

**프로젝트 대시보드**

![PM 대시보드](./screenshots/pm-dashboard.png)

**커뮤니케이션(게시글)**

![PM 게시글](./screenshots/pm-posts.png)

**요청 관리**

![PM 요청](./screenshots/pm-requests.png)

**파일 관리**

![PM 파일](./screenshots/pm-files.png)

**회의 관리**

![PM 회의](./screenshots/pm-meetings.png)

**계약/eSign 관리**

![PM 계약](./screenshots/pm-contracts.png)

**정산 관리**

![PM 정산](./screenshots/pm-billing.png)

**Vault 관리**

![PM Vault](./screenshots/pm-vault.png)

### Client

**Client 로그인**

![Client 로그인](./screenshots/client-login.png)

**내 프로젝트**

![Client 프로젝트 목록](./screenshots/client-projects.png)

**대시보드**

![Client 대시보드](./screenshots/client-dashboard.png)

**요청 확인/응답**

![Client 요청](./screenshots/client-requests.png)

**파일 검토**

![Client 파일](./screenshots/client-files.png)

**회의 응답**

![Client 회의](./screenshots/client-meetings.png)

**계약 검토**

![Client 계약](./screenshots/client-contracts.png)

**정산 확인**

![Client 정산](./screenshots/client-billing.png)

**Vault 정보 확인**

![Client Vault](./screenshots/client-vault.png)

**전자서명 페이지**

![Client 전자서명](./screenshots/client-signing.png)

## 참고 문서

- `README.md`
- `docs/Plan/PLAN.md`
- `docs/Plan/PLAN_PROGRESS.md`
