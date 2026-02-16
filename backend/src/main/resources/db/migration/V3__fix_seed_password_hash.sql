-- Fix seeded demo account passwords.
-- The previous seed hash does not match the documented plaintext `password`.
-- Update only rows that still use the legacy hash, so customized passwords are preserved.
UPDATE users
SET password_hash = '$2a$10$Mnqm4KVMyYMcefsP/nFCOOjnwWDs4QShhy38A6rpJeU4Sd3Q843hO'
WHERE email IN ('admin@bridge.local', 'pm@bridge.local', 'client@bridge.local')
  AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi6YfV3G5UpiRaY1oCbcnZ6FQcmGeXW';
