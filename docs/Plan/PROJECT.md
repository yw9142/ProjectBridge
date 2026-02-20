너는 시니어 풀스택 아키텍트/개발 리드다. 목표는 SI/에이전시 프로젝트에서 PM(벤더)과 클라이언트가 프로젝트 진행을 위해 소통하는 SaaS를 “프로덕션 품질”로 구축하는 것이다. 아래 요구사항을 절대 생략하지 말고, 구현 가능한 수준으로 설계+코드까지 산출하라.

========================================================
0) Product Context (기획/서사 — 반드시 이해하고 구현에 반영)
========================================================
[프로젝트 명]
bridge

[제품 한 줄 정의]
SI 프로젝트에서 PM–클라이언트 커뮤니케이션을 “증거/승인/상태” 중심으로 구조화하여,
카톡/메일/드라이브로 흩어지는 진행을 “프로젝트 룸 하나”로 수렴시키는 B2B SaaS.

[해결하려는 문제]

- 결정이 채팅에 묻혀 “그렇게 말한 적 없다” 분쟁
- 파일 최신본 혼선(v2/v3) 및 승인 기준 불명확
- 클라이언트가 해야 할 일(승인/서명/자료제출/입금확인)이 흩어짐
- 변경요청이 구두 처리되어 일정/비용 폭발
- 배포/운영 계정정보가 흩어져 런칭 직전 사고
- 회의/회의록/액션아이템이 끊겨 실행 추적 불가
- 계약/서명/정산/증빙이 따로 놀음

[핵심 원칙(설계 철학)]

1) 대화(Post) / 해야할 일(Request) / 최종확정(Decision)을 분리하고 서로 링크한다.
2) 승인(Decision)은 “특정 파일 버전(fileVersionId)” 기준으로 고정되어야 한다.
3) 상대방이 액션하면 서로에게 즉시 알림이 가야 한다(인앱 + 실시간 SSE).
4) 결제는 처리하지 않고 “인보이스/입금확인/증빙/상태”만 관리한다.
5) 금고(Vault)는 반드시 포함한다. 평문 저장 금지(서버측 암호화 필수). 열람 이벤트(누가 언제 봤는지) 저장 필수.
6) 전자서명은 이벤트(발송/열람/서명/완료 등) 저장 필수.

[핵심 사용자/역할]

- PM(벤더): 프로젝트 운영, 요청 생성/추적, 승인 수집, 파일/회의/서명/정산 상태 업데이트, 금고 관리
- 클라이언트(결정자/실무자/회계): 승인/반려, 서명, 자료제출, 코멘트, 입금 확인, 회의 확인/응답
- 플랫폼 어드민: 테넌트/PM 계정 프로비저닝, 정책/템플릿 관리

========================================================

1) 시스템 구성/스택 (4개 플랫폼 + 백엔드)
========================================================
플랫폼(4개):
1) backend (Spring Boot)
1) pm-web (Next.js): PM/벤더용
1) client-web (Next.js): 클라이언트용
1) admin-web (Next.js): 전체 어드민용 (PM 계정 생성/관리)

스택:

- Backend: Spring Boot 3.x, Java 21, PostgreSQL, Flyway, JPA/Hibernate, Spring Security, JWT(access/refresh), OpenAPI(springdoc)
- Frontend: Next.js(App Router) + TypeScript + Tailwind(+shadcn/ui 가능) + TanStack Query
- Storage: S3 compatible (dev: MinIO) + Presigned URL 업로드/다운로드
- Realtime 알림: SSE 필수(/api/notifications/stream). (선택) WebSocket 가능
- Email: dev MailHog(또는 콘솔 로깅), prod SMTP 플러그형
- Database: PostgreSQL

실행/설치 명령(필수):

- backend: ./gradlew bootRun, ./gradlew test
- 각 web 앱: npm install, npm run dev, npm run build && npm run start

모노레포 권장:
/
  backend/
  apps/
    pm-web/
    client-web/
    admin-web/
  packages/
    shared-types/ (선택: OpenAPI로 생성한 타입 공유)
    ui/           (선택: 공통 UI)
  docker-compose.yml
  README.md

========================================================
2) 반드시 지킬 정책/제약
========================================================

- 결제는 “처리”하지 않는다(카드/PG 없음). 인보이스/상태(ISSUED/CONFIRMED/OVERDUE 등)/증빙 업로드만 관리한다.
- SSO 없음.
- PM 계정은 admin-web에서만 생성(셀프 가입 금지).
- 프로젝트별 클라이언트 계정은 pm-web에서 초대/생성.
- DLP 없음.
- 일반 감사로그(Audit Trail/WORM)는 제외.
  - 다만 운영 메타데이터(created_by/updated_by/시간)는 필수.
  - 금고 열람 이벤트는 필수(누가/언제/무엇을 reveal 했는지).
  - 전자서명 이벤트는 필수(SENT/VIEWED/SIGNED/COMPLETED/…).
