CREATE TABLE IF NOT EXISTS upload_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    aggregate_type VARCHAR(80) NOT NULL,
    aggregate_id UUID NOT NULL,
    object_key VARCHAR(400) NOT NULL,
    content_type VARCHAR(120) NOT NULL,
    expected_version INTEGER,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_upload_tickets_lookup
    ON upload_tickets (tenant_id, aggregate_type, aggregate_id, created_at DESC);
