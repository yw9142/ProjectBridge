ALTER TABLE users
    ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
    ADD COLUMN password_initialized BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
    ADD COLUMN password_setup_code_hash VARCHAR(255);

ALTER TABLE users
    ADD COLUMN password_setup_code_expires_at TIMESTAMPTZ;