- 알림은 “상대방이 액션 처리하면 서로에게 즉시 전달”이 필수:
  - Request, Decision, 댓글/코멘트, 파일 새 버전, 회의 생성/변경/응답, 서명 이벤트, 인보이스 상태 변경, 금고 접근 요청/승인/열람 등.

========================================================
3) 핵심 도메인(프로젝트 룸)
========================================================

프로젝트 하나(Project Room) 안에 모듈:

- Posts/Threads: 공지/일반/Q&A/이슈/회의록/리스크
- Requests: 승인/자료요청/피드백/서명/입금확인/금고접근/회의확인 등 “해야할 일” 상태 추적
- Decisions: 최종 확정 기록(어떤 파일 버전 기준인지 고정)
- Files: 업로드 + 버전관리 + PDF/이미지 주석(핀 코멘트)
- Meetings: 회의 일정 + Google Meet 링크 + 참석 응답 + 액션아이템
- Contracts & e-Sign: 계약 PDF + Envelope + 필드 배치 + 발송/열람/서명/완료 이벤트 + 완료본 생성/저장
- Billing: 인보이스/입금확인/증빙/상태만 관리
- Vault: 배포/운영 계정정보 저장(서버 암호화) + 접근요청/승인/만료/1회보기 + 열람 이벤트

========================================================
4) Google Meet 회의 요구사항(필수/선택)
========================================================

필수(기본):

- PM이 pm-web에서 회의를 생성하면 client-web에서 즉시 확인 가능
- meet_url은 PM이 수동 입력 가능(반드시 지원)

========================================================
5) 멀티테넌시/권한(프로덕션 규칙)
========================================================

멀티테넌시: single DB/single schema. 모든 도메인 테이블에 tenant_id 포함 강제.
모든 요청에서 tenant_id + 프로젝트 멤버십 검증 필수.

역할(프로젝트 단위 RBAC):

- PM_OWNER, PM_MEMBER, CLIENT_OWNER, CLIENT_MEMBER, READONLY
플랫폼 관리자:
- PLATFORM_ADMIN (admin-web 전용)

========================================================
6) 알림(Notifications) — 필수 규칙
========================================================

채널:

- In-app 필수: notifications 테이블 + 알림센터 UI
- Realtime 필수: SSE(/api/notifications/stream)
- Email 선택(권장): 초대/서명요청/마감임박/결제요청 등

알림 트리거(최소):

- Post 생성/댓글: 상대편 관련자에게
- Request 생성/상태변경: 요청자 + 상대편(또는 assignee)
- Decision 생성/승인/반려: 양쪽 관련자
- File 새 버전/코멘트/resolve: 상대편 관련자
- Meeting 생성/변경/취소/응답: 참석자 + 상대편 관련자
- Signature 이벤트(SENT/VIEWED/SIGNED/COMPLETED/DECLINED/EXPIRED/VOIDED): 관련자 + 상대편
- Invoice 상태(ISSUED/CONFIRMED/OVERDUE/CANCELLED): 상대편 회계권한 + 요청자
- Vault 접근요청/승인/거절/열람: 요청자/승인자/PM_OWNER(열람은 최소 PM_OWNER 통지)

구현 방식(프로덕션):

- 트랜잭션 커밋 후 알림 생성/발송. 가능하면 Outbox 패턴(간단 테이블) 적용.

========================================================
7) ERD (필드 레벨 — PostgreSQL, 제약/인덱스 포함)
========================================================

공통:

- PK: uuid
- 시간: timestamptz
- 소프트삭제: deleted_at (중요 테이블)
- 메타: created_at, created_by, updated_at, updated_by

[ENUM(코드 레벨/DB enum 둘 중 하나로 강제)]
user_status: INVITED, ACTIVE, SUSPENDED, DEACTIVATED
project_status: ACTIVE, ARCHIVED
member_role: PM_OWNER, PM_MEMBER, CLIENT_OWNER, CLIENT_MEMBER, READONLY
post_type: ANNOUNCEMENT, GENERAL, QA, ISSUE, MEETING_MINUTES, RISK
request_type: APPROVAL, INFO_REQUEST, FEEDBACK, SIGNATURE, PAYMENT_CONFIRMATION, VAULT_ACCESS, MEETING_CONFIRMATION
request_status: DRAFT, SENT, ACKED, IN_PROGRESS, DONE, REJECTED, CANCELLED
decision_status: PROPOSED, APPROVED, REJECTED
file_comment_status: OPEN, RESOLVED
meeting_status: SCHEDULED, CANCELLED
attendee_response: INVITED, ACCEPTED, DECLINED, TENTATIVE
contract_status: DRAFT, ACTIVE, ARCHIVED
envelope_status: DRAFT, SENT, PARTIALLY_SIGNED, COMPLETED, DECLINED, EXPIRED, VOIDED
recipient_status: PENDING, VIEWED, SIGNED, DECLINED
signature_field_type: SIGNATURE, INITIAL, DATE, TEXT, CHECKBOX
signature_event_type: SENT, VIEWED, SIGNED, COMPLETED, DECLINED, EXPIRED, VOIDED
invoice_status: DRAFT, ISSUED, CONFIRMED, CLOSED, OVERDUE, CANCELLED
invoice_attachment_type: INVOICE_PDF, PROOF, TAX_DOC, OTHER
vault_secret_type: SERVER, DB, CLOUD, DOMAIN_DNS, CI_CD, SOLUTION, OTHER
vault_secret_status: ACTIVE, REVOKED
vault_access_request_status: REQUESTED, APPROVED, REJECTED, CANCELLED, EXPIRED

