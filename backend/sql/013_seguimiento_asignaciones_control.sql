ALTER TABLE audit_controls
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'En Progreso',
    ADD COLUMN IF NOT EXISTS hours_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS feedback VARCHAR(2000) NULL;

ALTER TABLE audit_controls
    DROP CONSTRAINT IF EXISTS ck_audit_controls_status;

ALTER TABLE audit_controls
    ADD CONSTRAINT ck_audit_controls_status
    CHECK (status IN ('En Progreso', 'En Revision', 'Completado'));
