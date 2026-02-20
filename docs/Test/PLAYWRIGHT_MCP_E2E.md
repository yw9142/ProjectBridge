# Playwright MCP E2E 결과

작성일: 2026-02-17

## 실행 환경
- backend: `http://localhost:8080`
- pm-web: `http://localhost:3000`
- client-web: `http://localhost:3001`
- admin-web: `http://localhost:3002`

## 시나리오 및 결과
1. PM 보호 라우트 로그인 강제  
   - 접근: `/pm/projects`  
   - 결과: `/login?next=%2Fpm%2Fprojects`로 리다이렉트 확인  
   - 상태: PASS

2. PM 로그인 후 원경로 복귀  
   - 계정: `pm@bridge.local / password`  
   - 결과: `/pm/projects` 진입, 프로젝트 목록 렌더링 확인  
   - 상태: PASS

3. Client 보호 라우트 로그인 강제  
   - 접근: `/client/projects`  
   - 결과: `/login?next=%2Fclient%2Fprojects`로 리다이렉트 확인  
   - 상태: PASS

4. Client 로그인 후 원경로 복귀  
   - 계정: `client@bridge.local / password`  
   - 결과: `/client/projects` 진입 확인  
   - 상태: PASS

5. Admin 보호 라우트 로그인 강제  
   - 접근: `/admin/tenants`  
   - 결과: `/admin/login?next=%2Fadmin%2Ftenants`로 리다이렉트 확인  
   - 상태: PASS

6. Admin 로그인 후 원경로 복귀  
   - 계정: `admin@bridge.local / password`  
   - 결과: `/admin/tenants` 진입, 테넌트 목록 렌더링 확인  
   - 상태: PASS

7. 서명 경로 계약 접근 검증 동작  
   - 접근: `/sign/test-contract-id`  
   - 결과: 인증/권한 검증 또는 계약 미존재 에러 응답 확인  
   - 상태: PASS

## 메모
- 본 문서는 Phase 6/7의 Playwright MCP 스모크 게이트 결과입니다.
- 도메인 전체 플로우(DoD 1~9)는 `docs/DOD_DEMO_CHECKLIST.md`에서 별도 추적합니다.
- 일부 로그인 화면은 Playwright MCP `click` 호출이 간헐적으로 동작하지 않아, `form submit` 이벤트 방식으로 동일 경로를 검증했습니다.
