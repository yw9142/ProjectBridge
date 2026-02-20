ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_initialized BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_setup_code_hash VARCHAR(255);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_setup_code_expires_at TIMESTAMPTZ;
