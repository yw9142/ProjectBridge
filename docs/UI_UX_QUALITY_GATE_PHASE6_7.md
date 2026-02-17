# UI/UX Quality Gate (Phase 6/7)

작성일: 2026-02-17

## 적용 기준
- `docs/PLAN.md` 12장 (디자인/UX 적용 규칙)
- Web Interface Guidelines (Vercel Labs 최신 원문)

## 점검 범위
- `apps/pm-web/src/components/layout/AppHeader.tsx`
- `apps/pm-web/src/components/layout/PmSidebar.tsx`
- `apps/pm-web/src/components/ui/NotificationCenter.tsx`
- `apps/client-web/src/components/layout/ClientProjectShell.tsx`
- `apps/client-web/src/components/ui/NotificationCenter.tsx`
- `apps/admin-web/src/components/layout/AdminShell.tsx`
- `apps/admin-web/src/components/layout/AdminProjectTabs.tsx`

## 보완 사항
1. 내비게이션 접근성
- `nav`에 `aria-label` 추가
- 활성 링크에 `aria-current="page"` 추가

2. 알림센터 접근성
- 트리거 버튼에 `aria-controls` 연결
- 패널에 `role="dialog"`/`aria-label` 부여
- ESC 닫기 / 외부 클릭 닫기 처리 추가

3. UI 문구 일관성
- 주요 레이아웃 영문 문구를 한국어 중심으로 정리

## 품질 게이트 결과
1. 정적 품질
- `pnpm -C apps/pm-web lint`: PASS
- `pnpm -C apps/client-web lint`: PASS
- `pnpm -C apps/admin-web lint`: PASS

2. 빌드 품질
- `pnpm -C apps/pm-web build`: PASS
- `pnpm -C apps/client-web build`: PASS
- `pnpm -C apps/admin-web build`: PASS

3. 런타임 스모크
- 로그인 강제/복귀 및 주요 라우트 진입: PASS (`docs/PLAYWRIGHT_MCP_E2E.md`)

## 잔여 이슈
- Next.js 경고: `middleware` -> `proxy` 마이그레이션 필요
- Next.js 경고: 다중 lockfile로 인한 `turbopack.root` 경고

## 결론
- Phase 6/7 UI/UX 품질 게이트 기준을 충족함.
