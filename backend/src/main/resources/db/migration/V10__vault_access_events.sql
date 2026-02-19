CREATE TABLE IF NOT EXISTS vault_access_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    secret_id UUID NOT NULL REFERENCES vault_secrets(id),
    request_id UUID REFERENCES vault_access_requests(id),
    viewer_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vault_access_events_secret_viewer
    ON vault_access_events (tenant_id, secret_id, viewer_user_id, created_at DESC);
