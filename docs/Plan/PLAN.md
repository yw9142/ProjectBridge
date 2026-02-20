# Bridge 프로덕션 구축 통합 실행계획 v7.2 (v7.1 전체 유지 + 메모리 가드 + 설치 명령어 생성 규칙 + ref 디자인 참조 규칙)

## 0. v7.2 변경 요약

1. 작업 중 무한루프/메모리 폭주 방지를 위해 `보수형 메모리 프로파일`을 고정한다.
2. 프레임워크 스캐폴딩은 수동 생성 금지, `공식 Installation/Scaffold 명령어`만 사용한다.
3. 프론트는 `ref` 폴더를 `디자인(레이아웃/토큰/컴포넌트 표현)`만 참조하고 기능/로직/데이터모델은 참조하지 않는다.
4. 기존 v7.1의 범위, API, 인증 강제, JPA 강제는 그대로 유지한다.

## 1. 요약

1. `PROJECT.md` 0~13 요구사항을 누락 없이 구현한다.
2. 모노레포는 `pnpm + Turborepo`로 구성하고, 서비스 의존성은 Docker(`postgres`, `minio`, `mailhog`) 기준으로 운영한다.
3. 개발 원칙은 `플랜 우선`, `PROJECT.md 주기 점검`, `Playwright MCP 프론트 검증`, `MVP 금지`를 강제한다.
4. 인증은 전면 강제한다: 모든 앱 최초 진입 로그인, 미인증 사용 불가, 세션 만료 즉시 로그인 리다이렉트.
5. `/sign/[contractId]`도 로그인 필수이며 로그인 후 서명자 소유권 검증을 통과해야 사용 가능하다.
6. 프론트 품질은 `frontend-design + ui-ux-pro-max` 기준으로 운영한다.
7. 백엔드 영속성은 `Spring Data JPA(Hibernate)`를 표준으로 강제한다.
8. 구현 안정성은 `무한루프 방지 + 메모리 상한 관리`를 기본 게이트로 강제한다.

## 2. 고정 의사결정

1. 스킬/MCP는 작업 관련 항목을 전부 사용한다.
2. 옵션 기능은 `핵심만 우선`으로 구현한다.
3. 실행은 `도메인 단계별 완성` 방식으로 진행한다.
4. UI 언어는 한국어 기본이다.
5. 패키지 표준은 pnpm 단일 표준이다.
6. 배포 산출물은 로컬+프로덕션 구성(runbook/env)까지 포함한다.
7. 운영원칙은 플랜 우선/PROJECT.md 주기 점검/Playwright MCP 테스트/Docker 필수다.
8. 인증원칙은 최초 로그인, 미인증 차단, 세션 만료 즉시 리다이렉트다.
9. `/sign/[contractId]`는 로그인 필수 + 서명자 소유권 검증이다.
10. 프론트 품질 스킬은 `frontend-design + ui-ux-pro-max`를 강제 적용한다.
11. 백엔드 CRUD/조회 기본 구현은 `JPA Repository`로 통일한다.
12. 각 프레임워크 생성은 수동 파일 작성 금지, 공식 설치/생성 명령어 사용을 강제한다.
13. `ref` 폴더는 디자인 참조 전용으로 사용하고 기능 참조는 금지한다.
14. 배포 타깃은 프론트엔드 `Vercel`, 백엔드 `AWS`를 기본값으로 한다.

## 3. 비타협 원칙

1. 구현 전/중/후 의사결정은 본 플랜 기준으로만 수행한다.
2. 각 Phase 시작/종료 때 `PROJECT.md` 매트릭스를 재검증한다.
3. Playwright MCP 시나리오 통과 없이는 프론트 완료로 인정하지 않는다.
4. “나중에”, 임시 스텁, MVP형 축약은 금지한다.
5. Docker 기반 재현이 되지 않으면 완료로 인정하지 않는다.
6. 보안 핵심 요구(Vault 평문 금지, 서명/열람 이벤트, 멀티테넌시 강제)는 최우선 처리한다.
7. 영속성 계층은 JPA/Hibernate 표준을 위반하지 않는다. 예외 SQL은 Flyway 및 성능 튜닝에 한정한다.
8. 무한루프 징후(React maximum update depth, 무한 polling, SSE 중복 연결)를 발견하면 해당 Phase 완료를 보류한다.
9. 메모리 상한 초과 상태에서 “일단 진행”을 금지하고 원인 제거 후 진행한다.

