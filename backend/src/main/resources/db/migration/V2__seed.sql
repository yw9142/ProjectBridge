INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
VALUES ('11111111-1111-1111-1111-111111111111', 'Bridge Tenant', 'bridge', 'ACTIVE', now(), now())
ON CONFLICT (id) DO NOTHING;

-- BCrypt hash for password: password
INSERT INTO users (id, email, name, password_hash, status, is_platform_admin, created_at, updated_at)
VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@bridge.local', 'Platform Admin', '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi6YfV3G5UpiRaY1oCbcnZ6FQcmGeXW', 'ACTIVE', TRUE, now(), now()),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pm@bridge.local', 'PM Owner', '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi6YfV3G5UpiRaY1oCbcnZ6FQcmGeXW', 'ACTIVE', FALSE, now(), now()),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'client@bridge.local', 'Client Owner', '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi6YfV3G5UpiRaY1oCbcnZ6FQcmGeXW', 'ACTIVE', FALSE, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenant_members (id, tenant_id, user_id, role, created_at, updated_at)
VALUES
('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'PM_OWNER', now(), now()),
('d2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'CLIENT_OWNER', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, tenant_id, name, description, status, created_at, updated_at)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Demo Project', 'Bridge seed project', 'ACTIVE', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_members (id, tenant_id, project_id, user_id, role, created_at, updated_at)
VALUES
('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'PM_OWNER', now(), now()),
('e2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'CLIENT_OWNER', now(), now())
ON CONFLICT (id) DO NOTHING;
