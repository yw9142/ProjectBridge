-- Align index strategy with current repository access patterns and soft-delete semantics.

ALTER TABLE tenant_members
    DROP CONSTRAINT IF EXISTS tenant_members_tenant_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_members_active
    ON tenant_members (tenant_id, user_id)
    WHERE deleted_at IS NULL;

ALTER TABLE project_members
    DROP CONSTRAINT IF EXISTS project_members_project_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_members_active
    ON project_members (project_id, user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_members_user_active
    ON tenant_members (user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_members_user_tenant_active
    ON project_members (user_id, tenant_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_project_tenant_active_created
    ON posts (project_id, tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_comments_post_tenant_active_created
    ON post_comments (post_id, tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_requests_project_tenant_active_created
    ON requests (project_id, tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_request_events_request_tenant_active_created
    ON request_events (request_id, tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_decisions_project_tenant_active_created
    ON decisions (project_id, tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_project_tenant_active_created
    ON files (project_id, tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_file_versions_file_tenant_active_version
    ON file_versions (file_id, tenant_id, version DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_file_comments_version_tenant_active_created
    ON file_comments (file_version_id, tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_project_tenant_active_start
    ON meetings (project_id, tenant_id, start_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_project_tenant_active_created
    ON contracts (project_id, tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_envelopes_contract_tenant_active_created
    ON signature_envelopes (contract_id, tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_project_tenant_active_created
    ON invoices (project_id, tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vault_secrets_project_tenant_active_created
    ON vault_secrets (project_id, tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user_active_created
    ON notifications (tenant_id, user_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed_created
    ON outbox_events (created_at ASC)
    WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outbox_tenant_active_created
    ON outbox_events (tenant_id, created_at DESC)
    WHERE deleted_at IS NULL;

