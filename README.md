# Bridge Monorepo

Bridge는 PM(벤더)와 클라이언트를 위한 B2B 멀티테넌트 프로젝트 협업 플랫폼입니다.

## Tech Stack
- Monorepo: `pnpm` + `turborepo`
- Backend: Spring Boot 3.x, Java 21, JPA/Hibernate, Flyway, JWT, SSE
- Frontend: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, TanStack Query
- Local infra: PostgreSQL, MinIO, MailHog (`docker compose`)

## Repository Structure
- `backend`: Spring Boot API
- `apps/pm-web`: PM(벤더) 웹앱
- `apps/client-web`: 클라이언트 웹앱
- `apps/admin-web`: 플랫폼 관리자 웹앱
- `packages/shared-types`: 공통 타입
- `packages/ui`: 공통 UI 패키지

## Git Workflow (Branch + PR)
직접 `main`에 push하지 않고, 항상 작업 브랜치에서 PR로 병합합니다.

1. 브랜치 생성
```bash
git checkout main
git pull origin main
git checkout -b feat/<task-name>
# 또는 fix/<task-name>, chore/<task-name>, refactor/<task-name>
```

2. 작업 후 푸시
```bash
git push -u origin <branch-name>
```

3. PR 생성 (템플릿 선택)
- 프론트엔드 PR: `.github/PULL_REQUEST_TEMPLATE/frontend.md`
- 백엔드 PR: `.github/PULL_REQUEST_TEMPLATE/backend.md`
- 프론트/백 통합 변경 PR: `docs/pull_request_template.md` 기준으로 작성

PR 제목은 Conventional Commit 형식을 사용합니다.
예: `feat(pm-web): 프로젝트 대시보드 필터 추가`

## Service Intro Docs
- 통합 소개: [docs/Product/SERVICE_INTRO.md](docs/Product/SERVICE_INTRO.md)
- Admin 소개: [docs/Product/admin/SERVICE_INTRO.md](docs/Product/admin/SERVICE_INTRO.md)
- PM 소개: [docs/Product/pm/SERVICE_INTRO.md](docs/Product/pm/SERVICE_INTRO.md)
- Client 소개: [docs/Product/client/SERVICE_INTRO.md](docs/Product/client/SERVICE_INTRO.md)

## Prerequisites
- Node.js 20+
- pnpm 10+
- Java 21
- Docker + Docker Compose

## Quick Start
1. 의존성 설치
```bash
pnpm install
```

2. 로컬 인프라 실행
```bash
docker compose up -d
```

3. 백엔드 실행
```bash
cd backend
./gradlew bootRun
# Windows (PowerShell/CMD)
gradlew.bat bootRun
```

4. 웹앱 실행 (아래 중 하나)
```bash
pnpm -C apps/pm-web dev
pnpm -C apps/client-web dev
pnpm -C apps/admin-web dev
```

## Workspace Scripts (Root)
- 전체 빌드: `pnpm build`
- 전체 린트: `pnpm lint`
- 전체 테스트: `pnpm test`
- 백엔드 + PM 웹: `pnpm dev:pm`
- 백엔드 + 클라이언트 웹: `pnpm dev:client`
- 백엔드 + 관리자 웹: `pnpm dev:admin`

## Environment Variables
루트 `.env.example`를 참고해 환경 변수를 설정하세요.

주요 값:
- `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`
- `JWT_SECRET`
- `VAULT_MASTER_KEY`
- `ALLOWED_ORIGINS`
- `MINIO_ENDPOINT`, `MINIO_BUCKET`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`

백엔드 기본 설정 파일은 `backend/src/main/resources/application.properties`입니다.

## Seed Accounts (Local)
기본 시드 계정(비밀번호: `password`)
- `admin@bridge.local`
- `pm@bridge.local`
- `client@bridge.local`

## Auth & Onboarding (Current)
- 인증 토큰은 응답 본문이 아니라 `HttpOnly` 쿠키로 관리합니다.
  - Admin: `bridge_admin_access_token` / `bridge_admin_refresh_token`
  - PM: `bridge_pm_access_token` / `bridge_pm_refresh_token`
  - Client: `bridge_client_access_token` / `bridge_client_refresh_token`
- 인증 쿠키 해석은 앱 스코프 기준입니다. 요청에 `X-Bridge-App` 헤더가 필요하며, SSE는 `?app=pm|client|admin`을 사용합니다.
- PM/Admin에서 신규 계정을 생성하면 초기 비밀번호 대신 `setupCode`가 발급됩니다.
  - PM 계정: PM 앱 `/first-password`
  - Client 계정: Client 앱 `/first-password`
- Admin API의 `GET/POST /api/admin/tenants/{tenantId}/pm-users` 경로는 호환성 유지용 이름이며, 실제 의미는 "테넌트 사용자 목록/생성"입니다.
  - 생성 기본 역할은 `PM_MEMBER`입니다.
- 로그인 실패 5회 이상이면 `LOGIN_BLOCKED`가 반환되며, 잠금 해제는 관리자 API/UI에서 수행합니다.
- 비밀번호 미초기화 계정은 로그인 시 `PASSWORD_SETUP_REQUIRED`가 반환됩니다.
- 서명 페이지 `/sign/[contractId]` 자체는 진입 가능하며, 실제 계약 조회/서명 API에서 인증 + 서명자 소유권을 강제합니다.

## Validation Commands
### Backend
```bash
cd backend
./gradlew test
./gradlew build
# Windows (PowerShell/CMD)
gradlew.bat test
gradlew.bat build
```

### Frontend
```bash
pnpm -C apps/pm-web lint && pnpm -C apps/pm-web build
pnpm -C apps/client-web lint && pnpm -C apps/client-web build
pnpm -C apps/admin-web lint && pnpm -C apps/admin-web build
```

## E2E Demo Scenarios (DoD 1~9)
1. admin: tenant 생성, PM 생성(setup code 발급)
2. pm: `/first-password` 설정 후 로그인, 프로젝트 생성, 클라이언트 초대
3. client: `/first-password` 설정 후 로그인, 초대 수락
4. 프로젝트 룸: Post/Request/Decision
5. Files: 업로드/버전/주석
6. Meetings: 생성 -> client 확인/응답
7. Contracts: envelope/fields/send -> client sign -> 완료본 생성
8. Billing: invoice 발행/확인/증빙
9. Vault: 정책/secret 생성 -> 접근요청/승인 -> reveal(열람 이벤트)

상세 체크리스트:
- `docs/Test/DOD_DEMO_CHECKLIST.md`
- `docs/Test/PLAYWRIGHT_MCP_E2E.md`

## Deployment Strategy
- Frontend: Vercel
- Backend: AWS

운영 배포 상세:
- `docs/DEPLOYMENT_RUNBOOK.md`

백엔드 컨테이너 이미지 빌드:
```bash
docker build -f backend/Dockerfile -t bridge-backend:local ./backend
```

## Notes
- Next.js 앱은 기본 포트가 동일하므로 동시에 여러 앱을 띄우려면 포트를 분리해 실행하세요.
- 알림 스트림(SSE)은 로그인 세션 기반으로 동작합니다.