TABLE tenants

- id uuid PK
- name varchar(200) not null
- slug varchar(80) not null unique
- status varchar(20) not null default 'ACTIVE'
- created_at timestamptz not null default now()
- created_by uuid null
- updated_at timestamptz null
- updated_by uuid null

TABLE users

- id uuid PK
- email varchar(320) not null unique
- name varchar(120) not null
- password_hash varchar(255) not null
- status varchar(20) not null default 'INVITED'
- is_platform_admin boolean not null default false
- last_login_at timestamptz null
- created_at timestamptz not null default now()
- created_by uuid null
- updated_at timestamptz null
- updated_by uuid null
- deleted_at timestamptz null

TABLE tenant_members

- id uuid PK
- tenant_id uuid not null FK tenants(id)
- user_id uuid not null FK users(id)
- role varchar(30) not null  # tenant-level
- created_at timestamptz not null default now()
- created_by uuid null
- deleted_at timestamptz null
- unique(tenant_id, user_id)

TABLE refresh_tokens

- id uuid PK
- user_id uuid not null FK users(id)
- token_hash varchar(255) not null
- user_agent text null
- ip inet null
- expires_at timestamptz not null
- revoked_at timestamptz null
- created_at timestamptz not null default now()
- idx(user_id), idx(expires_at)

TABLE oauth_connections (Google)

- id uuid PK
- user_id uuid not null FK users(id)
- provider varchar(30) not null  # 'google'
- access_token_enc bytea not null
- refresh_token_enc bytea null
- token_expires_at timestamptz null
- scopes text not null
- created_at timestamptz not null default now()
- updated_at timestamptz null
- unique(user_id, provider)

TABLE projects

- id uuid PK
- tenant_id uuid not null FK tenants(id)
- name varchar(200) not null
- code varchar(50) null
- description text null
- status varchar(20) not null default 'ACTIVE'
- start_date date null
- end_date date null
- created_at timestamptz not null default now()
- created_by uuid not null FK users(id)
- updated_at timestamptz null
- updated_by uuid null
- deleted_at timestamptz null
- idx(tenant_id), idx(status)

TABLE project_members

- id uuid PK
- tenant_id uuid not null
- project_id uuid not null FK projects(id)
- user_id uuid not null FK users(id)
- role varchar(30) not null
- joined_at timestamptz not null default now()
- created_at timestamptz not null default now()
- created_by uuid not null
- deleted_at timestamptz null
- unique(project_id, user_id)
- idx(project_id), idx(user_id), idx(role)

TABLE project_invitations

- id uuid PK
- tenant_id uuid not null
- project_id uuid not null
- email varchar(320) not null
- name varchar(120) not null
- role varchar(30) not null
- token_hash varchar(255) not null
- expires_at timestamptz not null
- accepted_at timestamptz null
- created_at timestamptz not null default now()
- created_by uuid not null
- idx(project_id), idx(email)

TABLE posts

- id uuid PK
- tenant_id uuid not null
- project_id uuid not null
- type varchar(30) not null
- title varchar(250) not null
- body text not null
- pinned boolean not null default false
- visibility varchar(20) not null default 'ALL' # ALL/PM_ONLY/CLIENT_ONLY(옵션)
- created_at timestamptz not null default now()
- created_by uuid not null
- updated_at timestamptz null
- updated_by uuid null
- deleted_at timestamptz null
- idx(project_id, created_at desc), idx(project_id, type)

TABLE post_comments

- id uuid PK
- tenant_id uuid not null
- post_id uuid not null FK posts(id)
- body text not null
- created_at timestamptz not null default now()
- created_by uuid not null
- updated_at timestamptz null
- updated_by uuid null
- deleted_at timestamptz null
- idx(post_id, created_at)

TABLE requests

- id uuid PK
- tenant_id uuid not null
- project_id uuid not null
- type varchar(40) not null
- title varchar(250) not null
- description text null
- status varchar(30) not null
- priority int not null default 3
- due_at timestamptz null
- requester_user_id uuid not null FK users(id)
- assignee_user_id uuid null FK users(id)
- payload jsonb not null default '{}'::jsonb
- related_entity_type varchar(50) null
- related_entity_id uuid null
- created_at timestamptz not null default now()
- created_by uuid not null
- updated_at timestamptz null
- updated_by uuid null
- deleted_at timestamptz null
- idx(project_id, status, due_at), idx(assignee_user_id, status)

