# Bridge Deployment Runbook (Draft)

작성일: 2026-02-17

## 1) 결정 사항
- 프론트엔드: Vercel
- 백엔드: AWS

## 2) 배포 단위
- `pm-web` (`apps/pm-web`)
- `client-web` (`apps/client-web`)
- `admin-web` (`apps/admin-web`)
- `backend` (`backend`)

## 3) 권장 프로덕션 아키텍처
- Frontend: Vercel 프로젝트 3개 (PM/Client/Admin)
- Backend: AWS ECS Fargate + ALB
- Database: AWS RDS PostgreSQL
- Object Storage: AWS S3 (`MINIO_*` 대체)
- Secret 관리: AWS Secrets Manager
- DNS:
  - `pm.<domain>` -> Vercel (pm-web)
  - `client.<domain>` -> Vercel (client-web)
  - `admin.<domain>` -> Vercel (admin-web)
  - `api.<domain>` -> AWS ALB (backend)

## 4) 환경 분리
- `dev`: 로컬 도커/로컬 실행
- `staging`: Vercel Preview + AWS Staging
- `prod`: Vercel Production + AWS Production

## 5) Vercel 설정 (모노레포 주의)
`@bridge/shared-types`가 `workspace:*`이므로, 앱 폴더 단독 설치가 아니라 **레포 루트 기준 설치**가 필요합니다.

- 공통 Install Command:
  - `pnpm install --frozen-lockfile`
- pm-web Build Command:
  - `pnpm --filter pm-web build`
- client-web Build Command:
  - `pnpm --filter client-web build`
- admin-web Build Command:
  - `pnpm --filter admin-web build`

프론트 공통 환경변수:
- `NEXT_PUBLIC_API_BASE=https://api.<domain>`

## 6) AWS 백엔드 설정
백엔드는 컨테이너 배포를 기본으로 합니다.

- 빌드 아티팩트: `backend/Dockerfile`
- 런타임 포트: `8080`
- 필수 환경변수:
  - `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`
  - `JWT_SECRET`
  - `VAULT_MASTER_KEY`
  - `ALLOWED_ORIGINS` (Vercel 도메인 포함)
  - `MINIO_ENDPOINT`, `MINIO_BUCKET`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`

운영 전환 시 스토리지 권장:
- `MINIO_ENDPOINT`를 S3 엔드포인트로 전환
- 접근키/시크릿은 Secrets Manager 주입

## 7) 배포 순서
1. Backend(Staging) 배포
2. Frontend 3개(Staging) 배포
3. 스모크 테스트 (`docs/PLAYWRIGHT_MCP_E2E.md`)
4. Backend(Prod) 배포
5. Frontend 3개(Prod) 배포
6. DoD 데모 시나리오 검증 (`docs/DOD_DEMO_CHECKLIST.md`)

## 8) 롤백 규칙
- Frontend: Vercel 이전 배포로 즉시 롤백
- Backend: 이전 ECS Task Definition revision으로 롤백
- DB: Flyway 다운그레이드 대신, forward-fix 원칙

## 9) 미결정 항목
- AWS 런타임 확정: `ECS Fargate` vs `App Runner` vs `EC2`
- AWS IaC 도구 확정: `Terraform` vs `CDK`
- 프론트 도메인 최종 네이밍