## 4. 타깃 아키텍처 및 폴더 구조

1. 루트 구조

```text
/
  backend/
  apps/
    pm-web/
    client-web/
    admin-web/
  packages/
    shared-types/
    ui/
  docker-compose.yml
  README.md
```

2. 백엔드 스택: Spring Boot 3, Java 21, PostgreSQL, Flyway, Spring Data JPA(Hibernate), Spring Security, JWT, springdoc.
2. 프론트 스택: Next.js App Router, TypeScript, Tailwind, TanStack Query.
3. 파일 저장: MinIO(S3 호환) + Presigned URL 업로드/다운로드.
4. 실시간: SSE(`/api/notifications/stream`) 필수.
5. 이메일/Google: 인터페이스 플러그형, 기본 비활성.
6. 프레임워크 초기 생성: 공식 scaffold/installation 명령어 우선 사용.

## 5. 데이터/보안 아키텍처 고정

1. single DB/single schema + 전 도메인 `tenant_id` 강제.
2. 모든 요청에서 `tenant_id + project membership + role` 3중 검증.
3. 소프트삭제(`deleted_at`) 및 메타필드(`created_at/created_by/updated_at/updated_by`) 반영.
4. JWT access 15분, refresh 30일, refresh hash 저장 + revoke.
5. 로그인 rate limit + 실패 횟수 제한.
6. Vault는 AES-256-GCM(`secret_ciphertext`, `nonce`, `version`) 강제.
7. 알림은 Outbox 기반 커밋 후 발행으로 고정.

## 6. 공용 API/인터페이스/타입 계약 (변경/추가 포함)

