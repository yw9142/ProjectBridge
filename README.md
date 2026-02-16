# Bridge Monorepo

## Stack
- Monorepo: `pnpm` + `turborepo`
- Backend: Spring Boot 3.5, Java 21 toolchain, JPA/Hibernate, Flyway, JWT, SSE
- Frontend apps: `apps/pm-web`, `apps/client-web`, `apps/admin-web` (scaffolded)
- Local infra: PostgreSQL, MinIO, MailHog via Docker Compose

## Run Local Infra
```bash
docker compose up -d
```

## Backend
```bash
cd backend
./gradlew bootRun
```

Important env defaults are in `backend/src/main/resources/application.properties`.

## Backend Validation
```bash
cd backend
./gradlew test
./gradlew build -x test
```

## Current Status
- Backend API/DB baseline implemented and buildable.
- Frontend implementation is intentionally paused after backend completion.
