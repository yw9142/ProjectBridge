# Bridge Backend

Spring Boot API for authentication, authorization, project collaboration domains, and storage integration.

## Tech Stack
- Java 21
- Spring Boot 3.5
- Spring Security + JWT
- Spring Data JPA + Flyway
- PostgreSQL
- MinIO

## Prerequisites
- Java 21
- Docker + Docker Compose

## Required Environment Variables
Values are resolved from `backend/src/main/resources/application.properties`.

- `DB_URL` (default: `jdbc:postgresql://localhost:5432/bridge`)
- `DB_USERNAME` (default: `bridge`)
- `DB_PASSWORD` (default: `bridge`)
- `JWT_SECRET`
- `VAULT_MASTER_KEY`
- `ALLOWED_ORIGINS` (example: `http://localhost:3000,http://localhost:3001,http://localhost:3002`)
- `MINIO_ENDPOINT` (default: `http://localhost:9000`)
- `MINIO_BUCKET` (default: `bridge`)
- `MINIO_ROOT_USER` (default: `minio`)
- `MINIO_ROOT_PASSWORD` (default: `minio123`)

Optional flags:
- `MAIL_ENABLED` (default: `false`)
- `GOOGLE_ENABLED` (default: `false`)

## Local Run
1. Start local infra from repository root
```bash
docker compose up -d
```

2. Start backend
```bash
./gradlew bootRun
# Windows (PowerShell/CMD)
gradlew.bat bootRun
```

Default server URL: `http://localhost:8080`

## API Docs
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`

## Main Auth Endpoints
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Validation Commands
```bash
./gradlew test
./gradlew build
# Windows (PowerShell/CMD)
gradlew.bat test
gradlew.bat build
```
