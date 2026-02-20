# Bridge Deployment Runbook

작성일: 2026-02-17  
최종 수정: 2026-02-20

## 1) 배포 타깃
- Frontend: Vercel (`pm-web`, `client-web`, `admin-web`)
- Backend: AWS ECS (Fargate) + ECR

## 2) GitHub Actions 파이프라인

### 2.1 Frontend (Vercel 3앱)
- 워크플로우: `.github/workflows/deploy-web-vercel.yml`
- 트리거:
  - `main` push (웹 앱/공통 패키지 변경 시)
  - 수동 실행(`workflow_dispatch`) 시 `preview` / `production` 선택
- 동작:
  - 모노레포 루트에서 `pnpm install --frozen-lockfile`
  - 앱별 Vercel `pull -> build -> deploy --prebuilt`

### 2.2 Backend (AWS ECS)
- 워크플로우: `.github/workflows/deploy-backend-aws.yml`
- 트리거:
  - `main` push (backend 변경 시)
  - 수동 실행(`workflow_dispatch`)
- 동작:
  - 품질 게이트 선행(배포 차단 조건)
    - `./gradlew check -x test`
    - `./gradlew test`
    - `./gradlew build -x test`
  - `backend/Dockerfile`로 이미지 빌드
  - ECR push
  - ECS task definition 렌더링 후 서비스 배포

## 3) GitHub Secrets

### 3.1 Vercel
- `VERCEL_TOKEN`
- `VERCEL_PM_ORG_ID`
- `VERCEL_PM_PROJECT_ID`
- `VERCEL_CLIENT_ORG_ID`
- `VERCEL_CLIENT_PROJECT_ID`
- `VERCEL_ADMIN_ORG_ID`
- `VERCEL_ADMIN_PROJECT_ID`

### 3.2 AWS
- `AWS_REGION`
- `AWS_ROLE_TO_ASSUME` (OIDC assume role ARN)
- `AWS_ECR_REPOSITORY`
- `AWS_ECS_CLUSTER`
- `AWS_ECS_SERVICE`
- `AWS_ECS_CONTAINER_NAME`
- `AWS_ECS_TASK_DEFINITION` (JSON 원문)

## 4) 런타임 환경변수 기준

### 4.1 Frontend
- `NEXT_PUBLIC_API_BASE=https://api.<domain>`

### 4.2 Backend
- `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`
- `JWT_SECRET`
- `VAULT_MASTER_KEY`
- `ALLOWED_ORIGINS` (3개 Vercel 도메인 포함)
- `MINIO_ENDPOINT`, `MINIO_BUCKET`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`

운영에서는 object storage를 S3로 전환하고 민감정보는 AWS Secrets Manager에서 주입한다.

## 5) 배포 순서 (권장)
1. Backend Staging 배포
2. Frontend 3앱 Preview 배포
3. 스모크/E2E 확인 (`docs/Test/PLAYWRIGHT_MCP_E2E.md`)
4. Backend Production 배포
5. Frontend 3앱 Production 배포
6. DoD 시나리오 확인 (`docs/Test/DOD_DEMO_CHECKLIST.md`)
7. 운영 헬스체크 확인 (`GET /actuator/health`)
   - LB/모니터링 프로브는 반드시 `/actuator/health`를 사용한다.
   - `/actuator/health/liveness`, `/actuator/health/readiness`는 앱 스코프 헤더가 없으면 400이므로 프로브 경로로 사용하지 않는다.

## 6) 롤백 규칙
- Frontend: Vercel 이전 배포로 즉시 롤백
- Backend: 이전 ECS task definition revision으로 롤백
- DB: 다운그레이드보다 forward-fix 우선
