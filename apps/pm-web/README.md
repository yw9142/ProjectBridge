# Bridge PM Web

PM (vendor) workspace web app for Bridge.

## Main Features
- PM login and session flow (`/login`)
- PM first-password setup flow (`/first-password`)
- Project creation and project-room operations
- Collaboration screens for posts, files, contracts, requests, meetings, events, and member settings

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

3. Configure app env (`apps/pm-web/.env.local`)
```bash
NEXT_PUBLIC_API_BASE=http://localhost:8080
```

4. Run PM web
```bash
pnpm -C apps/pm-web dev -- --port 3000
```

5. Open
- URL: `http://localhost:3000/login`
- Seed account: `pm@bridge.local` / `password`

## Auth Notes
- API 요청은 `credentials: "include"` 기반 쿠키 인증을 사용합니다.
- 앱 스코프 헤더(`X-Bridge-App: pm`)가 없는 요청은 인증 쿠키를 해석하지 않습니다.
- Admin에서 생성한 신규 PM 계정은 `setupCode`로 `/first-password`에서 비밀번호를 먼저 설정해야 로그인할 수 있습니다.

## Validation Commands
```bash
pnpm -C apps/pm-web lint
pnpm -C apps/pm-web build
```
