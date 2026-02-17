# Bridge 적용 플랜 및 진행상황

작성일: 2026-02-16  
기준 플랜: `Bridge 프로덕션 구축 통합 실행계획 v7.2`

## 1) 적용 플랜(v7.2) 요약 고정본

### 1.1 핵심 원칙
- `PROJECT.md` 0~13 누락 없이 구현
- 모노레포: `pnpm + Turborepo`
- Docker 필수: `postgres`, `minio`, `mailhog`
- 인증 전면 강제: 최초 진입 로그인, 미인증 차단, 세션 만료 리다이렉트
- `/sign/[recipientToken]` 로그인 필수 + 토큰 소유권 검증 필수
- 백엔드 영속성: `Spring Data JPA(Hibernate)` 강제
- 무한루프/메모리 폭주 방지: 보수형 메모리 프로파일 고정
- 프레임워크 생성: 수동 뼈대 금지, 공식 설치/스캐폴드 명령만 사용
- 프론트 `ref` 폴더는 디자인 참고만 사용(기능/로직/데이터모델 복사 금지)

### 1.2 아키텍처/스택
- Backend: Spring Boot 3, Java, PostgreSQL, Flyway, JPA/Hibernate, Spring Security, JWT, springdoc
- Frontend: Next.js App Router, TypeScript, Tailwind, TanStack Query
- Realtime: SSE(`/api/notifications/stream`) 필수
- Storage: MinIO(S3 호환) + Presigned URL
- 옵션 연동: Google/Email 플러그형 기본 비활성

### 1.3 데이터/보안 고정
- single DB/single schema + 전 도메인 `tenant_id` 강제
- 모든 요청에서 `tenant_id + project membership + role` 검증
- 소프트삭제(`deleted_at`) + 감사필드(`created_at/by`, `updated_at/by`)
- JWT access 15분, refresh 30일, refresh hash 저장 + revoke
- Vault AES-256-GCM(`secret_ciphertext`, `nonce`, `version`)
- 알림 발행 순서 고정: `commit -> outbox -> notifications 저장 -> SSE push`

### 1.4 구현 범위(요약)
- AUTH, ADMIN, PROJECTS/INVITATIONS, POSTS/COMMENTS, REQUESTS/EVENTS, DECISIONS
- FILES/FILE_VERSIONS/FILE_COMMENTS
- MEETINGS/ATTENDEES/ACTION_ITEMS
- CONTRACTS/E-SIGN, SIGNING
- BILLING(결제처리 제외)
- VAULT
- NOTIFICATIONS/SSE

### 1.5 프론트 요구(요약)
- admin/pm/client 라우트 전량 구현
- 로그인 선행, `next` 복귀
- `/sign/[recipientToken]` 로그인 후 소유권 검증
- 디자인 기준: `frontend-design + ui-ux-pro-max`, `ref`는 디자인만 참고

### 1.6 테스트/완료 기준(요약)
- 인증/권한/세션만료/서명소유권/프로젝트룸/파일버전/회의/eSign/Billing/Vault/SSE
- Playwright MCP 시나리오 통과
- 백엔드 통합테스트 + 빌드/린트/테스트 통과
- Docker 기준 데모 시나리오 재현

---

## 2) 현재 진행상황(실제 작업 결과)

## 2.1 전체 페이즈 상태

| Phase | 상태 | 비고 |
|---|---|---|
| Phase 0 환경 게이트 | 완료 | Docker/런타임 확인, Playwright MCP 스모크 시나리오 수행 완료 |
| Phase 1 부트스트랩 | 대부분 완료 | 모노레포/워크스페이스/3개 Next 앱/Backend 스캐폴드 완료 |
| Phase 2 백엔드 기반 | 완료(1차) | Flyway/JPA/JWT/RBAC/SSE/Outbox/API 매핑 완료 |
| Phase 3 Core Project Room | 백엔드 완료 | 프론트 화면 미완료 |
| Phase 4 Contracts & eSign | 백엔드 완료 | 프론트 화면 미완료 |
| Phase 5 Billing & Vault | 백엔드 완료 | 프론트 화면 미완료 |
| Phase 6 프론트 3앱 | 진행중(2차) | 3앱 라우트/로그인 가드/서명 경로 + Playwright MCP 스모크 + UI/UX 품질 게이트 완료 |
| Phase 7 하드닝/문서화 | 완료 | DoD 1~9 실증 완료 + Vercel/AWS 배포 파이프라인(GitHub Actions) 구현 완료 |

