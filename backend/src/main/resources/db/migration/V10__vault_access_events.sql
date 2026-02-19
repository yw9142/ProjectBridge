CREATE TABLE IF NOT EXISTS vault_access_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    secret_id UUID NOT NULL REFERENCES vault_secrets(id),
    viewer_user_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(20) NOT NULL DEFAULT 'VIEWED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vault_access_events_secret_viewer_created
    ON vault_access_events (secret_id, viewer_user_id, created_at DESC)
    WHERE deleted_at IS NULL;