TABLE request_events

- id uuid PK
- tenant_id uuid not null
- request_id uuid not null FK requests(id)
- from_status varchar(30) null
- to_status varchar(30) not null
- note text null
- created_at timestamptz not null default now()
- created_by uuid not null
- idx(request_id, created_at)

TABLE decisions

- id uuid PK
- tenant_id uuid not null
- project_id uuid not null
- title varchar(250) not null
- content text not null
- status varchar(20) not null
- approved_by uuid null
- approved_at timestamptz null
- related_request_id uuid null
- related_file_version_id uuid null
- created_at timestamptz not null default now()
- created_by uuid not null
- updated_at timestamptz null
- updated_by uuid null
- deleted_at timestamptz null
- idx(project_id, status, created_at desc)

TABLE files

- id uuid PK
- tenant_id uuid not null
- project_id uuid not null
- folder_path varchar(500) not null default '/'
- name varchar(255) not null
- description text null
- created_at timestamptz not null default now()
- created_by uuid not null
- updated_at timestamptz null
- updated_by uuid null
- deleted_at timestamptz null
- idx(project_id, folder_path), idx(project_id, name)

TABLE file_versions

- id uuid PK
- tenant_id uuid not null
- file_id uuid not null FK files(id)
- version_number int not null
- storage_bucket varchar(120) not null
- storage_key varchar(800) not null
- size_bytes bigint not null
- content_type varchar(120) not null
- checksum_sha256 varchar(64) not null
- is_latest boolean not null default false
- notes text null
- uploaded_at timestamptz not null default now()
- uploaded_by uuid not null
- unique(file_id, version_number)
- idx(file_id, version_number desc), idx(file_id, is_latest)

TABLE file_comments

- id uuid PK
- tenant_id uuid not null
- file_version_id uuid not null FK file_versions(id)
- page_num int null
- x numeric(8,3) null
- y numeric(8,3) null
- w numeric(8,3) null
- h numeric(8,3) null
- body text not null
- status varchar(20) not null default 'OPEN'
- resolved_at timestamptz null
- resolved_by uuid null
- created_at timestamptz not null default now()
- created_by uuid not null
- updated_at timestamptz null
- updated_by uuid null
- deleted_at timestamptz null
- idx(file_version_id, status)

TABLE meetings

- id uuid PK
- tenant_id uuid not null
- project_id uuid not null
- title varchar(250) not null
- description text null
- start_at timestamptz not null
- end_at timestamptz not null
- timezone varchar(80) not null default 'Asia/Seoul'
- meet_url text not null
- source varchar(20) not null default 'MANUAL' # MANUAL/GOOGLE
- google_event_id varchar(200) null
- status varchar(20) not null default 'SCHEDULED'
- created_at timestamptz not null default now()
- created_by uuid not null
- updated_at timestamptz null
- updated_by uuid null
- deleted_at timestamptz null
- idx(project_id, start_at)

TABLE meeting_attendees

- id uuid PK
- tenant_id uuid not null
- meeting_id uuid not null FK meetings(id)
- user_id uuid not null FK users(id)
- is_required boolean not null default true
- response varchar(20) not null default 'INVITED'
- responded_at timestamptz null
- response_comment text null
- unique(meeting_id, user_id)
- idx(meeting_id)

TABLE meeting_action_items

- id uuid PK
- tenant_id uuid not null
- meeting_id uuid not null FK meetings(id)
- title varchar(250) not null
- assignee_user_id uuid null
- due_at timestamptz null
- status varchar(20) not null default 'TODO'
- created_at timestamptz not null default now()
- created_by uuid not null
- updated_at timestamptz null
- updated_by uuid null
- idx(meeting_id, status)

TABLE contracts

- id uuid PK
- tenant_id uuid not null
- project_id uuid not null
- name varchar(250) not null
- description text null
- status varchar(20) not null default 'DRAFT'
- original_file_version_id uuid not null FK file_versions(id)
- created_at timestamptz not null default now()
- created_by uuid not null
- updated_at timestamptz null
- updated_by uuid null
- deleted_at timestamptz null
- idx(project_id, status)

TABLE signature_envelopes

- id uuid PK
- tenant_id uuid not null
- project_id uuid not null
- contract_id uuid not null FK contracts(id)
- title varchar(250) not null
- message text null
- status varchar(30) not null default 'DRAFT'
- sent_at timestamptz null
- completed_at timestamptz null
- expires_at timestamptz null
- voided_at timestamptz null
- void_reason text null
- completed_file_version_id uuid null FK file_versions(id)
- created_at timestamptz not null default now()
- created_by uuid not null
- updated_at timestamptz null
- updated_by uuid null
- deleted_at timestamptz null
- idx(project_id, status, created_at desc)

