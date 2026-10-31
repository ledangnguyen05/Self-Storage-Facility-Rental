-- ==============================================================================
-- Migration V102: Add missing updated_at column to overdue_audit_logs table
-- Matches Spring Data JPA OverdueAuditLog entity inheritance from BaseEntity
-- Preserves existing audit trail history with DEFAULT CURRENT_TIMESTAMP
-- ==============================================================================

ALTER TABLE overdue_audit_logs 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

