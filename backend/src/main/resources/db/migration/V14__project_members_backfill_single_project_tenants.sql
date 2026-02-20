WITH single_project_tenants AS (
    SELECT p.tenant_id,
           p.id AS project_id
    FROM projects p
    JOIN (
        SELECT tenant_id
        FROM projects
        WHERE deleted_at IS NULL
        GROUP BY tenant_id
        HAVING COUNT(*) = 1
    ) single_tenant ON single_tenant.tenant_id = p.tenant_id
    WHERE p.deleted_at IS NULL
),
active_tenant_members_raw AS (
    SELECT tm.tenant_id,
           tm.user_id,
           tm.role,
           COALESCE(tm.updated_by, tm.created_by) AS actor_id,
           tm.updated_at,
           tm.created_at
    FROM tenant_members tm
    WHERE tm.deleted_at IS NULL
),
active_tenant_members AS (
    SELECT DISTINCT ON (tm.tenant_id, tm.user_id)
           tm.tenant_id,
           tm.user_id,
           tm.role,
           tm.actor_id
    FROM active_tenant_members_raw tm
    ORDER BY tm.tenant_id,
             tm.user_id,
             tm.updated_at DESC NULLS LAST,
             tm.created_at DESC
),
reactivate_deleted_members AS (
    UPDATE project_members pm
    SET tenant_id = atm.tenant_id,
        role = atm.role,
        updated_at = now(),
        updated_by = atm.actor_id,
        deleted_at = NULL
    FROM active_tenant_members atm
    JOIN single_project_tenants spt
      ON spt.tenant_id = atm.tenant_id
    WHERE pm.project_id = spt.project_id
      AND pm.user_id = atm.user_id
      AND pm.deleted_at IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM project_members active_pm
          WHERE active_pm.project_id = pm.project_id
            AND active_pm.user_id = pm.user_id
            AND active_pm.deleted_at IS NULL
      )
    RETURNING pm.id
)
INSERT INTO project_members (
    id,
    tenant_id,
    project_id,
    user_id,
    role,
    created_at,
    created_by,
    updated_at,
    updated_by,
    deleted_at
)
SELECT gen_random_uuid(),
       atm.tenant_id,
       spt.project_id,
       atm.user_id,
       atm.role,
       now(),
       atm.actor_id,
       now(),
       atm.actor_id,
       NULL
FROM active_tenant_members atm
JOIN single_project_tenants spt
  ON spt.tenant_id = atm.tenant_id
LEFT JOIN project_members pm
  ON pm.project_id = spt.project_id
 AND pm.user_id = atm.user_id
WHERE pm.id IS NULL;