## 2.2 완료된 작업(백엔드 중심)

### 공통/인프라
- 루트 워크스페이스 구성
  - `package.json`, `pnpm-workspace.yaml`, `turbo.json`
  - `packages/shared-types`, `packages/ui` 초기화
- Docker/환경
  - `docker-compose.yml` (`postgres`, `minio`, `mailhog`)
  - `.env.example`
  - `README.md`
- 메모리 가드
  - `backend/gradle.properties` (`org.gradle.jvmargs`, `org.gradle.workers.max`)

### 백엔드 핵심
- 보안/JWT
  - JWT 발급/검증 필터, Security 설정, 인증 유틸
  - access/refresh 토큰, refresh 토큰 해시 저장/폐기
- 멀티테넌시/권한
  - 프로젝트 멤버십/역할 검증 가드 서비스
- 데이터 계층
  - JPA 엔티티/리포지토리 다수 구성(도메인 전반)
  - BaseEntity/TenantScopedEntity, enum 정리
- DB 마이그레이션
  - `V1__init.sql` (도메인 스키마)
  - `V2__seed.sql` (시드 계정/테넌트/프로젝트)
- 실시간 알림
  - Outbox 저장/소비 + Notification 저장 + SSE 전송
- Vault
  - AES-256-GCM 암복호화 유틸
- 옵션 인터페이스
  - Google/Email disabled provider 구현

### REST API 매핑
- 플랜 v7.2의 백엔드 API 목록 기준으로 컨트롤러 매핑 완료
- 컨트롤러 클래스 14개 생성
  - `AuthController`, `AdminController`, `ProjectController`, `PostController`, `RequestController`, `DecisionController`, `FileController`, `MeetingController`, `GoogleIntegrationController`, `ContractController`, `SigningController`, `BillingController`, `VaultController`, `NotificationController`

### 검증 결과
- `backend` 테스트 통과: `./gradlew test`
- `backend` 빌드 통과: `./gradlew build -x test`
- `bootRun`은 PostgreSQL 미기동 시 정상적으로 DB 연결 실패 확인됨  
  (실행 전 `docker compose up -d` 필요)

## 2.3 프론트 현재 상태

- 상태: **재개 후 1차 구현 완료**
- 이번 세션 반영 내용
  - `pm-web` 프로젝트 라우트 전량 생성  
    (`/pm/projects/[projectId]/dashboard/posts/requests/decisions/files/meetings/contracts/billing/vault/settings/members`)
  - `admin-web` 운영 라우트 전량 생성  
    (`/admin/login`, `/admin/tenants`, `/admin/tenants/new`, `/admin/tenants/[tenantId]`, `/admin/tenants/[tenantId]/pm-users`, `/admin/users/[userId]`)
  - `client-web` 라우트 전량 생성  
    (`/login`, `/client/projects`, `/client/projects/[projectId]/home/requests/posts/files/meetings/contracts/billing/vault`, `/sign/[recipientToken]`)
  - 앱별 로그인 가드(`middleware.ts`) + `next` 복귀 흐름 추가
  - 앱별 인증 유틸(`lib/auth.ts`) + Bearer 헤더 기반 API 유틸(`lib/api.ts`) 추가
  - `/sign/[recipientToken]` 페이지에서 `GET /api/signing/{recipientToken}` 호출로 소유권 검증 결과를 표시하고, `viewed/submit` 액션 버튼 연결
  - `pm-web`, `admin-web`, `client-web` lint 통과
- 미완료/잔여
  - 없음 (DoD 1~9 실증 완료, 배포 파이프라인 구현 완료)

---

## 3) v7.2 체크리스트 기준 진행률

