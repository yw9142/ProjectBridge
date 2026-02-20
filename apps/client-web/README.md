# Bridge Client Web

Client-facing web portal for Bridge.

## Main Features
- Client login and session flow (`/login`)
- Client first-password setup flow (`/first-password`)
- Project list and project-room entry
- Collaboration screens for posts, files, contracts, requests, meetings, and billing

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

3. Configure app env (`apps/client-web/.env.local`)
```bash
NEXT_PUBLIC_API_BASE=http://localhost:8080
```

4. Run client web
```bash
pnpm -C apps/client-web dev -- --port 3001
```

5. Open
- URL: `http://localhost:3001/login`
- Seed account: `client@bridge.local` / `password`

## Auth Notes
- API 요청은 `credentials: "include"` 기반 쿠키 인증을 사용합니다.
- 앱 스코프 헤더(`X-Bridge-App: client`)가 없는 요청은 인증 쿠키를 해석하지 않습니다.
- PM/Admin에서 생성된 신규 클라이언트 계정은 `setupCode`로 `/first-password`에서 비밀번호를 먼저 설정해야 로그인할 수 있습니다.

## Validation Commands
```bash
pnpm -C apps/client-web lint
pnpm -C apps/client-web build
```