TABLE signature_recipients

- id uuid PK
- tenant_id uuid not null
- envelope_id uuid not null FK signature_envelopes(id)
- user_id uuid null FK users(id)
- recipient_email varchar(320) not null
- recipient_name varchar(120) not null
- role varchar(20) not null default 'SIGNER' # SIGNER/CC
- signing_order int not null default 1
- status varchar(20) not null default 'PENDING'
- token_hash varchar(255) not null
- token_expires_at timestamptz not null
- viewed_at timestamptz null
- signed_at timestamptz null
- declined_at timestamptz null
- decline_reason text null
- idx(envelope_id, signing_order), idx(recipient_email)

TABLE signature_fields

- id uuid PK
- tenant_id uuid not null
- envelope_id uuid not null FK signature_envelopes(id)
- recipient_id uuid not null FK signature_recipients(id)
- field_type varchar(20) not null
- page_num int not null
- x numeric(8,3) not null
- y numeric(8,3) not null
- w numeric(8,3) not null
- h numeric(8,3) not null
- required boolean not null default true
- label varchar(120) null
- value jsonb null
- created_at timestamptz not null default now()
- created_by uuid not null
- idx(envelope_id), idx(recipient_id)

TABLE signature_events (필수)

- id uuid PK
- tenant_id uuid not null
- envelope_id uuid not null FK signature_envelopes(id)
- recipient_id uuid null FK signature_recipients(id)
- event_type varchar(20) not null
- ip inet null
- user_agent text null
- created_at timestamptz not null default now()
- created_by uuid null
- idx(envelope_id, created_at)

TABLE invoices

- id uuid PK
- tenant_id uuid not null
- project_id uuid not null
- invoice_number varchar(50) not null
- currency varchar(10) not null default 'KRW'
- total_amount numeric(12,2) not null default 0
- status varchar(20) not null default 'DRAFT'
- issued_at timestamptz null
- due_at timestamptz null
- confirmed_at timestamptz null
- closed_at timestamptz null
- notes text null
- created_at timestamptz not null default now()
- created_by uuid not null
- updated_at timestamptz null
- updated_by uuid null
- deleted_at timestamptz null
- unique(tenant_id, invoice_number)
- idx(project_id, status, due_at)

TABLE invoice_items

- id uuid PK
- tenant_id uuid not null
- invoice_id uuid not null FK invoices(id)
- title varchar(250) not null
- description text null
- quantity numeric(12,2) not null default 1
- unit_price numeric(12,2) not null default 0
- amount numeric(12,2) not null default 0
- category varchar(30) not null default 'OTHER'
- created_at timestamptz not null default now()
- created_by uuid not null
- idx(invoice_id)

TABLE invoice_attachments

- id uuid PK
- tenant_id uuid not null
- invoice_id uuid not null FK invoices(id)
- file_version_id uuid not null FK file_versions(id)
- type varchar(30) not null
- created_at timestamptz not null default now()
- created_by uuid not null
- idx(invoice_id)

TABLE invoice_events

- id uuid PK
- tenant_id uuid not null
- invoice_id uuid not null FK invoices(id)
- from_status varchar(20) null
- to_status varchar(20) not null
- note text null
- created_at timestamptz not null default now()
- created_by uuid not null
- idx(invoice_id, created_at)

TABLE vault_policies

- id uuid PK
- tenant_id uuid not null
- project_id uuid not null
- visibility varchar(20) not null default 'PM_ONLY' # PM_ONLY/CLIENT_ALLOWED
- require_approval boolean not null default false
- one_time_view boolean not null default false
- view_ttl_minutes int not null default 10
- max_views int null
- allowed_roles jsonb not null default '[]'::jsonb
- created_at timestamptz not null default now()
- created_by uuid not null
- idx(project_id)

TABLE vault_secrets

- id uuid PK
- tenant_id uuid not null
- project_id uuid not null
- policy_id uuid not null FK vault_policies(id)
- name varchar(250) not null
- secret_type varchar(30) not null
- username varchar(250) null
- secret_ciphertext bytea not null
- secret_nonce bytea not null
- secret_version int not null default 1
- description text null
- status varchar(20) not null default 'ACTIVE'
- expires_at timestamptz null
- rotated_at timestamptz null
- created_at timestamptz not null default now()
- created_by uuid not null
- updated_at timestamptz null
- updated_by uuid null
- deleted_at timestamptz null
- idx(project_id, status), idx(policy_id)

TABLE vault_access_requests

- id uuid PK
- tenant_id uuid not null
- secret_id uuid not null FK vault_secrets(id)
- requester_user_id uuid not null FK users(id)
- status varchar(20) not null default 'REQUESTED'
- approver_user_id uuid null FK users(id)
- decided_at timestamptz null
- expires_at timestamptz null
- note text null
- created_at timestamptz not null default now()
- idx(secret_id, status), idx(requester_user_id)

