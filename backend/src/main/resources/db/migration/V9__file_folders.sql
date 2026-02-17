CREATE TABLE IF NOT EXISTS file_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    path VARCHAR(400) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_file_folders_active
    ON file_folders (tenant_id, project_id, path)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_file_folders_project_tenant_active
    ON file_folders (project_id, tenant_id, path)
    WHERE deleted_at IS NULL;

INSERT INTO file_folders (id, tenant_id, project_id, path, created_at, updated_at)
SELECT gen_random_uuid(), d.tenant_id, d.project_id, d.folder, now(), now()
FROM (
    SELECT DISTINCT tenant_id, project_id, folder
    FROM files
    WHERE deleted_at IS NULL
      AND folder IS NOT NULL
      AND folder <> '/'
) d
ON CONFLICT DO NOTHING;
