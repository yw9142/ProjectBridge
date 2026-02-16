# Bridge Monorepo

Bridge는 PM(벤더)와 클라이언트가 프로젝트 진행을 한 공간에서 협업하도록 돕는 SaaS입니다.

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

## Notes
- Next.js 앱은 기본 포트가 동일하므로 동시에 여러 앱을 띄우려면 포트를 분리해 실행하세요.
- 알림 스트림(SSE)은 로그인 세션 기반으로 동작합니다.