1. 응답 계약: `ApiSuccess<T>`, `ApiError`.
2. 인증 계약: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/first-password`.
3. 인증 컨텍스트: `AuthContext { userId, tenantId, projectRoles }`.
4. 상태 enum 단일 소스: 백엔드 enum + DB 제약 + OpenAPI + 프론트 공유타입 일치.
5. SSE 타입: `notification.created`, `notification.read`, `system.ping`.
6. 파일 주석 좌표: 정규화 좌표 스키마(해상도 독립).
7. 옵션 인터페이스: `GoogleCalendarProvider`, `EmailNotificationSender` + 기본 `FEATURE_DISABLED`.
8. 로그인 선행 유틸: `next` 복귀 포함 공통 라우트 가드.
9. 서명 계약: `/sign/[contractId]`는 인증 후 서명자 소유권 검증 API 필수.
10. UI/UX 품질 계약: 릴리즈 산출물에 `UI/UX Quality Gate` 리포트 필수.
11. 영속성 구현 계약: 도메인 엔티티는 JPA 매핑 기준, 저장소는 `JpaRepository` 기준으로 통일.
12. `ref` 참조 계약: UI 표현 규칙만 사용하고 도메인 타입/상태/비즈니스 흐름 계약의 근거로 사용하지 않는다.

## 7. REST API 구현 범위 (전부)

1. AUTH  
`POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/first-password`
2. ADMIN  
`POST /api/admin/tenants`, `GET /api/admin/tenants`, `GET /api/admin/tenants/{tenantId}`, `POST /api/admin/tenants/{tenantId}/pm-users`, `GET /api/admin/tenants/{tenantId}/pm-users`, `PATCH /api/admin/users/{userId}/status`, `POST /api/admin/users/{userId}/unlock-login`, `POST /api/admin/users/{userId}/setup-code/reset`
3. PROJECTS  
`GET /api/projects`, `POST /api/projects`, `GET /api/projects/{projectId}`, `PATCH /api/projects/{projectId}`, `GET /api/projects/{projectId}/members`, `POST /api/projects/{projectId}/members/invite`, `POST /api/projects/{projectId}/members/{memberId}/setup-code/reset`
4. POSTS  
`GET /api/projects/{projectId}/posts`, `POST /api/projects/{projectId}/posts`, `GET /api/posts/{postId}`, `PATCH /api/posts/{postId}`, `DELETE /api/posts/{postId}`, `GET /api/posts/{postId}/comments`, `POST /api/posts/{postId}/comments`
5. REQUESTS  
`GET /api/projects/{projectId}/requests`, `POST /api/projects/{projectId}/requests`, `GET /api/requests/{requestId}`, `PATCH /api/requests/{requestId}/status`, `GET /api/requests/{requestId}/events`
6. DECISIONS  
`GET /api/projects/{projectId}/decisions`, `POST /api/projects/{projectId}/decisions`, `PATCH /api/decisions/{decisionId}/status`
7. FILES  
`GET /api/projects/{projectId}/files`, `POST /api/projects/{projectId}/files`, `POST /api/files/{fileId}/versions/presign`, `POST /api/files/{fileId}/versions/complete`, `GET /api/file-versions/{fileVersionId}/download-url`, `POST /api/file-versions/{fileVersionId}/comments`, `PATCH /api/file-comments/{commentId}/resolve`
8. MEETINGS  
`GET /api/projects/{projectId}/meetings`, `POST /api/projects/{projectId}/meetings`, `POST /api/projects/{projectId}/meetings/google`, `POST /api/meetings/{meetingId}/respond`, `POST /api/meetings/{meetingId}/action-items`, `PATCH /api/meeting-action-items/{id}`
9. GOOGLE INTEGRATION(옵션)  
`GET /api/integrations/google/status`, `POST /api/integrations/google/connect`, `GET /api/integrations/google/callback`, `POST /api/integrations/google/disconnect`
10. CONTRACTS & E-SIGN  
`GET /api/projects/{projectId}/contracts`, `POST /api/projects/{projectId}/contracts`, `POST /api/contracts/{contractId}/envelopes`, `POST /api/envelopes/{envelopeId}/recipients`, `POST /api/envelopes/{envelopeId}/fields`, `POST /api/envelopes/{envelopeId}/send`, `GET /api/envelopes/{envelopeId}`, `GET /api/envelopes/{envelopeId}/events`, `POST /api/envelopes/{envelopeId}/void`
11. SIGNING  
`GET /api/signing/contracts/{contractId}`, `POST /api/signing/contracts/{contractId}/viewed`, `POST /api/signing/contracts/{contractId}/submit`
12. BILLING  
`GET /api/projects/{projectId}/invoices`, `POST /api/projects/{projectId}/invoices`, `PATCH /api/invoices/{invoiceId}/status`, `POST /api/invoices/{invoiceId}/attachments/presign`, `POST /api/invoices/{invoiceId}/attachments/complete`
13. VAULT  
`GET /api/projects/{projectId}/vault/policies`, `POST /api/projects/{projectId}/vault/policies`, `GET /api/projects/{projectId}/vault/secrets`, `POST /api/projects/{projectId}/vault/secrets`, `POST /api/vault/secrets/{secretId}/access-requests`, `PATCH /api/vault/access-requests/{requestId}`, `POST /api/vault/secrets/{secretId}/reveal`
14. NOTIFICATIONS  
`GET /api/notifications`, `POST /api/notifications/{id}/read`, `GET /api/notifications/stream`

## 8. 프론트 라우트 및 인증 강제 규칙

1. admin-web  
`/admin/login`, `/admin/tenants`, `/admin/tenants/new`, `/admin/tenants/[tenantId]`, `/admin/tenants/[tenantId]/pm-users`, `/admin/users/[userId]`
2. pm-web  
`/login`, `/first-password`, `/pm/projects`, `/pm/projects/new`, `/pm/projects/[projectId]/dashboard`, `/pm/projects/[projectId]/posts`, `/pm/projects/[projectId]/requests`, `/pm/projects/[projectId]/decisions`, `/pm/projects/[projectId]/files`, `/pm/projects/[projectId]/meetings`, `/pm/projects/[projectId]/contracts`, `/pm/projects/[projectId]/billing`, `/pm/projects/[projectId]/vault`, `/pm/projects/[projectId]/settings/members`, `/pm/profile/integrations/google`
3. client-web  
`/login`, `/first-password`, `/client/projects`, `/client/projects/[projectId]/home`, `/client/projects/[projectId]/requests`, `/client/projects/[projectId]/posts`, `/client/projects/[projectId]/files`, `/client/projects/[projectId]/meetings`, `/client/projects/[projectId]/contracts`, `/client/projects/[projectId]/billing`, `/client/projects/[projectId]/vault`, `/sign/[contractId]`
4. 인증 규칙  
최초 진입 로그인, 미인증 보호경로 즉시 `/login?next=...`, 로그인 후 원경로 복귀, `/sign/[contractId]` 동일 적용.

## 9. 도메인 구현 범위 (누락 금지)

1. Auth/Admin/Projects/Invitations 전량.
2. Posts/Comments 전량.
3. Requests/RequestEvents 전량.
4. Decisions(파일 버전 고정 승인) 전량.
5. Files/FileVersions/FileComments 전량.
6. Meetings/Attendees/ActionItems 전량.
7. Contracts/eSign 전량.
8. Billing(결제 처리 제외) 전량.
9. Vault 전량.
10. Notifications 전량.

## 10. 상태머신 고정 규칙

1. Request: `DRAFT -> SENT -> ACKED -> IN_PROGRESS -> DONE`, 예외 `REJECTED/CANCELLED`.
2. Decision: `PROPOSED -> APPROVED|REJECTED`(승인 시 `related_file_version_id` 필수).
3. Envelope: `DRAFT -> SENT -> PARTIALLY_SIGNED -> COMPLETED`, 예외 `DECLINED|EXPIRED|VOIDED`.
4. Invoice: `DRAFT -> ISSUED -> CONFIRMED -> CLOSED`, 예외 `OVERDUE|CANCELLED`.
5. Vault Access: `REQUESTED -> APPROVED|REJECTED|CANCELLED|EXPIRED`.

## 11. 알림 매핑 고정 규칙

1. Post/Comment, Request 생성/상태변경, Decision 생성/승인/반려 알림.
2. File 버전/코멘트/resolve, Meeting 생성/변경/취소/응답 알림.
3. Signature 이벤트 전량 알림.
4. Invoice 상태, Vault 접근요청/승인/거절/열람 알림.
5. 순서 고정: `트랜잭션 커밋 -> Outbox 소비 -> notifications 저장 -> SSE push`.

## 12. 프론트 디자인/UX 적용 규칙

1. pm-bridge 레이아웃 구조(사이드바+헤더+카드/테이블 중심) 유지.
2. 토큰 체계(`slate` 중립 + `indigo` 액션 + 상태 배지 색상) 유지.
3. 공통 컴포넌트 표준화: `ProjectRoomShell`, `NotificationBell/Center`, `StatusBadge`, `DataTable`, 모달/폼.
4. 모바일 Drawer/카드 폴백/접근성(키보드, ARIA, 대비, 토스트 공지) 필수.
5. `frontend-design` 적용: 화면별 명확한 컨셉, 의도적 타이포/공간/모션.
6. `ui-ux-pro-max` 적용: UX 흐름 최적화, 작업 완료 경로 최소화, 피드백 명확성, 운영 화면 완성도 강화.
7. UI/UX 품질 게이트를 Phase 6, Phase 7에 각각 1회 이상 수행.
8. `ref` 반영 범위 고정: `Sidebar/Header/StatusBadge/카드-테이블 조합/색상 계층`은 참고하고, `mockData/types/view 흐름`은 기능 구현 근거로 사용하지 않는다.
9. `ref` 상 영문 카피는 한국어 UX 카피 원칙으로 재작성한다.
10. `ref`는 시각적 기준점이고 제품 요구사항의 소스 오브 트루스는 `PROJECT.md + 본 플랜`으로 고정한다.

## 13. 실행 단계 (결정 완료형)

1. Phase 0 환경 게이트  
Playwright MCP 인식 확인, Docker 기동 확인, `PROJECT.md` 매트릭스 초기화, 메모리 프로파일 환경변수 사전 적용.
2. Phase 1 부트스트랩  
pnpm workspace/turbo, Next 3앱, Backend, 공통 패키지, compose/env.
3. Phase 2 백엔드 기반  
Flyway `V1__init.sql`, 인증/JWT, 멀티테넌시/RBAC, Outbox+SSE, JPA 엔티티/리포지토리 표준화, `ddl-auto=validate` 정합 검증.
4. Phase 3 Core Project Room  
Posts/Requests/Decisions/Files/Meetings 완성.
5. Phase 4 Contracts & eSign  
엔벨로프, 토큰서명, PDFBox 완료본, 이벤트 완성.
6. Phase 5 Billing & Vault  
인보이스/증빙, Vault 암호화/정책강제/reveal 이벤트 완성.
7. Phase 6 프론트 3앱  
인증/권한가드/토큰갱신, 프로젝트 룸 UI, SSE 알림, 로그인 선행 `/sign/[contractId]`, UX/UI 게이트, 루프/메모리 안정성 게이트.
8. Phase 7 하드닝/문서화  
OpenAPI, 보안 헤더/CORS/CSP, 시드, README E2E 1~9, UI/UX 게이트 최종 통과, DoD 100%.

## 14. 테스트 케이스 및 시나리오

1. 인증/권한: 로그인/refresh/revoke/권한 차단/세션만료 리다이렉트.
2. 로그인 선행: 미인증 보호 라우트 차단 + `next` 복귀.
3. 서명 접근: 미인증 차단 + 로그인 후 서명자 소유권 검증 + 비배정 사용자 거부.
4. 프로젝트 운영: admin->pm->client 초대/수락.
5. 프로젝트 룸: Post/Comment, Request 이벤트, Decision 파일버전 고정 승인.
6. 파일: Presign/Complete/Download, 최신본 전환, 주석/resolve.
7. 회의: 수동 meet_url, 참석응답, 액션아이템.
8. eSign: 발송/열람/서명/완료본/이벤트.
9. Billing: 인보이스 상태전이/증빙.
10. Vault: 암호화 저장/접근요청/정책강제/reveal/열람이벤트.
11. 알림: 상대편 In-app + SSE 실시간 도착.
12. 비기능: 동시성, API p95, 보안 음수 시나리오.
13. UX/UI 게이트: 핵심 작업 경로, 폼 피드백, 상태 가시성, 반응형 일관성, 접근성.
14. JPA 게이트: 엔티티-스키마 검증 통과, soft delete/감사필드/tenant_id 매핑 일관성 확인.
15. 루프/메모리 게이트: 브라우저 콘솔 `Maximum update depth exceeded` 0건, SSE 중복 연결 0건, 장시간 시나리오 메모리 급증 없음.

## 15. Docker 운영 계획

1. `docker-compose.yml` 구성: `postgres`, `minio`, `mailhog`.
2. backend/web은 Docker endpoint 기반 env 사용.
3. 시드 계정(PLATFORM_ADMIN/PM/CLIENT) + 샘플 프로젝트 초기화 스크립트 포함.
4. README 기본 경로는 Docker 재현 절차로 문서화.
5. 보수형 메모리 제한 기본값을 compose/runbook에 문서화한다.
6. 프로덕션 배포 런북은 `Vercel(3개 web)` + `AWS(backend)` 기준으로 유지한다.

## 16. 스킬/MCP 활용 계획

1. `frontend-design`  
시각 컨셉/타이포/모션/레이아웃 품질 가이드로 적용.
2. `ui-ux-pro-max`  
디자인 시스템 추천 + UX 규칙(접근성/반응형/피드백/성능) 게이트 기준으로 적용.
3. `supabase-postgres-best-practices`  
ERD/인덱스/쿼리/락 전략 검증.
4. MCP  
`Playwright MCP`(프론트 E2E), `chrome-devtools`(시각/상호작용 보완검증), `context7`(공식 문서 근거), `shell_command`(빌드/테스트 게이트).
5. `ref` 활용 방식  
MCP 검증 시 `ref` 화면을 디자인 벤치마크로 비교하되 기능 동작 비교 기준으로 사용하지 않는다.

## 17. PROJECT.md 주기 점검 프로토콜

1. Phase 시작 시 해당 섹션 체크리스트 오픈 및 범위 잠금.
2. Phase 종료 시 충족/미충족 기록, 미충족 즉시 보완.
3. 최종 릴리즈 전 `PROJECT.md 0~13` 전수 대조로 누락 0건 확인.
4. 점검 항목에 `JPA 강제`, `설치 명령어 생성`, `ref 디자인 전용 참조`, `메모리/루프 안정성`을 고정 추가한다.

## 18. 최종 완료 기준 (DoD)

1. 로컬에서 backend + 3개 web 앱 구동.
2. admin-web에서 PM 계정 생성 및 초대/비밀번호 설정 동작.
3. pm-web에서 프로젝트 생성 + 클라이언트 초대.
4. client-web에서 초대 수락 후 로그인.
5. 프로젝트 룸 E2E: Post/Comment, Request 상태변경 이벤트, Decision 파일버전 고정, Files 버전/주석, Meetings 응답, eSign 완료본, Billing 상태/증빙, Vault 암호화+reveal 이벤트.
6. 주요 액션이 상대편에 실시간 SSE 알림 도착.
7. Playwright MCP 시나리오, 백엔드 통합테스트, 빌드/린트/테스트 전량 통과.
8. Docker 기준 데모 시나리오 1~9 재현 완료.
9. JPA 표준 준수: 핵심 도메인 엔티티/리포지토리 구현 및 스키마 정합 검증 완료.
10. 프레임워크 생성 이력은 모두 공식 설치/생성 명령어로 재현 가능해야 한다.
11. 프론트 결과물은 `ref`의 시각 품질을 반영하되 기능 구현은 본 서비스 요구사항 기준으로 완결되어야 한다.
12. 장시간 사용 시 무한루프/메모리 폭주가 재현되지 않아야 한다.

## 19. 명시적 가정 및 기본값

1. PostgreSQL 단일 스키마/멀티테넌시(`tenant_id`) 강제.
2. 시간은 UTC 저장, 기본 표시 타임존은 `Asia/Seoul`.
3. Google/SMTP는 인터페이스 포함, 기본 비활성.
4. 결제 처리(PG/카드)는 제외하고 상태/증빙만 관리.
5. 패키지 매니저는 pnpm 단일 표준.
6. Playwright MCP가 Phase 0에서 미인식이면 구현 착수 보류.
7. 로그인 없이는 서비스 사용 불가, 예외는 계정 부팅용 인증 엔드포인트로 한정.
8. 영속성 기본은 Spring Data JPA(Hibernate)이며, 네이티브 SQL은 제한적 예외로만 허용.
9. `PROJECT.md` 내 `/sign/[contractId]` 무인증 가능 문구가 있더라도 본 계획의 인증 강제 규칙을 우선 적용한다.
10. 메모리 프로파일 기본은 `보수형`으로 고정한다.
11. `ref`는 디자인 참조 전용이며 기능 명세 출처가 아니다.
12. 프로젝트 프레임워크 초기화는 반드시 프레임워크 공식 설치/생성 명령어로 수행한다.

## 20. 구현자 실행 스펙(설치 명령어 + 메모리 가드 고정)

1. 프레임워크 생성 규칙  
`Next.js`는 `create-next-app`, `Spring Boot`는 `Spring Initializr`로 생성하고 수동 뼈대 작성 금지.
2. 권장 생성 명령(예시 고정)  
`pnpm create next-app@latest apps/pm-web --ts --tailwind --eslint --app --use-pnpm --yes`  
`pnpm create next-app@latest apps/client-web --ts --tailwind --eslint --app --use-pnpm --yes`  
`pnpm create next-app@latest apps/admin-web --ts --tailwind --eslint --app --use-pnpm --yes`  
`curl` 기반 Spring Initializr zip 생성 후 `backend/`로 해제(의존성: web, validation, security, data-jpa, flyway, postgresql, oauth2-resource-server).
3. Node 메모리 기본값  
`NODE_OPTIONS=--max-old-space-size=2048`
4. Java/Gradle 메모리 기본값  
`JAVA_TOOL_OPTIONS=-Xms256m -Xmx1536m -XX:+UseG1GC -XX:MaxGCPauseMillis=200`  
`org.gradle.jvmargs=-Xmx1536m -XX:+UseG1GC`  
`org.gradle.workers.max=2`
5. 개발 실행 동시성 규칙  
평상시 단일 web 앱 + backend 중심으로 실행, 3앱 동시 실행은 통합검증 구간에서만 수행.
6. 프론트 루프 방지 코딩 규칙  
`useEffect` cleanup 강제, SSE 단일 연결 보장, 무한 polling 금지, 상태 업데이트는 조건 가드 후 수행.
7. 루프/메모리 실패 처리 규칙  
경고 발견 시 기능 개발을 중단하고 재현 스크립트 작성 후 수정, 재검증 통과 전 병합 금지.


