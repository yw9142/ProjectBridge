# Bridge Admin Web

Admin console for Bridge platform operators.

## Main Features
- Admin login and session flow (`/admin/login`)
- Tenant and PM user management
- Project-room views: dashboard, posts, files, contracts, requests, meetings, events, and member settings

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

## Validation Commands
```bash
pnpm -C apps/admin-web lint
pnpm -C apps/admin-web build
```