## 3.1 백엔드 항목
- [x] Spring Boot + JPA/Hibernate + Flyway
- [x] JWT access/refresh + refresh revoke
- [x] 멀티테넌시 + 멤버십 + 역할 검증
- [x] 도메인 API 매핑 전량(백엔드)
- [x] Outbox + Notification + SSE 스트림
- [x] Vault AES-256-GCM
- [x] Docker compose 기본 인프라
- [x] 시드 데이터 초안
- [x] 백엔드 테스트/빌드 통과

## 3.2 프론트/QA 항목
- [x] admin-web 라우트 전량
- [x] pm-web 라우트 전량
- [x] client-web 라우트 전량
- [x] `/sign/[recipientToken]` 로그인 강제 + 소유권 검증 UI 흐름
- [x] Playwright MCP E2E
- [x] UI/UX Quality Gate(Phase 6/7)
- [x] 최종 DoD 데모 시나리오 1~9

---

## 4) 다음 재개 시 우선순위
1. 운영 환경 시크릿 주입 후 배포 파이프라인 실배포 검증
2. 프로덕션 도메인 연결 및 롤백 리허설

---

## 5) 참고 경로
- 플랜 기준 문서: `PROJECT.md`
- 진행 로그 문서: `PLAN_PROGRESS.md` (현재 파일)

## 6) 2026-02-16 추가 업데이트 (pm-web 우선 진행)

### 6.1 범위 조정
- 사용자 요청에 따라 이번 사이클은 `pm-web`만 우선 완료 대상으로 고정.
- `admin-web`, `client-web` 추가 보완은 보류하고 `pm-web` 품질 게이트를 먼저 통과.

### 6.2 이번 사이클 완료 항목 (`PLAN.md` Phase 6 연계)
- `pm-web` API 연동 화면의 effect 패턴 정리 (무한 렌더/연쇄 렌더 위험 제거)
  - `apps/pm-web/src/app/pm/profile/integrations/google/page.tsx`
  - `apps/pm-web/src/app/pm/projects/[projectId]/requests/page.tsx`
  - `apps/pm-web/src/app/pm/projects/[projectId]/posts/page.tsx`
- 로그인 페이지 `useSearchParams`를 Next.js 16 규칙에 맞게 Suspense 경계로 보완
  - `apps/pm-web/src/app/login/page.tsx`

### 6.3 검증 결과
- `pnpm -C apps/pm-web lint` ✅ 통과
- `pnpm -C apps/pm-web build` ✅ 통과
- 빌드 경고(비차단):
  - Next.js workspace root lockfile 경고
  - middleware -> proxy deprecation 경고

### 6.4 현재 판단
- `PLAN.md` 기준 Phase 6에서 `pm-web` 단위의 라우트/API 연결/인증 흐름은 실행 가능한 수준까지 도달.
- 다음 사이클은 보류한 `admin-web`, `client-web` 동일 품질 게이트(lint/build + 시나리오) 적용 필요.

## 7) 2026-02-16 추가 업데이트 (요구사항 11건 반영)

### 7.1 pm-web 화면/UX 반영
- 커뮤니케이션을 게시판 구조로 분리:
  - 목록: `apps/pm-web/src/app/pm/projects/[projectId]/posts/page.tsx`
  - 작성: `apps/pm-web/src/app/pm/projects/[projectId]/posts/new/page.tsx`
  - 상세/댓글: `apps/pm-web/src/app/pm/projects/[projectId]/posts/[postId]/page.tsx`
- 요청/결정 화면 통합:
  - `apps/pm-web/src/app/pm/projects/[projectId]/requests/page.tsx`
  - 결정 메뉴는 요청/결정으로 통합(`PmSidebar` + decisions 페이지 redirect)
- 결정의 `relatedFileVersionId` 입력 방식을 드롭다운(현재 파일 버전)으로 변경.
- 결정/계약 수정 시 관련 파일 버전을 "없음"으로 저장하면 실제 연결 해제가 반영되도록 PATCH payload/서버 로직 보강.
- 파일 화면 UX 보강:
  - 파일 선택 기반 버전 등록
  - presign 이후 실제 PUT 업로드 + complete 처리
