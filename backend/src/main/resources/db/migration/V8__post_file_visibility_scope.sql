ALTER TABLE posts
    ADD COLUMN visibility_scope VARCHAR(20) NOT NULL DEFAULT 'SHARED';

ALTER TABLE files
    ADD COLUMN visibility_scope VARCHAR(20) NOT NULL DEFAULT 'SHARED';

CREATE INDEX idx_posts_project_visibility ON posts (project_id, visibility_scope)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_files_project_visibility ON files (project_id, visibility_scope)
    WHERE deleted_at IS NULL;
