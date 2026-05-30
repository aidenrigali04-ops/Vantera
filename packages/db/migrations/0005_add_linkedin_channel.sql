-- Must run in its own transaction before 0005_core_services.sql.
-- PostgreSQL requires new enum values to be committed before use (55P04).

ALTER TYPE "channel" ADD VALUE IF NOT EXISTS 'linkedin';