TABLE vault_access_events (필수)

- id uuid PK
- tenant_id uuid not null
- secret_id uuid not null FK vault_secrets(id)
- viewer_user_id uuid not null FK users(id)
- event_type varchar(20) not null default 'VIEWED'
- ip inet null
- user_agent text null
- created_at timestamptz not null default now()
- idx(secret_id, created_at)

TABLE notifications

- id uuid PK
- tenant_id uuid not null
- project_id uuid null
- recipient_user_id uuid not null FK users(id)
- type varchar(60) not null
- title varchar(250) not null
- body text not null
- data jsonb not null default '{}'::jsonb
- read_at timestamptz null
- created_at timestamptz not null default now()
- idx(recipient_user_id, read_at, created_at desc), idx(project_id)

TABLE notification_preferences (권장)

- id uuid PK
- user_id uuid not null FK users(id)
- channel varchar(20) not null # IN_APP/EMAIL
- enabled boolean not null default true
- per_type jsonb not null default '{}'::jsonb
- unique(user_id, channel)

========================================================
8) REST API 엔드포인트(권한/예시 포함) — 전부 구현
========================================================

공통:

- Base: /api
- 인증: HttpOnly 쿠키(앱 스코프 분리)
  - admin: bridge_admin_access_token / bridge_admin_refresh_token
  - pm: bridge_pm_access_token / bridge_pm_refresh_token
  - client: bridge_client_access_token / bridge_client_refresh_token
  - 요청에 `X-Bridge-App`(또는 SSE `?app=`) 스코프가 없으면 인증 토큰을 해석하지 않음
- 성공 응답: { "data": ..., "meta": ... }
- 에러 응답: { "error": { "code": "...", "message": "...", "details": {...} } }

AUTH
POST /api/auth/login
  req { email, password, tenantSlug? }
  resp { data: { userId, tenantId, roles, ... } } + Set-Cookie

POST /api/auth/refresh
  req body 없음 (쿠키 기반)
  resp { data: { refreshed: true } } + Set-Cookie 회전

POST /api/auth/logout
  req body 없음 (쿠키 기반)
  resp { data: { loggedOut: true } } + 쿠키 만료

GET  /api/auth/me
POST /api/auth/first-password # 최초 비번설정: email + setupCode + newPassword
  - PM 진입 경로: PM 앱 /first-password
  - Client 진입 경로: Client 앱 /first-password

ADMIN (PLATFORM_ADMIN)
POST /api/admin/tenants
GET  /api/admin/tenants
GET  /api/admin/tenants/{tenantId}
POST /api/admin/tenants/{tenantId}/pm-users   # PM 계정 생성
GET  /api/admin/tenants/{tenantId}/pm-users
PATCH /api/admin/users/{userId}/status
POST /api/admin/users/{userId}/unlock-login
POST /api/admin/users/{userId}/setup-code/reset

PROJECTS (멤버십 기반)
GET  /api/projects
POST /api/projects                         # PM_OWNER/PM_MEMBER
GET  /api/projects/{projectId}
PATCH /api/projects/{projectId}            # PM_OWNER
GET  /api/projects/{projectId}/members
POST /api/projects/{projectId}/members/invite  # PM이 클라이언트 ID 생성 + setupCode 발급
POST /api/projects/{projectId}/members/{memberId}/setup-code/reset
PATCH /api/projects/{projectId}/members/{memberId}/account # 운영 예외: PM_OWNER/플랫폼관리자 직접 비밀번호 재설정 허용

POSTS
GET  /api/projects/{projectId}/posts
POST /api/projects/{projectId}/posts
GET  /api/posts/{postId}
PATCH/DELETE /api/posts/{postId}
GET  /api/posts/{postId}/comments
POST /api/posts/{postId}/comments

REQUESTS
GET  /api/projects/{projectId}/requests
POST /api/projects/{projectId}/requests
GET  /api/requests/{requestId}
PATCH /api/requests/{requestId}/status     # toStatus + note (이벤트 기록)
GET  /api/requests/{requestId}/events

DECISIONS
GET  /api/projects/{projectId}/decisions
POST /api/projects/{projectId}/decisions
PATCH /api/decisions/{decisionId}/status   # 승인/반려
(Decision은 related_file_version_id를 통해 승인 기준 버전 고정)

FILES (Presigned)
GET  /api/projects/{projectId}/files?folder=/design
POST /api/projects/{projectId}/files
POST /api/files/{fileId}/versions/presign
POST /api/files/{fileId}/versions/complete   # presign 응답의 uploadTicket 필수
GET  /api/file-versions/{fileVersionId}/download-url
POST /api/file-versions/{fileVersionId}/comments
PATCH /api/file-comments/{commentId}/resolve