- 회의 입력 단순화(제목, Meet URL, 요일/시간 중심) 및 수정/삭제 지원.
- 계약/eSign, 정산, Vault 화면을 선택 중심 흐름으로 정리하고 수정/삭제/요청 흐름 보강.
- 멤버 설정에서 역할 수정/멤버 삭제 가능하도록 UI 반영.

### 7.2 backend API/오류 처리 반영
- UUID/JSON 파싱 오류를 500이 아닌 400 validation 에러로 응답하도록 예외 매핑 추가:
  - `backend/src/main/java/com/bridge/backend/common/api/GlobalExceptionHandler.java`
- 멤버 수정/삭제 API 추가:
  - `PATCH /api/projects/{projectId}/members/{memberId}`
  - `DELETE /api/projects/{projectId}/members/{memberId}`
- 요청/결정/파일/회의/계약/정산 CRUD 보강(수정/삭제 포함).
- 결정/계약 연동용 파일 버전 조회, 계약별 envelope 조회, 인보이스 첨부 조회 API 추가.
- Vault 계정요청 단순 흐름 API 추가(요청 생성, provision, 목록 조회).

### 7.3 검증 결과
- backend: `.\gradlew.bat test` ✅ 통과
- pm-web: `pnpm -C apps/pm-web lint` ✅ 통과
- pm-web: `pnpm -C apps/pm-web build` ✅ 통과

### 7.4 잔여
- Playwright E2E 시나리오(Phase 6/7) 미수행
- `admin-web`, `client-web` 동일 수준의 통합 시나리오 정리는 다음 사이클로 이월

## 8) 2026-02-16 추가 업데이트 (알림 정책 정리)

### 8.1 요구사항 반영
- PM 알림센터 노이즈 감소:
  - 백엔드 알림 생성 정책을 `CLIENT_*` 액터 이벤트만 PM 사용자에게 전달하도록 변경.
  - PM 사용자 본인 액션은 실시간 알림으로 쌓이지 않도록 조정.
- PM 변경 이벤트 분리:
  - PM 액션 이벤트를 별도 조회하는 API 추가: `GET /api/notifications/pm-events`
  - `projectId` 쿼리 필터 지원으로 프로젝트 단위 이력 조회 가능
  - `pm-web`에 변경 이력 페이지 추가: `/pm/projects/[projectId]/events`
  - 사이드바에 `변경 이력` 메뉴 추가.

### 8.2 코드 반영 위치
- Backend
  - `backend/src/main/java/com/bridge/backend/domain/notification/OutboxService.java`
  - `backend/src/main/java/com/bridge/backend/domain/notification/NotificationController.java`
  - `backend/src/main/java/com/bridge/backend/domain/notification/OutboxEventRepository.java`
- pm-web
  - `apps/pm-web/src/components/ui/NotificationCenter.tsx`
  - `apps/pm-web/src/components/layout/PmSidebar.tsx`
  - `apps/pm-web/src/app/pm/projects/[projectId]/events/page.tsx`

### 8.3 검증 결과
- backend: `.\gradlew.bat test` ✅ 통과
- pm-web: `pnpm -C apps/pm-web lint` ✅ 통과
- pm-web: `pnpm -C apps/pm-web build` ✅ 통과

## 9) 2026-02-16 추가 업데이트 (액션 확인 모달 + shadcn 패턴)

### 9.1 반영 내용
- `pm-web`에 shadcn 패턴 기반 공통 UI 추가:
  - `apps/pm-web/src/components/ui/alert-dialog.tsx`
  - `apps/pm-web/src/components/ui/button.tsx`
  - `apps/pm-web/src/components/ui/confirm-action.tsx`
  - `apps/pm-web/src/lib/utils.ts`
- 생성/저장/수정/삭제/전송/등록 액션을 즉시 실행에서 확인 모달 1회 확인 후 실행으로 변경.
- 기존 `window.confirm()` 사용 구간 제거.
- 적용 화면:
  - 프로젝트 생성, Google 연동
  - 게시글 목록/작성/상세(수정, 댓글)
  - 요청/결정
  - 파일(생성/수정/삭제/버전등록/코멘트)
  - 회의
  - 계약/eSign
  - 정산
  - Vault
  - 멤버 설정

