# Bridge Admin Web

Admin console for Bridge platform operators.

## Main Features
- Admin login and session flow (`/admin/login`)
- Tenant and PM user management
- Project-room views: dashboard, posts, files, contracts, requests, meetings, events, and member settings
- PM 사용자 생성 시 setup code 발급/재발급 및 로그인 잠금 해제 운영

## Tech Stack
- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- TanStack Query

## Local Run
1. Install dependencies and start local infra from repo root
```bash
pnpm install
docker compose up -d
```

2. Start backend (`http://localhost:8080`)
```bash
pnpm -C backend dev
```

3. Configure app env (`apps/admin-web/.env.local`)
```bash
NEXT_PUBLIC_API_BASE=http://localhost:8080
```

4. Run admin web
```bash
pnpm -C apps/admin-web dev -- --port 3002
```

5. Open
- URL: `http://localhost:3002/admin/login`
- Seed account: `admin@bridge.local` / `password`

## Auth Notes
- API 요청은 `credentials: "include"` 기반 쿠키 인증을 사용합니다.
- 앱 스코프 헤더(`X-Bridge-App: admin`)가 없는 요청은 인증 쿠키를 해석하지 않습니다.
- 테넌트 PM 사용자 생성 시 응답으로 `setupCode`, `setupCodeExpiresAt`, `passwordInitialized`를 확인할 수 있습니다.

## Validation Commands
```bash
pnpm -C apps/admin-web lint
pnpm -C apps/admin-web build
```