MEETINGS
GET  /api/projects/{projectId}/meetings
POST /api/projects/{projectId}/meetings           # MANUAL meet_url
POST /api/projects/{projectId}/meetings/google    # (선택) Google 생성
POST /api/meetings/{meetingId}/respond
POST /api/meetings/{meetingId}/action-items
PATCH /api/meeting-action-items/{id}

GOOGLE INTEGRATION (선택 기능)
GET  /api/integrations/google/status
POST /api/integrations/google/connect     # authUrl 반환
GET  /api/integrations/google/callback    # code 처리
POST /api/integrations/google/disconnect

CONTRACTS & E-SIGN
GET  /api/projects/{projectId}/contracts
POST /api/projects/{projectId}/contracts
POST /api/contracts/{contractId}/envelopes
POST /api/envelopes/{envelopeId}/recipients
POST /api/envelopes/{envelopeId}/fields
POST /api/envelopes/{envelopeId}/send            # SENT 이벤트 + 이메일 + 알림
GET  /api/envelopes/{envelopeId}
GET  /api/envelopes/{envelopeId}/events
POST /api/envelopes/{envelopeId}/void

SIGNING (로그인 + 서명자 소유권 검증)
GET  /api/signing/contracts/{contractId}               # 서명 페이지 데이터 + 원본 PDF URL
POST /api/signing/contracts/{contractId}/viewed        # VIEWED 이벤트 + 알림
POST /api/signing/contracts/{contractId}/submit        # SIGNED(+완료시 COMPLETED) + 완료본 생성/저장 + 알림

BILLING (상태관리만)
GET  /api/projects/{projectId}/invoices
POST /api/projects/{projectId}/invoices
PATCH /api/invoices/{invoiceId}/status
POST /api/invoices/{invoiceId}/attachments/presign
POST /api/invoices/{invoiceId}/attachments/complete

VAULT (암호화 + 접근요청 + reveal + 열람이벤트)
GET  /api/projects/{projectId}/vault/policies
POST /api/projects/{projectId}/vault/policies
GET  /api/projects/{projectId}/vault/secrets        # 메타데이터만
POST /api/projects/{projectId}/vault/secrets        # secretPlain은 서버 암호화
POST /api/vault/secrets/{secretId}/access-requests
PATCH /api/vault/access-requests/{requestId}        # 승인/거절
POST /api/vault/secrets/{secretId}/reveal           # VIEWED 이벤트 + 알림 + 정책 강제(ttl/1회보기/승인)

NOTIFICATIONS
GET  /api/notifications?unreadOnly=true
POST /api/notifications/{id}/read
GET  /api/notifications/stream                      # SSE

(각 API는 권한 체크/프로젝트 멤버십 체크/tenant 체크를 반드시 구현)

========================================================
9) Next.js 라우트/컴포넌트 구조(앱별) — 전부 구현
========================================================

admin-web
Routes:

- /admin/login
- /admin/tenants
- /admin/tenants/new
- /admin/tenants/[tenantId]
- /admin/tenants/[tenantId]/pm-users
- /admin/users/[userId]
Components:
- AdminShell, DataTable, TenantForm, PMUserCreateModal

pm-web
Routes:

- /login
- /first-password
- /pm/projects
- /pm/projects/new
- /pm/projects/[projectId]/dashboard
- /pm/projects/[projectId]/posts
- /pm/projects/[projectId]/requests
- /pm/projects/[projectId]/decisions
- /pm/projects/[projectId]/files
- /pm/projects/[projectId]/meetings
- /pm/projects/[projectId]/contracts
- /pm/projects/[projectId]/billing
- /pm/projects/[projectId]/vault
- /pm/projects/[projectId]/settings/members
- /pm/profile/integrations/google
Key Components:
- ProjectRoomShell(탭/상단/알림벨/알림패널)
- RequestsBoard(Request 상태변경/히스토리)
- FileUploader(presigned), FileVersionList, PdfAnnotator(좌표 코멘트)
- MeetingCalendar, MeetingForm(수동/Google), AttendeeResponsePills
- ContractComposer(Envelope/Recipient/FieldDesigner), SignatureStatusTimeline
- InvoiceEditor, AttachmentsUploader
- VaultPolicyEditor, VaultSecretsList, VaultAccessApprovals, SecretRevealModal

client-web
Routes:

- /login
- /first-password
- /client/projects
- /client/projects/[projectId]/home
- /client/projects/[projectId]/requests    # 최우선
- /client/projects/[projectId]/posts
- /client/projects/[projectId]/files
- /client/projects/[projectId]/meetings
- /client/projects/[projectId]/contracts
- /client/projects/[projectId]/billing
- /client/projects/[projectId]/vault       # 권한 있을 때만
- /sign/[contractId]                   # 로그인 후 서명 페이지(서명자 소유권 검증)
Key Components:
- ClientProjectShell
- MyTasks(Requests) 중심 UI
- SigningPage(PDF viewer + FieldRenderer + SignatureCanvas)