### 9.2 shadcn CLI 관련
- `pnpm dlx shadcn@latest init` / `add dialog` 명령 자체는 정상 인식됨.
- 현재 monorepo + workspace 환경에서 CLI 내부 `pnpm add` 단계가 `@bridge/shared-types@workspace:*` 해석 오류로 실패해, 컴포넌트는 동일 shadcn 패턴으로 수동 구성해 적용.

### 9.3 검증 결과
- pm-web: `pnpm -C apps/pm-web lint` ✅ 통과
- pm-web: `pnpm -C apps/pm-web build` ✅ 통과

## 2026-02-16 추가 기록 (요청 반영)
- client-web 범위는 이번 작업에서 제외.
- 사용자 요청에 따라 client-web 변경은 진행하지 않고, PLAN_PROGRESS.md에 미진행 상태로 기록만 남김.
- 이번 턴은 pm-web + backend 중심으로 계속 진행.

## 10) 2026-02-17 추가 업데이트 (client-web 재개 + pm-web 연동 검증)

### 10.1 UI/디자인 방향
- 사용자 요청에 따라 `client-web` 디자인을 `pm-web` 톤(사이드바/카드/테이블 중심)으로 정렬.
- shadcn MCP 조회 결과를 기반으로 `button`, `alert-dialog`, `table`, `badge`, `card` 패턴을 client-web에 적용.
- 추가 공통 UI:
  - `apps/client-web/src/components/ui/button.tsx`
  - `apps/client-web/src/components/ui/alert-dialog.tsx`
  - `apps/client-web/src/components/ui/confirm-action.tsx`
  - `apps/client-web/src/components/ui/table.tsx`
  - `apps/client-web/src/components/ui/card.tsx`
  - `apps/client-web/src/components/ui/badge.tsx`
  - `apps/client-web/src/components/ui/modal.tsx`
  - `apps/client-web/src/lib/utils.ts`

### 10.2 client-web 기능 반영
- 홈 대시보드 고도화:
  - KPI 4개 + 요청 추이 그래프 + 최근 액션 3개 구성.
  - `apps/client-web/src/app/client/projects/[projectId]/home/page.tsx`
- 요청:
  - 한글 라벨 테이블 + 상태 변경 저장(ACKED/IN_PROGRESS/DONE/REJECTED/CANCELLED).
  - `apps/client-web/src/app/client/projects/[projectId]/requests/page.tsx`
- 게시글/댓글:
  - 게시글 선택형 UI + 댓글 작성/수정/삭제.
  - `apps/client-web/src/app/client/projects/[projectId]/posts/page.tsx`
- 파일:
  - 파일 목록 테이블 + 최신 첨부 다운로드.
  - `apps/client-web/src/app/client/projects/[projectId]/files/page.tsx`
- 회의:
  - 회의 목록 테이블 + 참석 응답 전송.
  - `apps/client-web/src/app/client/projects/[projectId]/meetings/page.tsx`
- 계약:
  - 계약서 조회 + 승인/반려(review) + (존재 시) 서명 링크 조회.
  - `apps/client-web/src/app/client/projects/[projectId]/contracts/page.tsx`
- 정산:
  - 선금/중도금/정산 표시 + 상태 변경 저장 + 첨부 개수 확인.
  - `apps/client-web/src/app/client/projects/[projectId]/billing/page.tsx`
- Vault:
  - 계정 요청 테이블 + 계정 정보 제공(모달, provision).
  - `apps/client-web/src/app/client/projects/[projectId]/vault/page.tsx`
- 로그인:
  - Next.js 16 `useSearchParams` Suspense 요구사항 반영.
  - `apps/client-web/src/app/login/page.tsx`

