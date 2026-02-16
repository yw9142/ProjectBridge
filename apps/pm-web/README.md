# Bridge PM Web

PM (vendor) workspace web app for Bridge.

## Main Features
- PM login and session flow (`/login`)
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

## Validation Commands
```bash
pnpm -C apps/pm-web lint
pnpm -C apps/pm-web build
```