알림 UX:

- 공통: NotificationBell + NotificationCenter + SSE subscriber
- 새 알림: 토스트 + 알림센터 누적 + 읽음 처리

========================================================
10) 백엔드 구현 지시(프로덕션 품질)
========================================================

- Flyway로 ERD DDL 작성(V1__init.sql 등). 인덱스/유니크/소프트삭제 반영.
- OpenAPI(springdoc) 문서 자동 생성.
- JWT:
  - access(예: 15분), refresh(예: 30일)
  - refresh는 DB에 hash 저장 + revoke 가능
- 보안:
  - BCrypt(또는 Argon2) 해시
  - rate limit(간단) / 로그인 실패 횟수 제한
- 파일:
  - presign->complete 2단계
  - complete에서 is_latest 갱신(이전 latest false)
  - checksum 검증(가능하면)
- e-Sign:
  - PDFBox로 필드 좌표에 서명 이미지/텍스트를 렌더링하여 완료본 생성
  - signature_events는 반드시 기록(SENT/VIEWED/SIGNED/COMPLETED/DECLINED/EXPIRED/VOIDED)
  - 완료 시 completed_file_version_id 연결
- Vault:
  - DB 평문 금지
  - AES-256-GCM(권장). secret_ciphertext + nonce + version 저장
  - master key는 환경변수로 주입
  - reveal 시 정책(승인 필요/TTL/1회보기/maxViews) 강제
  - reveal 성공 시 vault_access_events(VIEWED) 기록 + 알림
- 알림:
  - 도메인 이벤트 발생 시 notifications 생성 + SSE push
  - 트랜잭션 이후 발행(Outbox 권장)

========================================================
11) 개발환경/도커/README(필수)
========================================================

docker-compose.yml:

- postgres
- minio
- mailhog(선택)

README.md 반드시 포함:

- 환경변수(.env.example) 전부
- 로컬 시드 계정: PLATFORM_ADMIN, PM, CLIENT
- E2E 데모 시나리오:
  1) admin: tenant 생성, PM 생성
  2) pm: 프로젝트 생성, 클라이언트 초대
  3) client: 초대 수락
  4) 프로젝트 룸: Post/Request/Decision
  5) Files: 업로드/버전/주석
  6) Meetings: 생성→client 확인/응답
  7) Contracts: envelope/fields/send→client sign→완료본 생성
  8) Billing: invoice 발행/확인/증빙
  9) Vault: 정책/secret 생성→접근요청/승인→reveal(열람 이벤트)

========================================================
12) 완료 기준(Definition of Done) — 이걸 만족해야 완료
========================================================

- 로컬에서 backend + 3개 web 앱 구동
- admin-web에서 PM 계정 생성(초대/비번설정 동작)
- pm-web에서 프로젝트 생성 + 클라이언트 초대
- client-web에서 초대 수락 후 로그인
- 프로젝트 룸 기능 end-to-end:
  - Post/Comment
  - Request 생성/상태변경(Events)
  - Decision 승인(파일버전 링크 고정)
  - File 업로드(버전) + PDF/이미지 코멘트
  - Meeting 등록(수동 meet) + client 확인/응답
  - eSign: send→viewed→signed→completed + 완료본 생성/저장 + 이벤트 기록
  - Billing: 인보이스 생성/상태변경 + 증빙 업로드
  - Vault: 암호화 저장 + 접근요청/승인 + reveal + 열람 이벤트
- 모든 주요 액션은 “상대편에 알림”이 실시간(SSE)으로 도착

========================================================
13) 너(AI)의 출력 방식(코드 생성 지침)
========================================================

1) 먼저 전체 아키텍처, 폴더 구조, ERD 요약, 주요 상태머신/이벤트/알림 매핑표를 제시하라.
2) Flyway DDL(SQL)을 실제 실행 가능한 형태로 제공하라.
3) Backend 코드:
   - auth/security/jwt, tenant/project membership guard
   - 각 도메인(Posts/Requests/Decisions/Files/Meetings/eSign/Billing/Vault/Notifications)
   - SSE 구현
   - presigned upload
   - PDFBox 기반 완료본 생성 로직
   - Vault 암호화 유틸(AES-256-GCM)
   - 테스트(핵심 API 통합테스트 최소)
4) Frontend 코드:
   - 인증/토큰 갱신/권한가드
   - 프로젝트 룸 탭/각 모듈 화면
   - 파일 업로드/버전/주석
   - 회의 캘린더/응답
   - 서명 페이지(/sign/[contractId]) 구현
   - 알림센터 + SSE 구독
5) 로컬 실행 방법/데모 시나리오를 README로 마무리하라.
6) 요구사항을 “생략”하거나 “나중에”라고 하지 말고, 구현 가능한 범위로 전부 반영하라.