### 10.3 pm-web 연동 관점 검증
- 요청하신 대로 `pm-web` 상호연결 구간 포함 교차 검증 수행:
  - backend: `.\gradlew.bat test` ✅ 통과
  - pm-web: `pnpm -C apps/pm-web lint` ✅ 통과
  - pm-web: `pnpm -C apps/pm-web build` ✅ 통과
  - client-web: `pnpm -C apps/client-web lint` ✅ 통과
  - client-web: `pnpm -C apps/client-web build` ✅ 통과
- 검증 대상 연동 API 범주:
  - requests status (`/api/requests/{id}/status`)
  - posts comments CRUD (`/api/posts/{id}/comments`, `/api/post-comments/{id}`)
  - files versions/download (`/api/files/{id}/versions`, `/api/file-versions/{id}/download-url`)
  - meetings respond (`/api/meetings/{id}/respond`)
  - contracts review/signing-link 조회 (`/api/contracts/{id}/review`, `/api/contracts/{id}/envelopes`, `/api/envelopes/{id}`)
  - billing status (`/api/invoices/{id}/status`)
  - vault provision (`/api/vault/secrets/{id}/provision`)

## 11) 2026-02-17 추가 업데이트 (남은 체크리스트 처리)

### 11.1 UI/UX 품질 게이트 반영
- 내비게이션 접근성 개선:
  - `nav`의 `aria-label`, 활성 링크 `aria-current="page"` 적용
- 알림센터 접근성 개선:
  - `aria-controls`, 패널 `role="dialog"`/`aria-label` 적용
  - ESC 닫기, 외부 클릭 닫기 처리
- 문구 로컬라이징:
  - 주요 레이아웃 영문 문구를 한국어 중심으로 정리
- 근거 문서:
  - `docs/UI_UX_QUALITY_GATE_PHASE6_7.md`

### 11.2 Playwright MCP E2E 수행
- PM/Client/Admin 보호 라우트 로그인 강제 + 로그인 후 복귀 확인
- `/sign/[recipientToken]` 토큰 검증 동작 확인
- 근거 문서:
  - `docs/Test/PLAYWRIGHT_MCP_E2E.md`

### 11.3 DoD/배포 문서화
- DoD 1~9 실증 체크리스트 추가:
  - `docs/Test/DOD_DEMO_CHECKLIST.md`
- 배포 전략 초안 확정:
  - 프론트 `Vercel`, 백엔드 `AWS`
  - `docs/DEPLOYMENT_RUNBOOK.md`
- 백엔드 컨테이너 빌드 산출물 추가:
  - `backend/Dockerfile`
  - `backend/.dockerignore`

### 11.4 검증 결과
- backend: `.\gradlew.bat test` ✅ 통과
- pm-web: `pnpm -C apps/pm-web lint` ✅ 통과
- pm-web: `pnpm -C apps/pm-web build` ✅ 통과
- client-web: `pnpm -C apps/client-web lint` ✅ 통과
- client-web: `pnpm -C apps/client-web build` ✅ 통과
- admin-web: `pnpm -C apps/admin-web lint` ✅ 통과
- admin-web: `pnpm -C apps/admin-web build` ✅ 통과

## 12) 2026-02-17 추가 업데이트 (DoD 실증 + 배포 파이프라인 구현 완료)

### 12.1 DoD 시나리오 1~9 실증 완료
- API 자동 실증 스크립트 추가:
  - `scripts/run-dod-demo.ps1`
- 실증 결과 산출물:
  - `docs/Test/evidence/dod-demo-20260217-132706.md`
  - `docs/Test/evidence/dod-demo-20260217-132706.json`
- 체크리스트 상태 반영:
  - `docs/Test/DOD_DEMO_CHECKLIST.md` (1~9 전부 DONE)

### 12.2 배포 파이프라인 구현 완료
- Frontend(Vercel 3앱) GitHub Actions:
  - `.github/workflows/deploy-web-vercel.yml`
- Backend(AWS ECS) GitHub Actions:
  - `.github/workflows/deploy-backend-aws.yml`
- 런북 갱신:
  - `docs/DEPLOYMENT_RUNBOOK.md`

### 12.3 현재 잔여
- 기능 구현 잔여 없음
- 운영 시크릿 주입 및 실배포 검증만 남음
